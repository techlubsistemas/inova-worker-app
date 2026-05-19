import { API_URL } from "@/context/AuthContext";
import axios from "axios";
import { dbEvents } from "../db/dbEvents";
import { OutboxOp, outboxRepo } from "../db/repositories/outboxRepo";
import { serverOverwritesRepo } from "../db/repositories/serverOverwritesRepo";
import { syncMetaRepo } from "../db/repositories/syncMetaRepo";
import { workOrdersRepo } from "../db/repositories/workOrdersRepo";

const BATCH_SIZE = 50;

interface BatchOpResult {
  clientOpId: string;
  status: "applied" | "overwritten" | "rejected";
  serverRow?: Record<string, unknown>;
  error?: string;
}

interface BatchResponse {
  serverTime: string;
  results: BatchOpResult[];
}

export type SyncEngineStatus =
  | "idle"
  | "pushing"
  | "awaiting_auth"
  | "backoff";

export interface SyncEngineRunResult {
  ok: boolean;
  drained: number;
  failed: number;
  overwritten: number;
  awaitingAuth?: boolean;
  error?: string;
}

let inFlight: Promise<SyncEngineRunResult> | null = null;
let currentStatus: SyncEngineStatus = "idle";
const statusListeners = new Set<(s: SyncEngineStatus) => void>();

function setStatus(next: SyncEngineStatus) {
  currentStatus = next;
  statusListeners.forEach((l) => {
    try {
      l(next);
    } catch (err) {
      console.error("[syncEngine] status listener falhou:", err);
    }
  });
}

export function getEngineStatus(): SyncEngineStatus {
  return currentStatus;
}

export function subscribeEngineStatus(
  listener: (s: SyncEngineStatus) => void,
): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * Drena o outbox em um único ciclo. Coalesce calls concorrentes.
 *
 * Retorna estatísticas para o caller (telemetria/UI). Erros graves
 * (rede caída, 401) NÃO lançam — refletem em `ok: false` e/ou awaitingAuth.
 */
