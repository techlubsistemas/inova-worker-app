export type SyncStatus =
  | "synced"
  | "pending"
  | "conflict"
  | "server_overwritten";

export interface BaseRow {
  id: string;
  data: string;
  created_at: string;
  updated_at: string | null;
  _sync_status: SyncStatus;
  _local_only: number;
  _base_updated_at: string | null;
  _last_local_change_at: string | null;
}

export interface ParsedRow<T> extends Omit<BaseRow, "data"> {
  data: T;
}

export function parseRow<T>(row: BaseRow): ParsedRow<T> {
  return { ...row, data: JSON.parse(row.data) as T };
}
