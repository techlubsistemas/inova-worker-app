import { getDatabase } from "../sqlite";

export type SyncMetaKey =
  | "last_pull_at"
  | "last_push_at"
  | "data_version"
  | "bootstrap_completed_at";

async function get(key: SyncMetaKey): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string | null }>(
    `SELECT value FROM sync_meta WHERE key = ?`,
    [key]
  );
  return row?.value ?? null;
}

async function set(key: SyncMetaKey, value: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

async function getAll(): Promise<Record<string, string | null>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string | null }>(
    `SELECT key, value FROM sync_meta`
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

async function clear(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM sync_meta`);
}

export const syncMetaRepo = { get, set, getAll, clear };
