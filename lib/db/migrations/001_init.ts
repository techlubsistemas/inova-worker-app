import type { SQLiteDatabase } from "expo-sqlite";
import type { Migration } from "./runner";

const SYNC_COLUMNS = `
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  _sync_status TEXT NOT NULL DEFAULT 'synced',
  _local_only INTEGER NOT NULL DEFAULT 0,
  _base_updated_at TEXT,
  _last_local_change_at TEXT
`;

const SQL = `
-- =====================================================
-- ENTIDADES DE DOMÍNIO (espelham o schema do inova-api)
-- Coluna "data" guarda o JSON completo do servidor;
-- colunas explícitas só existem para indexação/joins.
-- =====================================================

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY NOT NULL,
  cpf TEXT,
  name TEXT,
  company_id TEXT,
  ${SYNC_COLUMNS}
);

CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  company_id TEXT,
  ${SYNC_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_areas_company ON areas(company_id);

CREATE TABLE IF NOT EXISTS sectors (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  area_id TEXT,
  company_id TEXT,
  ${SYNC_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_sectors_area ON sectors(area_id);

CREATE TABLE IF NOT EXISTS equipments (
  id TEXT PRIMARY KEY NOT NULL,
  tag TEXT,
  name TEXT,
  sector_id TEXT,
  company_id TEXT,
  ${SYNC_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_equipments_sector ON equipments(sector_id);

CREATE TABLE IF NOT EXISTS cips (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  company_id TEXT,
  ${SYNC_COLUMNS}
);

CREATE TABLE IF NOT EXISTS cip_services (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  cip_id TEXT,
  company_id TEXT,
  ${SYNC_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_cip_services_cip ON cip_services(cip_id);

CREATE TABLE IF NOT EXISTS work_instructions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  company_id TEXT,
  ${SYNC_COLUMNS}
);

CREATE TABLE IF NOT EXISTS epis (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  company_id TEXT,
  ${SYNC_COLUMNS}
);

CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  company_id TEXT,
  ${SYNC_COLUMNS}
);

CREATE TABLE IF NOT EXISTS service_problem_reasons (
  id TEXT PRIMARY KEY NOT NULL,
  description TEXT,
  company_id TEXT,
  ${SYNC_COLUMNS}
);

-- =====================================================
-- WORK ORDERS e suas tabelas auxiliares
-- =====================================================

CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY NOT NULL,
  code INTEGER,
  status TEXT,
  company_id TEXT,
  cip_id TEXT,
  equipment_id TEXT,
  area_id TEXT,
  sector_id TEXT,
  route_id TEXT,
  scheduled_at TEXT,
  executed_at TEXT,
  completed_at TEXT,
  cancellation_reason TEXT,
  visibility_mode TEXT,
  ${SYNC_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_route ON work_orders(route_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_equipment ON work_orders(equipment_id);

-- Espelho do WorkOrderTimeEntry (start/stop por intervalo).
CREATE TABLE IF NOT EXISTS work_order_time_entries (
  id TEXT PRIMARY KEY NOT NULL,
  work_order_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  stopped_at TEXT,
  ${SYNC_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_work_order_time_entries_wo ON work_order_time_entries(work_order_id);

-- Espelho do WorkOrderCipService (link table com status local).
-- Compound key (work_order_id, cip_service_id) — usamos id sintético "<woId>:<svcId>".
CREATE TABLE IF NOT EXISTS work_order_cip_services (
  id TEXT PRIMARY KEY NOT NULL,
  work_order_id TEXT NOT NULL,
  cip_service_id TEXT NOT NULL,
  status TEXT,
  executed_at TEXT,
  completed_at TEXT,
  cancellation_reason TEXT,
  cancellation_reason_id TEXT,
  ${SYNC_COLUMNS}
);
CREATE INDEX IF NOT EXISTS idx_wocs_wo ON work_order_cip_services(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wocs_svc ON work_order_cip_services(cip_service_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wocs_pair ON work_order_cip_services(work_order_id, cip_service_id);

-- =====================================================
-- INFRAESTRUTURA DE SYNC
-- =====================================================

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  op_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  base_updated_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'syncing', 'failed', 'done', 'dead', 'overwritten')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_outbox_entity ON outbox(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_outbox_created ON outbox(created_at);

-- Metadados de sync (chave/valor): last_pull_at, last_push_at, data_version, etc.
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

-- Lista de OS cujas alterações offline foram sobrescritas pelo servidor (server-wins).
-- O usuário precisa visualizar e dispensar (ack) cada uma.
CREATE TABLE IF NOT EXISTS server_overwrites (
  id TEXT PRIMARY KEY NOT NULL,
  work_order_id TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  acknowledged_at TEXT,
  discarded_ops TEXT NOT NULL,
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_server_overwrites_ack ON server_overwrites(acknowledged_at);

-- Configuração de auth offline por worker (PIN/biometria, ver Fase 6).
CREATE TABLE IF NOT EXISTS auth_local (
  worker_id TEXT PRIMARY KEY NOT NULL,
  pin_hash TEXT,
  biometric_enabled INTEGER NOT NULL DEFAULT 0,
  token_cached_until TEXT,
  updated_at TEXT NOT NULL
);
`;

export const migration001Init: Migration = {
  version: 1,
  name: "001_init",
  async up(db: SQLiteDatabase) {
    await db.execAsync(SQL);
  },
};
