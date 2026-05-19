import type { SQLiteDatabase } from "expo-sqlite";
import { migration001Init } from "./001_init";

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => Promise<void>;
}

const MIGRATIONS: Migration[] = [migration001Init];

async function ensureSchemaVersionTable(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

async function getCurrentVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ version: number | null }>(
    "SELECT MAX(version) as version FROM schema_version"
  );
  return row?.version ?? 0;
}

export async function runMigrations(db: SQLiteDatabase): Promise<{
  fromVersion: number;
  toVersion: number;
  applied: number[];
}> {
  await ensureSchemaVersionTable(db);
  const fromVersion = await getCurrentVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > fromVersion).sort(
    (a, b) => a.version - b.version
  );

  const applied: number[] = [];
  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      await migration.up(db);
      await db.runAsync(
        "INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)",
        [migration.version, migration.name, new Date().toISOString()]
      );
    });
    applied.push(migration.version);
  }

  return {
    fromVersion,
    toVersion: applied.length > 0 ? applied[applied.length - 1] : fromVersion,
    applied,
  };
}
