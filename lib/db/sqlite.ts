import * as SQLite from "expo-sqlite";

const DB_NAME = "inova-worker.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let dbInstance: SQLite.SQLiteDatabase | null = null;

async function openAndConfigure(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  dbInstance = db;
  return db;
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndConfigure();
  }
  return dbPromise;
}

export function getDatabaseSync(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    throw new Error(
      "Banco local ainda não inicializado. Aguarde initDatabase() em _layout.tsx."
    );
  }
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    dbPromise = null;
  }
}

export async function deleteLocalDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
    } catch (err) {
      console.warn("[sqlite] erro ao fechar antes de apagar:", err);
    }
    dbInstance = null;
    dbPromise = null;
  }
  await SQLite.deleteDatabaseAsync(DB_NAME);
}
