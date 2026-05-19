import { getDatabase } from "../sqlite";
import { BaseRow, ParsedRow, parseRow, SyncStatus } from "./types";

export type WorkOrderStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

/**
 * Shape mínimo de WorkOrder esperado no JSON `data`. Mantido propositadamente
 * solto (Record) — o snapshot do servidor pode trazer mais campos que serão
 * preservados sem precisar de migração local.
 */
export interface WorkOrderData extends Record<string, unknown> {
  id: string;
  status: WorkOrderStatus;
}

interface WorkOrderRow extends BaseRow {
  code: number | null;
  status: WorkOrderStatus | null;
  company_id: string | null;
  cip_id: string | null;
  equipment_id: string | null;
  area_id: string | null;
  sector_id: string | null;
  route_id: string | null;
  scheduled_at: string | null;
  executed_at: string | null;
  completed_at: string | null;
  cancellation_reason: string | null;
  visibility_mode: string | null;
}

const INDEXED_COLUMNS = [
  "code",
  "status",
  "company_id",
  "cip_id",
  "equipment_id",
  "area_id",
  "sector_id",
  "route_id",
  "scheduled_at",
  "executed_at",
  "completed_at",
  "cancellation_reason",
  "visibility_mode",
] as const;

function extractIndexed(data: Record<string, unknown>): unknown[] {
  return INDEXED_COLUMNS.map((col) => {
    const camel = col.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    const v = data[camel] ?? data[col];
    return v === undefined ? null : v;
  });
}

async function findById(id: string): Promise<ParsedRow<WorkOrderData> | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<WorkOrderRow>(
    `SELECT * FROM work_orders WHERE id = ?`,
    [id]
  );
  return row ? parseRow<WorkOrderData>(row) : null;
}

async function findAll(): Promise<ParsedRow<WorkOrderData>[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<WorkOrderRow>(
    `SELECT * FROM work_orders ORDER BY scheduled_at ASC NULLS LAST, code ASC`
  );
  return rows.map((r) => parseRow<WorkOrderData>(r));
}

async function findByStatus(
  statuses: WorkOrderStatus[]
): Promise<ParsedRow<WorkOrderData>[]> {
  if (statuses.length === 0) return [];
  const db = await getDatabase();
  const placeholders = statuses.map(() => "?").join(", ");
  const rows = await db.getAllAsync<WorkOrderRow>(
    `SELECT * FROM work_orders WHERE status IN (${placeholders})`,
    statuses as never[]
  );
  return rows.map((r) => parseRow<WorkOrderData>(r));
}

async function upsertFromServer(input: {
  id: string;
  data: WorkOrderData;
  serverUpdatedAt?: string | null;
  createdAt?: string;
}): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const indexedValues = extractIndexed(input.data);

  const cols = [
    "id",
    ...INDEXED_COLUMNS,
    "data",
    "created_at",
    "updated_at",
    "_sync_status",
    "_base_updated_at",
  ];
  const placeholders = cols.map(() => "?").join(", ");
  const updateSet = cols
    .filter((c) => c !== "id" && c !== "created_at")
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");

  await db.runAsync(
    `INSERT INTO work_orders (${cols.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT(id) DO UPDATE SET ${updateSet}`,
    [
      input.id,
      ...indexedValues,
      JSON.stringify(input.data),
      input.createdAt ?? now,
      input.serverUpdatedAt ?? now,
      "synced",
      input.serverUpdatedAt ?? null,
    ] as never[]
  );
}

/**
 * Aplica uma mutação local (start/pause/resume/finish/cancel). Atualiza
 * o JSON `data`, as colunas indexáveis e marca como `pending`.
 *
 * O caller é responsável por enfileirar a op no outbox na MESMA transação
 * (ver outboxRepo.enqueue + db.withTransactionAsync no service de WO).
 */
async function applyLocalMutation(
  id: string,
  mutator: (current: WorkOrderData) => WorkOrderData,
  opts: { syncStatus?: SyncStatus } = {}
): Promise<WorkOrderData> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<WorkOrderRow>(
    `SELECT * FROM work_orders WHERE id = ?`,
    [id]
  );
  if (!row) {
    throw new Error(`WorkOrder ${id} não encontrada localmente.`);
  }
  const current = JSON.parse(row.data) as WorkOrderData;
  const next = mutator(current);
  const now = new Date().toISOString();
  const indexedValues = extractIndexed(next);

  const setClauses = [
    ...INDEXED_COLUMNS.map((c) => `${c} = ?`),
    "data = ?",
    "updated_at = ?",
    "_sync_status = ?",
    "_last_local_change_at = ?",
  ].join(", ");

  await db.runAsync(
    `UPDATE work_orders SET ${setClauses} WHERE id = ?`,
    [
      ...indexedValues,
      JSON.stringify(next),
      now,
      opts.syncStatus ?? "pending",
      now,
      id,
    ] as never[]
  );

  return next;
}

async function deleteById(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM work_orders WHERE id = ?`, [id]);
}

/**
 * Reseta o `_sync_status` para permitir que o próximo pull do servidor
 * sobrescreva esta WO (usado quando ops do outbox são rejeitadas em
 * definitivo — o estado local otimista precisa ser revertido pelo pull).
 */
async function markForServerRefresh(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE work_orders SET _sync_status = 'server_overwritten', updated_at = ? WHERE id = ?`,
    [now, id]
  );
}

async function deleteByIds(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const db = await getDatabase();
  const placeholders = ids.map(() => "?").join(", ");
  const result = await db.runAsync(
    `DELETE FROM work_orders WHERE id IN (${placeholders})`,
    ids as never[]
  );
  return result.changes;
}

async function findAllIds(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; _sync_status: string }>(
    `SELECT id, _sync_status FROM work_orders`
  );
  return rows.map((r) => r.id);
}

async function findIdsBySyncStatus(
  syncStatus: SyncStatus
): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM work_orders WHERE _sync_status = ?`,
    [syncStatus]
  );
  return rows.map((r) => r.id);
}

async function deleteAll(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM work_orders`);
}

async function count(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM work_orders`
  );
  return row?.c ?? 0;
}

export const workOrdersRepo = {
  findById,
  findAll,
  findByStatus,
  upsertFromServer,
  applyLocalMutation,
  deleteById,
  deleteByIds,
  findAllIds,
  findIdsBySyncStatus,
  markForServerRefresh,
  deleteAll,
  count,
};
