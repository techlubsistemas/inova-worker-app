import { API_URL } from "@/context/AuthContext";
import axios from "axios";
import {
  areasRepo,
  cipServicesRepo,
  cipsRepo,
  episRepo,
  equipmentsRepo,
  materialsRepo,
  sectorsRepo,
  serviceProblemReasonsRepo,
  syncMetaRepo,
  workInstructionsRepo,
  workOrdersRepo,
  workersRepo,
} from "../db/repositories";
import { GenericRepo } from "../db/repositories/genericRepo";
import { WorkOrderData } from "../db/repositories/workOrdersRepo";
import { BootstrapEntity, WorkerBootstrapSnapshot } from "./types";

export interface PullResult {
  ok: boolean;
  serverTime?: string;
  applied?: { entity: string; count: number }[];
  error?: string;
}

let inFlight: Promise<PullResult> | null = null;

/**
 * Busca o snapshot completo do worker no servidor e aplica em transação local.
 *
 * - Server-wins: linhas com `_sync_status = 'synced'` são sobrescritas;
 *   linhas com `_sync_status = 'pending'` são preservadas (o sync engine
 *   resolverá o conflito quando tentar dar push das ops do outbox).
 * - Coalesce: chamadas concorrentes compartilham a mesma promise.
 */
export async function runWorkerPull(): Promise<PullResult> {
  if (inFlight) return inFlight;
  inFlight = doPull().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doPull(): Promise<PullResult> {
  try {
    const { data } = await axios.get<WorkerBootstrapSnapshot>(
      `${API_URL}/sync/worker-bootstrap`,
      { timeout: 30_000 }
    );

    const applied = await applySnapshot(data);
    await syncMetaRepo.set("last_pull_at", new Date().toISOString());
    if (!(await syncMetaRepo.get("bootstrap_completed_at"))) {
      await syncMetaRepo.set("bootstrap_completed_at", new Date().toISOString());
    }

    return { ok: true, serverTime: data.serverTime, applied };
  } catch (err) {
    const message =
      (err as { response?: { data?: { message?: string } }; message?: string })
        .response?.data?.message ??
      (err as Error).message ??
      "Erro desconhecido no pull";
    console.error("[sync.bootstrap] falha:", message);
    return { ok: false, error: message };
  }
}

async function applySnapshot(
  snapshot: WorkerBootstrapSnapshot
): Promise<{ entity: string; count: number }[]> {
  const counts: { entity: string; count: number }[] = [];

  // Worker (próprio): sempre sobrescreve.
  if (snapshot.worker?.id) {
    await workersRepo.upsertFromServer({
      id: snapshot.worker.id,
      data: snapshot.worker,
      serverUpdatedAt: snapshot.serverTime,
    });
    counts.push({ entity: "worker", count: 1 });
  }

  await applyEntityList(snapshot.areas, areasRepo, "areas", counts);
  await applyEntityList(snapshot.sectors, sectorsRepo, "sectors", counts);
  await applyEntityList(snapshot.equipments, equipmentsRepo, "equipments", counts);
  await applyEntityList(snapshot.cips, cipsRepo, "cips", counts);
  await applyEntityList(snapshot.cipServices, cipServicesRepo, "cipServices", counts);
  await applyEntityList(
    snapshot.workInstructions,
    workInstructionsRepo,
    "workInstructions",
    counts
  );
  await applyEntityList(snapshot.epis, episRepo, "epis", counts);
  await applyEntityList(snapshot.materials, materialsRepo, "materials", counts);
  await applyEntityList(
    snapshot.serviceProblemReasons,
    serviceProblemReasonsRepo,
    "serviceProblemReasons",
    counts
  );

  // Work orders precisam tratamento especial p/ preservar ops locais pendentes.
  const woResult = await applyWorkOrders(snapshot.workOrders);
  counts.push({ entity: "workOrders", count: woResult.applied });
  if (woResult.deletedOrphans > 0) {
    counts.push({ entity: "workOrdersOrphans", count: woResult.deletedOrphans });
  }

  return counts;
}

async function applyEntityList(
  rows: BootstrapEntity[] | undefined,
  repo: GenericRepo<Record<string, unknown>>,
  label: string,
  counts: { entity: string; count: number }[]
): Promise<void> {
  if (!rows || rows.length === 0) {
    counts.push({ entity: label, count: 0 });
    return;
  }
  for (const row of rows) {
    await repo.upsertFromServer({
      id: row.id,
      data: row,
      serverUpdatedAt: (row.updatedAt as string | null) ?? null,
      createdAt: (row.createdAt as string | undefined) ?? undefined,
    });
  }
  counts.push({ entity: label, count: rows.length });
}

async function applyWorkOrders(
  rows: BootstrapEntity[] | undefined
): Promise<{ applied: number; deletedOrphans: number }> {
  const serverIds = new Set((rows ?? []).map((r) => r.id));
  let applied = 0;

  for (const row of rows ?? []) {
    const existing = await workOrdersRepo.findById(row.id);
    if (existing && existing._sync_status === "pending") {
      // Server-wins é tratado pelo sync engine na hora do push.
      // Aqui mantemos a versão local até que o engine confirme overwrite.
      continue;
    }
    await workOrdersRepo.upsertFromServer({
      id: row.id,
      data: row as WorkOrderData,
      serverUpdatedAt: (row.updatedAt as string | null) ?? null,
      createdAt: (row.createdAt as string | undefined) ?? undefined,
    });
    applied++;
  }

  // Limpa OS órfãs: presentes localmente como 'synced' mas ausentes no snapshot
  // do servidor (worker foi desatribuído, OS foi removida do escopo, etc.).
  // OS 'pending' são preservadas — o sync engine resolverá o conflito no push.
  const localSyncedIds = await workOrdersRepo.findIdsBySyncStatus("synced");
  const orphanIds = localSyncedIds.filter((id) => !serverIds.has(id));
  const deletedOrphans = await workOrdersRepo.deleteByIds(orphanIds);

  return { applied, deletedOrphans };
}
