import { API_URL } from "@/context/AuthContext";
import { dbEvents } from "@/lib/db/dbEvents";
import { outboxRepo } from "@/lib/db/repositories/outboxRepo";
import { workOrdersRepo } from "@/lib/db/repositories/workOrdersRepo";
import type {
  CipServiceInWorkOrder,
  WorkOrderApi,
  WorkOrdersResponse,
  WorkOrderStatus,
} from "@/types/workOrder";
import axios from "axios";

/**
 * Mantida por compat. Hoje o SyncContext já popula o SQLite via bootstrap,
 * então o WorkOrdersContext lê do DB local. Esta função é usada como
 * fallback durante migração (ex.: hooks/useWorkOrders.ts antigo).
 */
export async function fetchMyWorkOrders(): Promise<WorkOrdersResponse> {
  const { data } = await axios.get<WorkOrdersResponse>(
    `${API_URL}/work-order/worker/me`
  );
  return data;
}

export interface UpdateWorkOrderPayload {
  status?: WorkOrderStatus;
  scheduledAt?: string | null;
  executedAt?: string | null;
  completedAt?: string | null;
  cancellationReason?: string | null;
}

export interface UpdateWorkOrderServicePayload {
  status?: WorkOrderStatus;
  executedAt?: string | null;
  completedAt?: string | null;
  cancellationReason?: string | null;
  cancellationReasonId?: string | null;
}

/**
 * Atualiza status da WO (start, finish, cancel). Aplica mutação local
 * imediatamente (otimista) e enfileira a operação no outbox para sync
 * posterior. Compatível offline.
 *
 * - status='in_progress' + executedAt → op 'start'
 * - status='completed' + completedAt → op 'finish'
 * - status='cancelled' + cancellationReason → op 'cancel'
 */
export async function updateWorkOrderStatus(
  workOrderId: string,
  payload: UpdateWorkOrderPayload
): Promise<void> {
  const opType =
    payload.status === "in_progress"
      ? "start"
      : payload.status === "completed"
        ? "finish"
        : payload.status === "cancelled"
          ? "cancel"
          : null;

  if (!opType) {
    throw new Error(
      `updateWorkOrderStatus: status inválido para op (${payload.status}).`
    );
  }

  const existing = await workOrdersRepo.findById(workOrderId);
  if (!existing) {
    throw new Error(
      `WorkOrder ${workOrderId} não está disponível offline. Sincronize primeiro.`
    );
  }

  await workOrdersRepo.applyLocalMutation(workOrderId, (current) => ({
    ...current,
    status: payload.status ?? current.status,
    scheduledAt: payload.scheduledAt ?? current.scheduledAt ?? null,
    executedAt: payload.executedAt ?? current.executedAt ?? null,
    completedAt: payload.completedAt ?? current.completedAt ?? null,
    cancellationReason:
      payload.cancellationReason ?? current.cancellationReason ?? null,
  }));

  await outboxRepo.enqueue({
    entity: "workOrder",
    entityId: workOrderId,
    opType,
    payload,
    baseUpdatedAt: existing._base_updated_at,
  });

  dbEvents.emitDataChanged();
}

/**
 * Atualiza status de um serviço dentro da WO (no V1, usado apenas para
 * cancelamento com motivo — "reportar anomalia"). A marcação como concluído
 * sem anomalia é implícita: o servidor auto-completa serviços pendentes
 * quando a WO inteira é finalizada.
 */
export async function updateWorkOrderServiceStatus(
  workOrderId: string,
  cipServiceId: string,
  payload: UpdateWorkOrderServicePayload
): Promise<void> {
  const opType =
    payload.status === "cancelled"
      ? "cancel"
      : payload.status === "completed"
        ? "complete"
        : null;

  if (!opType) {
    throw new Error(
      `updateWorkOrderServiceStatus: status inválido (${payload.status}).`
    );
  }

  const existing = await workOrdersRepo.findById(workOrderId);
  if (!existing) {
    throw new Error(
      `WorkOrder ${workOrderId} não está disponível offline. Sincronize primeiro.`
    );
  }

  // Atualiza o serviço dentro do JSON da WO (otimismo + leitura subsequente).
  await workOrdersRepo.applyLocalMutation(workOrderId, (current) => {
    const services = (current.cipServices as CipServiceInWorkOrder[] | undefined) ?? [];
    const updatedServices = services.map((svc) => {
      if (svc.id !== cipServiceId) return svc;
      return {
        ...svc,
        status: payload.status ?? svc.status,
        executedAt: payload.executedAt ?? svc.executedAt ?? null,
        completedAt: payload.completedAt ?? svc.completedAt ?? null,
        cancellationReason:
          payload.cancellationReason ?? svc.cancellationReason ?? null,
        cancellationReasonId:
          payload.cancellationReasonId ?? svc.cancellationReasonId ?? null,
      };
    });
    return { ...current, cipServices: updatedServices };
  });

  await outboxRepo.enqueue({
    entity: "cipService",
    entityId: `${workOrderId}:${cipServiceId}`,
    opType,
    payload: { workOrderId, cipServiceId, ...payload },
    baseUpdatedAt: existing._base_updated_at,
  });

  dbEvents.emitDataChanged();
}

/**
 * Pausa a WO. Captura `pausedAt` no cliente (necessário para offline; o servidor
 * atual usa now() no endpoint /pause, mas o batch endpoint da Fase 4 vai aceitar
 * o timestamp do cliente para reconstruir os intervalos do WorkOrderTimeEntry corretamente).
 */
export async function pauseWorkOrder(workOrderId: string): Promise<void> {
  const existing = await workOrdersRepo.findById(workOrderId);
  if (!existing) {
    throw new Error(
      `WorkOrder ${workOrderId} não está disponível offline. Sincronize primeiro.`
    );
  }

  const pausedAt = new Date().toISOString();
  await workOrdersRepo.applyLocalMutation(workOrderId, (current) => ({
    ...current,
    status: "paused" as WorkOrderStatus,
  }));

  await outboxRepo.enqueue({
    entity: "workOrder",
    entityId: workOrderId,
    opType: "pause",
    payload: { pausedAt },
    baseUpdatedAt: existing._base_updated_at,
  });

  dbEvents.emitDataChanged();
}

export async function resumeWorkOrder(workOrderId: string): Promise<void> {
  const existing = await workOrdersRepo.findById(workOrderId);
  if (!existing) {
    throw new Error(
      `WorkOrder ${workOrderId} não está disponível offline. Sincronize primeiro.`
    );
  }

  const resumedAt = new Date().toISOString();
  await workOrdersRepo.applyLocalMutation(workOrderId, (current) => ({
    ...current,
    status: "in_progress" as WorkOrderStatus,
  }));

  await outboxRepo.enqueue({
    entity: "workOrder",
    entityId: workOrderId,
    opType: "resume",
    payload: { resumedAt },
    baseUpdatedAt: existing._base_updated_at,
  });

  dbEvents.emitDataChanged();
}

/**
 * Re-export para compat com telas que importavam o tipo daqui.
 */
export type { WorkOrderApi };
