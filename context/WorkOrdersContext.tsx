import { workOrdersRepo } from "@/lib/db/repositories/workOrdersRepo";
import type { WorkOrderApi } from "@/types/workOrder";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSync } from "./SyncContext";

interface WorkOrdersContextValue {
  workOrders: WorkOrderApi[];
  loading: boolean;
  error: string | null;
  /** Force a full sync (pull + push) and re-read locally. */
  refetch: () => Promise<void>;
  /** Re-read from local DB without forcing a sync (auto-pull respects throttle). */
  refetchIfStale: () => Promise<void>;
  /**
   * Optimistic in-memory update — used pelas telas atuais antes do refactor
   * para outbox. Será substituído na Fase 3 por mutações via SQLite + outbox.
   */
  updateLocal: (
    orderId: string,
    updater: (wo: WorkOrderApi) => WorkOrderApi,
  ) => void;
}

const WorkOrdersContext = createContext<WorkOrdersContextValue | null>(null);

export function WorkOrdersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { dbReady, dataVersion, engineStatus, forceSync } = useSync();
  const [workOrders, setWorkOrders] = useState<WorkOrderApi[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!dbReady) return;
    try {
      const rows = await workOrdersRepo.findAll();
      setWorkOrders(rows.map((r) => r.data as unknown as WorkOrderApi));
      setError(null);
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as Error).message)
          : "Falha ao carregar ordens de serviço.";
      setError(message);
    }
  }, [dbReady]);

  // Re-read sempre que o DB ficar pronto ou um pull aplicar mudanças.
  useEffect(() => {
    reload();
  }, [reload, dataVersion]);

  const refetch = useCallback(async () => {
    await forceSync();
    await reload();
  }, [forceSync, reload]);

  const refetchIfStale = useCallback(async () => {
    // O SyncContext já dispara auto-pull no foreground/intervalo.
    // Aqui apenas re-lemos do SQLite — o pull (se for rodar) atualizará via dataVersion.
    await reload();
  }, [reload]);

  const updateLocal = useCallback(
    (orderId: string, updater: (wo: WorkOrderApi) => WorkOrderApi) => {
      setWorkOrders((prev) =>
        prev.map((wo) => (wo.id === orderId ? updater(wo) : wo)),
      );
    },
    [],
  );

  const value = useMemo<WorkOrdersContextValue>(
    () => ({
      workOrders,
      loading: !dbReady || engineStatus === "pulling",
      error,
      refetch,
      refetchIfStale,
      updateLocal,
    }),
    [workOrders, dbReady, engineStatus, error, refetch, refetchIfStale, updateLocal],
  );

  return (
    <WorkOrdersContext.Provider value={value}>
      {children}
    </WorkOrdersContext.Provider>
  );
}

export function useWorkOrders(): WorkOrdersContextValue {
  const ctx = useContext(WorkOrdersContext);
  if (!ctx) {
    throw new Error("useWorkOrders must be used within WorkOrdersProvider");
  }
  return ctx;
}
