import { getDatabase } from "../sqlite";

export interface AuthLocalRow {
  worker_id: string;
  pin_hash: string | null;
  biometric_enabled: number;
  token_cached_until: string | null;
  updated_at: string;
}

async function get(workerId: string): Promise<AuthLocalRow | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AuthLocalRow>(
    `SELECT * FROM auth_local WHERE worker_id = ?`,
    [workerId]
  );
  return row ?? null;
}

async function setPin(workerId: string, pinHash: string | null): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO auth_local (worker_id, pin_hash, biometric_enabled, updated_at)
     VALUES (?, ?, COALESCE((SELECT biometric_enabled FROM auth_local WHERE worker_id = ?), 0), ?)
     ON CONFLICT(worker_id) DO UPDATE SET pin_hash = excluded.pin_hash, updated_at = excluded.updated_at`,
    [workerId, pinHash, workerId, now]
  );
}

async function setBiometric(workerId: string, enabled: boolean): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO auth_local (worker_id, biometric_enabled, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(worker_id) DO UPDATE SET biometric_enabled = excluded.biometric_enabled, updated_at = excluded.updated_at`,
    [workerId, enabled ? 1 : 0, now]
  );
}

async function setTokenCachedUntil(
  workerId: string,
  iso: string | null
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO auth_local (worker_id, token_cached_until, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(worker_id) DO UPDATE SET token_cached_until = excluded.token_cached_until, updated_at = excluded.updated_at`,
    [workerId, iso, now]
  );
}

async function clear(workerId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM auth_local WHERE worker_id = ?`, [workerId]);
}

export const authLocalRepo = {
  get,
  setPin,
  setBiometric,
  setTokenCachedUntil,
  clear,
};
