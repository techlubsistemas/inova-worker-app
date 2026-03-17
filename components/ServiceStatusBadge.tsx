import type { WorkOrderStatus } from "@/types/workOrder";
import { View } from "react-native";
import { Text } from "./PoppinsText";

function getStatusLabel(status: WorkOrderStatus | undefined): string {
  switch (status) {
    case "pending":
    case "scheduled":
      return "A fazer";
    case "in_progress":
      return "Em andamento";
    case "completed":
      return "Concluída";
    case "cancelled":
      return "Cancelada";
    default:
      return "A fazer";
  }
}

function getStatusStyles(status: WorkOrderStatus | undefined): {
  bg: string;
  text: string;
} {
  switch (status) {
    case "completed":
      return { bg: "bg-green-100", text: "text-green-800" };
    case "in_progress":
      return { bg: "bg-amber-100", text: "text-amber-800" };
    case "cancelled":
      return { bg: "bg-red-100", text: "text-red-800" };
    case "pending":
    case "scheduled":
    default:
      return { bg: "bg-gray-100", text: "text-gray-600" };
  }
}

export interface ServiceStatusBadgeProps {
  status: WorkOrderStatus | undefined;
  /** Label alternativo (ex.: "Em execução" para WO). Se não passar, usa o padrão do status. */
  label?: string;
}

export function ServiceStatusBadge({ status, label }: ServiceStatusBadgeProps) {
  const styles = getStatusStyles(status);
  const text = label ?? getStatusLabel(status);
  return (
    <View className={`rounded-full px-3 py-1 ${styles.bg}`}>
      <Text className={`text-xs font-poppins-bold ${styles.text}`}>{text}</Text>
    </View>
  );
}
