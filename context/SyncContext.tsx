import { dbEvents } from "@/lib/db/dbEvents";
import { initDatabase } from "@/lib/db/initDatabase";
import { outboxRepo } from "@/lib/db/repositories/outboxRepo";
import { serverOverwritesRepo } from "@/lib/db/repositories/serverOverwritesRepo";
import { syncMetaRepo } from "@/lib/db/repositories/syncMetaRepo";
import { AUTO_PULL_INTERVAL_MS, maybeAutoPull } from "@/lib/sync/autoPull";
import { runWorkerPull } from "@/lib/sync/bootstrap";
import {
  clearAwaitingAuth,
  getEngineStatus,
  runSyncOnce,
  subscribeEngineStatus,
} from "@/lib/sync/syncEngine";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth } from "./AuthContext";
import { useNetwork } from "./NetworkContext";

type SyncEngineStatus =
  | "idle"
  | "pulling"
  | "pushing"
  | "awaiting_auth"
  | "backoff";

interface SyncContextData {
  /** true depois que o SQLite + migrations rodaram. */
  dbReady: boolean;
  /** Quantidade de ops no outbox aguardando envio (pending + failed). */
  outboxCount: number;
  /** Quantidade de OS sobrescritas pelo servidor que o usuário ainda não viu. */
  unacknowledgedOverwrites: number;
  /** ISO da última pull bem-sucedida, ou null se nunca sincronizou. */
  lastPullAt: string | null;
  /** Estado atual do motor de sync. */
  engineStatus: SyncEngineStatus;
  /**
   * Incrementa a cada mudança aplicada localmente (pull bem-sucedido, mutação
   * via outbox). Telas devem subscrever para refazer queries do SQLite.
   */
  dataVersion: number;
  /** Dispara um ciclo de pull + push imediato (ignora throttle). */
  forceSync: () => Promise<void>;
  /** Sinaliza ao engine que algo novo entrou no outbox. */
  kickEngine: () => void;
  /** Recarrega contadores a partir do DB (chame após mutações fora do contexto). */
  refreshCounters: () => Promise<void>;
}

const SyncContext = createContext<SyncContextData | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isOnline } = useNetwork();
  const { worker } = useAuth();
  const [dbReady, setDbReady] = useState(false);
  const [outboxCount, setOutboxCount] = useState(0);
  const [unacknowledgedOverwrites, setUnacknowledgedOverwrites] = useState(0);
  const [lastPullAt, setLastPullAt] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState<SyncEngineStatus>("idle");
  const [dataVersion, setDataVersion] = useState(0);

  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    let cancelled = false;
    initDatabase()
      .then(async () => {
        if (cancelled) return;
        const [count, overwrites, lastPull] = await Promise.all([
          outboxRepo.countByStatus(["pending", "failed"]),
          serverOverwritesRepo.countUnacknowledged(),
          syncMetaRepo.get("last_pull_at"),
        ]);
        if (cancelled) return;
        setOutboxCount(count);
        setUnacknowledgedOverwrites(overwrites);
        setLastPullAt(lastPull);
        setDbReady(true);
      })
      .catch((err) => {
        console.error("[sync] falha ao inicializar DB:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshCounters = useCallback(async () => {
    if (!dbReady) return;
    const [count, overwrites, lastPull] = await Promise.all([
      outboxRepo.countByStatus(["pending", "failed"]),
      serverOverwritesRepo.countUnacknowledged(),
      syncMetaRepo.get("last_pull_at"),
    ]);
    setOutboxCount(count);
    setUnacknowledgedOverwrites(overwrites);
    setLastPullAt(lastPull);
  }, [dbReady]);

  const runPush = useCallback(async () => {
    if (!dbReady || !worker || !isOnline) return;
    if (getEngineStatus() === "awaiting_auth") return;
    setEngineStatus("pushing");
    try {
      await runSyncOnce();
    } finally {
      // engineStatus volta para idle via subscribeEngineStatus listener (engine seta)
      // mas garantimos aqui caso já esteja idle.
      const cur = getEngineStatus();
      if (cur !== "awaiting_auth") setEngineStatus("idle");
      await refreshCounters();
    }
  }, [dbReady, worker, isOnline, refreshCounters]);

  const runPull = useCallback(
    async (force: boolean) => {
      if (!dbReady || !worker || !isOnline) return;
      setEngineStatus("pulling");
      try {
        const result = force ? await runWorkerPull() : await maybeAutoPull();
        if ("ok" in result && result.ok && !("skipped" in result)) {
          setDataVersion((v) => v + 1);
        }
      } finally {
        setEngineStatus("idle");
        await refreshCounters();
      }
      // Após pull bem-sucedido, drenar push pendente.
      await runPush();
    },
    [dbReady, worker, isOnline, refreshCounters, runPush]
  );

  const kickEngine = useCallback(() => {
    refreshCounters();
    setDataVersion((v) => v + 1);
    runPush();
  }, [refreshCounters, runPush]);

  // Subscribe a mudanças locais (mutações via outbox) para re-render + push.
  useEffect(() => {
    if (!dbReady) return;
    return dbEvents.subscribe(() => {
      setDataVersion((v) => v + 1);
      refreshCounters();
      runPush();
    });
  }, [dbReady, refreshCounters, runPush]);

  // Subscribe a pedidos de pull (ex.: op virou dead → precisa refrescar WO do servidor).
  useEffect(() => {
    if (!dbReady) return;
    return dbEvents.subscribePullRequested(() => {
      runPull(true);
    });
  }, [dbReady, runPull]);

  // Reflete status do engine para o context (push/idle/awaiting_auth).
  useEffect(() => {
    return subscribeEngineStatus((s) => {
      setEngineStatus((prev) => {
        // Não sobrescrever "pulling" com "idle" do engine — pull é gerido aqui.
        if (prev === "pulling") return prev;
        return s;
      });
    });
  }, []);

  // Quando o worker re-loga (ou volta a estar disponível), libera o awaiting_auth.
  useEffect(() => {
    if (worker && getEngineStatus() === "awaiting_auth") {
      clearAwaitingAuth();
      setEngineStatus("idle");
      runPush();
    }
  }, [worker, runPush]);

  const forceSync = useCallback(async () => {
    await runPull(true);
  }, [runPull]);

  // Pull automático ao logar/quando worker fica disponível.
  useEffect(() => {
    if (dbReady && worker && isOnline) {
      runPull(false);
    }
  }, [dbReady, worker, isOnline, runPull]);

  // Pull automático ao voltar do background.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const wasBackground =
        appStateRef.current === "background" || appStateRef.current === "inactive";
      appStateRef.current = next;
      if (wasBackground && next === "active") {
        refreshCounters();
        runPull(false);
      }
    });
    return () => sub.remove();
  }, [refreshCounters, runPull]);

  // Tick periódico (5min) para tentar puxar atualizações do servidor.
  useEffect(() => {
    if (!dbReady || !worker) return;
    const id = setInterval(() => {
      if (isOnline) runPull(false);
    }, AUTO_PULL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [dbReady, worker, isOnline, runPull]);

  return (
    <SyncContext.Provider
      value={{
        dbReady,
        outboxCount,
        unacknowledgedOverwrites,
        lastPullAt,
        engineStatus,
        dataVersion,
        forceSync,
        kickEngine,
        refreshCounters,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return ctx;
}
