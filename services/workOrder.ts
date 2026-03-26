import { API_URL } from "@/context/AuthContext";
import type {
  WorkOrderApi,
  WorkOrdersResponse,
  WorkOrderStatus,
} from "@/types/workOrder";
import axios from "axios";

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

export async function updateWorkOrderStatus(
  workOrderId: string,
  payload: UpdateWorkOrderPayload
): Promise<void> {
  await axios.put(
    `${API_URL}/work-order/single/${workOrderId}`,
    payload
  );
}

export interface UpdateWorkOrderServicePayload {
  status?: WorkOrderStatus;
  executedAt?: string | null;
  completedAt?: string | null;
  cancellationReason?: string | null;
  cancellationReasonId?: string | null;
}

export async function updateWorkOrderServiceStatus(
  workOrderId: string,
  cipServiceId: string,
  payload: UpdateWorkOrderServicePayload
): Promise<void> {
  await axios.put(
    `${API_URL}/work-order/single/${workOrderId}/service/${cipServiceId}`,
    payload
  );
}

export async function pauseWorkOrder(workOrderId: string): Promise<void> {
  await axios.put(`${API_URL}/work-order/single/${workOrderId}/pause`);
}

export async function resumeWorkOrder(workOrderId: string): Promise<void> {
  await axios.put(`${API_URL}/work-order/single/${workOrderId}/resume`);
}