export function runSyncOnce(): Promise<SyncEngineRunResult> {
  if (inFlight) return inFlight;
  inFlight = doRun().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRun(): Promise<SyncEngineRunResult> {
  if (currentStatus === "awaiting_auth") {
    return {
      ok: false,
      drained: 0,
      failed: 0,
      overwritten: 0,
      awaitingAuth: true,
    };
  }

  setStatus("pushing");
  let totalDrained = 0;
  let totalFailed = 0;
  let totalOverwritten = 0;

  try {
    while (true) {
      const ops = await outboxRepo.peekPending(BATCH_SIZE);
      if (ops.length === 0) break;

      await outboxRepo.markSyncing(ops.map((o) => o.id));

      let response: BatchResponse;
      try {
        const { data } = await axios.post<BatchResponse>(
          `${API_URL}/sync/work-order/worker-batch`,
          { ops: ops.map(toRequestOp) },
          { timeout: 30_000 },
        );
        response = data;
      } catch (err) {
        const status = (err as { response?: { status?: number } }).response
          ?.status;
        const message =
          (err as { response?: { data?: { message?: string } }; message?: string })
            .response?.data?.message ??
          (err as Error).message ??
          "Erro de rede";

        if (status === 401) {
          // Ops voltam para 'pending'; SyncContext pausa engine via awaiting_auth.
          await resetOpsToPending(ops);
          setStatus("awaiting_auth");
          return {
            ok: false,
            drained: totalDrained,
            failed: 0,
            overwritten: totalOverwritten,
            awaitingAuth: true,
          };
        }

        // Erro transiente (rede / 5xx): marca todas como failed, sai do loop.
        for (const op of ops) {
          await outboxRepo.markFailed(op.id, message);
          totalFailed++;
        }
        return {
          ok: false,
          drained: totalDrained,
          failed: totalFailed,
          overwritten: totalOverwritten,
          error: message,
        };
      }

      // Aplica resultados ao SQLite local.
      const drained = await applyBatchResults(ops, response.results);
      totalDrained += drained.applied;
      totalFailed += drained.rejected;
      totalOverwritten += drained.overwritten;

      await syncMetaRepo.set("last_push_at", new Date().toISOString());
      dbEvents.emitDataChanged();
      // Se alguma op virou `dead`, precisamos refrescar o estado local da WO
      // pelo servidor (a mutação otimista nunca foi aceita).
      if (drained.deadDetected) {
        dbEvents.emitPullRequested();
      }

      // Se NADA aplicou (lote tóxico ou tudo overwritten/rejected), sair para evitar loop.
      if (drained.applied === 0) break;

      // Se o lote foi menor que o tamanho, fim.
      if (ops.length < BATCH_SIZE) break;
    }

    return {
      ok: true,
      drained: totalDrained,
      failed: totalFailed,
      overwritten: totalOverwritten,
    };
  } finally {
    if ((currentStatus as SyncEngineStatus) !== "awaiting_auth") {
      setStatus("idle");
    }
  }
}

/**
 * Marca o engine como liberado para drenar de novo (chamado após re-login).
 */
export function clearAwaitingAuth(): void {
  if (currentStatus === "awaiting_auth") setStatus("idle");
}

async function resetOpsToPending(ops: OutboxOp[]): Promise<void> {
  for (const op of ops) {
    // markFailed bumpa attempts; aqui queremos apenas devolver para pending sem penalizar.
    // O engine vai retentar quando re-auth acontecer.
    await outboxRepo.markFailed(op.id, "Token expirado, aguardando re-auth.");
  }
}

function toRequestOp(op: OutboxOp): Record<string, unknown> {
  return {
    clientOpId: op.id,
    entity: op.entity,
    opType: op.op_type,
    entityId: op.entity_id,
    payload: op.payload,
    baseUpdatedAt: op.base_updated_at,
    createdAt: op.created_at,
  };
}

interface DrainStats {
  applied: number;
  rejected: number;
  overwritten: number;
  deadDetected: boolean;
}

async function applyBatchResults(
  sentOps: OutboxOp[],
  results: BatchOpResult[],
): Promise<DrainStats> {
  const stats: DrainStats = {
    applied: 0,
    rejected: 0,
    overwritten: 0,
    deadDetected: false,
  };
  const sentById = new Map(sentOps.map((o) => [o.id, o]));

  // Agrupar overwrites e rejeições por workOrder para registrar 1 alerta por OS.
  const overwritesByWo = new Map<string, { opIds: string[]; reason: string }>();

  for (const result of results) {
    const op = sentById.get(result.clientOpId);
    if (!op) continue;

    if (result.status === "applied") {
      await outboxRepo.markDone(op.id);
      if (result.serverRow) {
        await applyServerRowToLocal(op, result.serverRow);
      }
      stats.applied++;
    } else if (result.status === "overwritten") {
      await outboxRepo.markOverwritten(op.id, "Servidor atualizou primeiro.");
      const woId = extractWoId(op);
      if (woId) {
        const entry = overwritesByWo.get(woId) ?? {
          opIds: [],
          reason: "Servidor atualizou a OS antes da sincronização.",
        };
        entry.opIds.push(op.id);
        overwritesByWo.set(woId, entry);
        if (result.serverRow) {
          await applyServerRowToLocal(op, result.serverRow, true);
        }
      }
      stats.overwritten++;
    } else {
      const reason = result.error ?? "Rejeitado pelo servidor.";
      const { isDead } = await outboxRepo.markFailed(op.id, reason);
      stats.rejected++;
      if (isDead) {
        stats.deadDetected = true;
        await handleDeadOp(op, reason, overwritesByWo);
      }
    }
  }

  for (const [workOrderId, entry] of overwritesByWo.entries()) {
    await serverOverwritesRepo.record({
      workOrderId,
      discardedOpIds: entry.opIds,
      reason: entry.reason,
    });
  }

  // Resetar 'syncing' órfãs (caso o servidor não tenha respondido alguma op).
  const handled = new Set(results.map((r) => r.clientOpId));
  for (const op of sentOps) {
    if (!handled.has(op.id)) {
      await outboxRepo.markFailed(op.id, "Servidor não retornou resultado.");
      stats.rejected++;
    }
  }

  return stats;
}

/**
 * Quando uma op transita para `dead` (rejeitada ou esgotou retries), o estado
 * local otimista da WO ficaria divergente do servidor para sempre. Esta função:
 *  - marca as ops irmãs (mesma WO) como `dead` (também falhariam pelo mesmo motivo);
 *  - reseta o `_sync_status` da WO para permitir que o próximo pull a sobrescreva;
 *  - registra um overwrite para acionar o banner amarelo ao usuário.
 */
async function handleDeadOp(
  op: OutboxOp,
  reason: string,
  overwritesByWo: Map<string, { opIds: string[]; reason: string }>,
): Promise<void> {
  const woId = extractWoId(op);
  if (!woId) return;

  await outboxRepo.markSiblingsDead(
    op.entity,
    op.entity_id,
    op.id,
    `Operação descartada após rejeição: ${reason}`,
  );

  // Permite que o próximo pull traga o estado real do servidor (ou remova
  // a OS se ela não pertence mais ao worker).
  await workOrdersRepo.markForServerRefresh(woId);

  const entry = overwritesByWo.get(woId) ?? {
    opIds: [],
    reason: `Alteração não aceita pelo servidor: ${reason}`,
  };
  if (!entry.opIds.includes(op.id)) entry.opIds.push(op.id);
  // Mantém a razão da primeira rejeição para esta WO.
  overwritesByWo.set(woId, entry);
}

function extractWoId(op: OutboxOp): string | null {
  if (op.entity === "workOrder") return op.entity_id;
  if (op.entity === "cipService") return op.entity_id.split(":")[0];
  return null;
}

async function applyServerRowToLocal(
  op: OutboxOp,
  serverRow: Record<string, unknown>,
  markAsServerOverwritten = false,
): Promise<void> {
  const woId = extractWoId(op);
  if (!woId) return;
  await workOrdersRepo.upsertFromServer({
    id: woId,
    data: serverRow as Parameters<typeof workOrdersRepo.upsertFromServer>[0]["data"],
    serverUpdatedAt: (serverRow.updatedAt as string | undefined) ?? null,
  });
  if (markAsServerOverwritten) {
    // Re-marca o status para refletir overwrite (para UI mostrar badge).
    await workOrdersRepo.applyLocalMutation(
      woId,
      (current) => current,
      { syncStatus: "server_overwritten" },
    );
  }
}
