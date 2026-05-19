import { createGenericRepo } from "./genericRepo";

// Repos genéricos para entidades read-only no worker-app.
// Tipos `any`-like (Record<string, unknown>) por enquanto; tipagem forte
// vem na Fase 2 quando o bootstrap definir o contrato exato com o servidor.

export const workersRepo = createGenericRepo<Record<string, unknown>>({
  table: "workers",
  indexedColumns: ["cpf", "name", "company_id"],
});

export const areasRepo = createGenericRepo<Record<string, unknown>>({
  table: "areas",
  indexedColumns: ["name", "company_id"],
});

export const sectorsRepo = createGenericRepo<Record<string, unknown>>({
  table: "sectors",
  indexedColumns: ["name", "area_id", "company_id"],
});

export const equipmentsRepo = createGenericRepo<Record<string, unknown>>({
  table: "equipments",
  indexedColumns: ["tag", "name", "sector_id", "company_id"],
});

export const cipsRepo = createGenericRepo<Record<string, unknown>>({
  table: "cips",
  indexedColumns: ["name", "company_id"],
});

export const cipServicesRepo = createGenericRepo<Record<string, unknown>>({
  table: "cip_services",
  indexedColumns: ["name", "cip_id", "company_id"],
});

export const workInstructionsRepo = createGenericRepo<Record<string, unknown>>({
  table: "work_instructions",
  indexedColumns: ["name", "company_id"],
});

export const episRepo = createGenericRepo<Record<string, unknown>>({
  table: "epis",
  indexedColumns: ["name", "company_id"],
});

export const materialsRepo = createGenericRepo<Record<string, unknown>>({
  table: "materials",
  indexedColumns: ["name", "company_id"],
});

export const serviceProblemReasonsRepo = createGenericRepo<
  Record<string, unknown>
>({
  table: "service_problem_reasons",
  indexedColumns: ["description", "company_id"],
});

export { workOrdersRepo } from "./workOrdersRepo";
export { outboxRepo } from "./outboxRepo";
export { syncMetaRepo } from "./syncMetaRepo";
export { serverOverwritesRepo } from "./serverOverwritesRepo";
