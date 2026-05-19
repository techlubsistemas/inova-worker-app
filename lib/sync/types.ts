/**
 * Shape do payload retornado por GET /sync/worker-bootstrap.
 * Mantido propositadamente solto (Record<string, unknown>) para os arrays —
 * cada entidade carrega o que o backend mandar, e o repo guarda o JSON inteiro.
 */
export interface WorkerBootstrapSnapshot {
  schemaVersion: number;
  serverTime: string;
  worker: {
    id: string;
    name: string;
    cpf: string;
    companyId: string | null;
  };
  workOrders: BootstrapEntity[];
  areas: BootstrapEntity[];
  sectors: BootstrapEntity[];
  equipments: BootstrapEntity[];
  cips: BootstrapEntity[];
  cipServices: BootstrapEntity[];
  workInstructions: BootstrapEntity[];
  epis: BootstrapEntity[];
  materials: BootstrapEntity[];
  serviceProblemReasons: BootstrapEntity[];
}

export interface BootstrapEntity extends Record<string, unknown> {
  id: string;
  /** Pode vir como string ISO ou Date serializada — tratar como string. */
  updatedAt?: string | null;
  createdAt?: string | null;
}
