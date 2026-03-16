export type WorkOrderStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface CipServiceInWorkOrder {
  id: string;
  serviceModel?: { id: string; name: string } | null;
  team?: { id: string; name: string } | null;
  cip?: {
    subset?: {
      set?: {
        equipment?: {
          id: string;
          name: string | null;
          tag: string;
          sector?: { name: string; area?: { name: string } } | null;
        } | null;
      } | null;
    } | null;
  } | null;
  /** Status do serviço dentro da ordem (ordens de rota). */
  status?: WorkOrderStatus;
  executedAt?: string | null;
  completedAt?: string | null;
  cancellationReason?: string | null;
  cancellationReasonId?: string | null;
  cancellationReasonName?: string | null;
}

export interface WorkOrderApi {
  id: string;
  cipServiceId: string | null;
  routeId: string | null;
  status: WorkOrderStatus;
  scheduledAt: string | null;
  executedAt: string | null;
  completedAt: string | null;
  cancellationReason?: string | null;
  route?: {
    id: string;
    name: string;
    code: string;
    isTemporary: boolean;
  } | null;
  /** Serviço único (legado ou WO de serviço avulso). */
  cipService?: CipServiceInWorkOrder | null;
  /** Lista de serviços da WO (1 para avulso, N para rota). */
  cipServices?: CipServiceInWorkOrder[];
  assignedWorkerIds?: string[];
}

export interface WorkOrdersResponse {
  workOrders: WorkOrderApi[];
}

/** Agrupamento de WOs por rota (todas com o mesmo routeId). */
export interface RouteGroup {
  type: "route";
  routeId: string;
  route: NonNullable<WorkOrderApi["route"]>;
  workOrders: WorkOrderApi[];
}

/** Item da lista: rota ou WO individual. */
export type WorkOrderListItem =
  | RouteGroup
  | { type: "wo"; workOrder: WorkOrderApi };
