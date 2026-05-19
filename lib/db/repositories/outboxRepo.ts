import { getDatabase } from "../sqlite";

export type OutboxStatus =
  | "pending"
  | "syncing"
  | "failed"
  | "done"
  | "dead"
  | "overwritten";

export type OutboxEntity = "workOrder" | "cipService";

export type OutboxOpType =
  | "start"
  | "pause"
  | "resume"
  | "finish"
  | "cancel"
  | "complete";

export interface OutboxOp<P = Record<string, unknown>> {
  id: string;
  entity: OutboxEntity;
  entity_id: string;
  op_type: OutboxOpType;
  payload: P;
  base_updated_at: string | null;
  status: OutboxStatus;
  attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

interface OutboxRow extends Omit<OutboxOp, "payload"> {
  payload: string;
}

function parseRow<P>(row: OutboxRow): OutboxOp<P> {
  return { ...row, payload: JSON.parse(row.payload) as P };
}

export interface EnqueueInput<P = Record<string, unknown>> {
  entity: OutboxEntity;
  entityId: string;
  opType: OutboxOpType;
  payload: P;
  baseUpdatedAt?: string | null;
  /** UUID gerado pelo caller (clientOpId). Recomendado para idempotência. */
  id?: string;
}

function uuid(): string {
  // RFC4122 v4 simples — sem dependência externa (worker-app ainda não tem uuid lib).
  // Suficiente para clientOpId; servidor confia no valor e aplica idempotência.
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    ""
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function enqueue<P>(input: EnqueueInput<P>): Promise<string> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = input.id ?? uuid();
  await db.runAsync(
    `INSERT INTO outbox (
       id, entity, entity_id, op_type, payload, base_updated_at,
       status, attempts, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
    [
      id,
      input.entity,
      input.entityId,
      input.opType,
      JSON.stringify(input.payload),
      input.baseUpdatedAt ?? null,
      now,
      now,
    ]
  );
  return id;
}

async function peekPending(limit: number): Promise<OutboxOp[]> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox
     WHERE status = 'pending'
        OR (status = 'failed' AND (next_retry_at IS NULL OR next_retry_at <= ?))
     ORDER BY created_at ASC
     LIMIT ?`,
    [now, limit]
  );
  return rows.map((r) => parseRow(r));
}

async function markSyncing(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDatabase();
  const placeholders = ids.map(() => "?").join(", ");
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE outbox SET status = 'syncing', updated_at = ? WHERE id IN (${placeholders})`,
    [now, ...ids]
  );
}

async function markDone(id: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE outbox SET status = 'done', last_error = NULL, updated_at = ? WHERE id = ?`,
    [now, id]
  );
}

async function markOverwritten(id: string, reason?: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE outbox SET status = 'overwritten', last_error = ?, updated_at = ? WHERE id = ?`,
    [reason ?? null, now, id]
  );
}

const RETRY_DELAYS_MS = [1_000, 5_000, 30_000, 300_000, 1_800_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

async function markFailed(
  id: string,
  error: string
): Promise<{ isDead: boolean; attempts: number }> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ attempts: number }>(
    `SELECT attempts FROM outbox WHERE id = ?`,
    [id]
  );
  const nextAttempts = (row?.attempts ?? 0) + 1;
  const now = Date.now();
  const delay = RETRY_DELAYS_MS[Math.min(nextAttempts - 1, MAX_ATTEMPTS - 1)];
  const isDead = nextAttempts >= MAX_ATTEMPTS;
  await db.runAsync(
    `UPDATE outbox
     SET status = ?, attempts = ?, last_error = ?, next_retry_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      isDead ? "dead" : "failed",
      nextAttempts,
      error,
      isDead ? null : new Date(now + delay).toISOString(),
      new Date(now).toISOString(),
      id,
    ]
  );
  return { isDead, attempts: nextAttempts };
}

/**
 * Marca de uma só vez todas as ops (pending/failed/syncing) de uma mesma
 * entidade como dead. Usado quando uma op é rejeitada por motivo definitivo
 * (ex.: worker não atribuído) — as ops irmãs falhariam pelo mesmo motivo.
 */
async function markSiblingsDead(
  entity: OutboxEntity,
  entityId: string,
  excludeId: string,
  reason: string
): Promise<number> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `UPDATE outbox
     SET status = 'dead', last_error = ?, next_retry_at = NULL, updated_at = ?
     WHERE entity = ? AND entity_id = ? AND id != ?
       AND status IN ('pending', 'failed', 'syncing')`,
    [reason, now, entity, entityId, excludeId]
  );
  return result.changes;
}

async function findDead(): Promise<OutboxOp[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE status = 'dead' ORDER BY created_at ASC`
  );
  return rows.map((r) => parseRow(r));
}

async function countDead(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM outbox WHERE status = 'dead'`
  );
  return row?.c ?? 0;
}

async function deleteById(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM outbox WHERE id = ?`, [id]);
}

async function deleteByStatus(statuses: OutboxStatus[]): Promise<number> {
  if (statuses.length === 0) return 0;
  const db = await getDatabase();
  const placeholders = statuses.map(() => "?").join(", ");
  const result = await db.runAsync(
    `DELETE FROM outbox WHERE status IN (${placeholders})`,
    statuses
  );
  return result.changes;
}

async function hasOtherPendingForEntity(
  entity: OutboxEntity,
  entityId: string,
  excludeId: string
): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM outbox
     WHERE entity = ? AND entity_id = ? AND id != ?
       AND status IN ('pending', 'failed', 'syncing')`,
    [entity, entityId, excludeId]
  );
  return (row?.c ?? 0) > 0;
}

/** Reseta ops 'syncing' órfãs (ex.: app fechou no meio do batch) de volta para 'pending'. */
async function resetOrphanedSyncing(): Promise<number> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `UPDATE outbox SET status = 'pending', updated_at = ? WHERE status = 'syncing'`,
    [now]
  );
  return result.changes;
}

async function countByStatus(
  statuses: OutboxStatus[] = ["pending", "failed"]
): Promise<number> {
  if (statuses.length === 0) return 0;
  const db = await getDatabase();
  const placeholders = statuses.map(() => "?").join(", ");
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM outbox WHERE status IN (${placeholders})`,
    statuses
  );
  return row?.c ?? 0;
}

async function findAll(): Promise<OutboxOp[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox ORDER BY created_at DESC`
  );
  return rows.map((r) => parseRow(r));
}

async function findByEntityId(
  entity: OutboxEntity,
  entityId: string
): Promise<OutboxOp[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox WHERE entity = ? AND entity_id = ? ORDER BY created_at ASC`,
    [entity, entityId]
  );
  return rows.map((r) => parseRow(r));
}

async function deleteAll(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM outbox`);
}

export const outboxRepo = {
  enqueue,
  peekPending,
  markSyncing,
  markDone,
  markOverwritten,
  markFailed,
  markSiblingsDead,
  findDead,
  countDead,
  resetOrphanedSyncing,
  countByStatus,
  findAll,
  findByEntityId,
  hasOtherPendingForEntity,
  deleteById,
  deleteByStatus,
  deleteAll,
};
