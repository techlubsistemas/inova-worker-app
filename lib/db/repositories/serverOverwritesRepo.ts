import { getDatabase } from "../sqlite";

export interface ServerOverwriteRow {
  id: string;
  work_order_id: string;
  detected_at: string;
  acknowledged_at: string | null;
  discarded_ops: string[];
  reason: string | null;
}

interface RawRow extends Omit<ServerOverwriteRow, "discarded_ops"> {
  discarded_ops: string;
}

function uuid(): string {
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

async function record(input: {
  workOrderId: string;
  discardedOpIds: string[];
  reason?: string;
}): Promise<string> {
  const db = await getDatabase();
  const id = uuid();
  await db.runAsync(
    `INSERT INTO server_overwrites (id, work_order_id, detected_at, discarded_ops, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [
      id,
      input.workOrderId,
      new Date().toISOString(),
      JSON.stringify(input.discardedOpIds),
      input.reason ?? null,
    ]
  );
  return id;
}

async function listUnacknowledged(): Promise<ServerOverwriteRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<RawRow>(
    `SELECT * FROM server_overwrites WHERE acknowledged_at IS NULL ORDER BY detected_at DESC`
  );
  return rows.map((r) => ({ ...r, discarded_ops: JSON.parse(r.discarded_ops) }));
}

async function acknowledge(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE server_overwrites SET acknowledged_at = ? WHERE id = ?`,
    [new Date().toISOString(), id]
  );
}

async function acknowledgeAll(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE server_overwrites SET acknowledged_at = ? WHERE acknowledged_at IS NULL`,
    [new Date().toISOString()]
  );
}

async function countUnacknowledged(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM server_overwrites WHERE acknowledged_at IS NULL`
  );
  return row?.c ?? 0;
}

export const serverOverwritesRepo = {
  record,
  listUnacknowledged,
  acknowledge,
  acknowledgeAll,
  countUnacknowledged,
};
