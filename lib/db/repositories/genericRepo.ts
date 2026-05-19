import type { SQLiteDatabase } from "expo-sqlite";
import { getDatabase } from "../sqlite";
import { BaseRow, ParsedRow, parseRow } from "./types";

export interface GenericRepoConfig {
  table: string;
  /** Colunas indexáveis além de `id` que são extraídas do payload e gravadas em colunas dedicadas. */
  indexedColumns?: string[];
}

export interface UpsertInput<T extends Record<string, unknown>> {
  id: string;
  data: T;
  /** updatedAt do servidor — usado como referência de LWW. */
  serverUpdatedAt?: string | null;
  createdAt?: string;
  syncStatus?: "synced" | "pending";
}

/**
 * Repo genérico para tabelas de domínio que seguem o padrão:
 *   id PK + colunas indexáveis + data JSON + sync columns
 *
 * Usado para entidades read-only no worker-app (workers, areas, sectors,
 * equipments, cips, cipServices, workInstructions, epis, materials,
 * serviceProblemReasons). Para work_orders e tabelas com mutação local,
 * use repos especializados.
 */
export function createGenericRepo<T extends Record<string, unknown>>(
  config: GenericRepoConfig
) {
  const { table, indexedColumns = [] } = config;

  async function findById(id: string): Promise<ParsedRow<T> | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<BaseRow>(
      `SELECT * FROM ${table} WHERE id = ?`,
      [id]
    );
    return row ? parseRow<T>(row) : null;
  }

  async function findAll(): Promise<ParsedRow<T>[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<BaseRow>(`SELECT * FROM ${table}`);
    return rows.map((r) => parseRow<T>(r));
  }

  async function findWhere(
    where: string,
    params: unknown[] = []
  ): Promise<ParsedRow<T>[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<BaseRow>(
      `SELECT * FROM ${table} WHERE ${where}`,
      params as never[]
    );
    return rows.map((r) => parseRow<T>(r));
  }

  /**
   * Upsert vindo do servidor (após pull): aplica server-wins para linhas
   * com `_sync_status = 'synced'`; preserva mutação local se `_sync_status = 'pending'`
   * (a decisão de descarte fica para o sync engine, não aqui).
   */
  async function upsertFromServer(input: UpsertInput<T>): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const indexedValues = indexedColumns.map((col) => {
      const key = col as keyof T;
      const v = input.data[key];
      return v === undefined ? null : v;
    });

    const columnNames = ["id", ...indexedColumns, "data", "created_at", "updated_at", "_sync_status", "_base_updated_at"];
    const placeholders = columnNames.map(() => "?").join(", ");
    const updateSet = columnNames
      .filter((c) => c !== "id" && c !== "created_at")
      .map((c) => `${c} = excluded.${c}`)
      .join(", ");

    await db.runAsync(
      `INSERT INTO ${table} (${columnNames.join(", ")})
       VALUES (${placeholders})
       ON CONFLICT(id) DO UPDATE SET ${updateSet}`,
      [
        input.id,
        ...indexedValues,
        JSON.stringify(input.data),
        input.createdAt ?? now,
        input.serverUpdatedAt ?? now,
        input.syncStatus ?? "synced",
        input.serverUpdatedAt ?? null,
      ] as never[]
    );
  }

  async function deleteById(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
  }

  async function deleteAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`DELETE FROM ${table}`);
  }

  async function count(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) as c FROM ${table}`
    );
    return row?.c ?? 0;
  }

  return {
    table,
    findById,
    findAll,
    findWhere,
    upsertFromServer,
    deleteById,
    deleteAll,
    count,
  };
}

export type GenericRepo<T extends Record<string, unknown>> = ReturnType<
  typeof createGenericRepo<T>
>;

/**
 * Helper para chamadas avançadas (joins, agregações) — devolve a instância do DB.
 * Use com moderação; prefira métodos do repo.
 */
export async function withDb<R>(
  fn: (db: SQLiteDatabase) => Promise<R>
): Promise<R> {
  const db = await getDatabase();
  return fn(db);
}
