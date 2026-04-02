import type { RouteGroup, WorkOrderStatus } from "@/types/workOrder";
import { cn } from "@/utils/cn";
import { Calendar, Route } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { Text } from "./PoppinsText";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function getAggregateStatus(wos: RouteGroup["workOrders"]): WorkOrderStatus {
  if (wos.some((wo) => wo.status === "in_progress")) return "in_progress";
  if (wos.some((wo) => wo.status === "paused")) return "paused";
  if (wos.every((wo) => wo.status === "completed" || wo.status === "cancelled"))
    return "completed";
  return "pending";
}

function getStatusLabel(status: WorkOrderStatus): string {
  switch (status) {
    case "pending":
    case "scheduled":
      return "A fazer";
    case "in_progress":
      return "Em andamento";
    case "paused":
      return "Pausada";
    case "completed":
      return "Concluida";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

function getStatusBadgeStyle(status: WorkOrderStatus): {
  bg: string;
  text: string;
} {
  switch (status) {
    case "in_progress":
      return { bg: "bg-amber-100", text: "text-amber-700" };
    case "paused":
      return { bg: "bg-yellow-100", text: "text-yellow-700" };
    case "completed":
      return { bg: "bg-green-100", text: "text-green-700" };
    case "cancelled":
      return { bg: "bg-red-100", text: "text-red-700" };
    case "pending":
    case "scheduled":
    default:
      return { bg: "bg-primary-100", text: "text-primary-600" };
  }
}

interface RouteCardProps {
  data: RouteGroup;
  index: number;
  quantity: number;
  onPress: () => void;
}

export function RouteCard({ data, onPress }: RouteCardProps) {
  const routeCode = data.route.code || "";
  const routeName = data.route.name || data.route.code || "Rota";
  const count = data.workOrders.length;
  const firstDate = data.workOrders.reduce<string | null>((acc, wo) => {
    const d = wo.scheduledAt ?? null;
    if (!d) return acc;
    if (!acc) return d;
    return new Date(d) < new Date(acc) ? d : acc;
  }, null);
  const date = formatDate(firstDate);
  const aggregateStatus = getAggregateStatus(data.workOrders);
  const statusStyle = getStatusBadgeStyle(aggregateStatus);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="w-60 h-60 rounded-2xl overflow-hidden"
    >
      <View className="flex flex-col h-full bg-white border border-secondary-200 rounded-2xl p-4 justify-between">
        {/* Topo: Codigo rota + badge status */}
        <View className="flex flex-col gap-2">
          <View className="flex flex-row justify-between items-center">
            {routeCode ? (
              <View className="bg-secondary-500 px-2.5 py-1 rounded">
                <Text className="text-white text-xs font-poppins-bold">
                  {routeCode.toUpperCase()}
                </Text>
              </View>
            ) : (
              <View className="bg-secondary-500 px-2.5 py-1 rounded">
                <Text className="text-white text-xs font-poppins-bold">
                  ROTA
                </Text>
              </View>
            )}
            <View className={cn("px-2.5 py-1 rounded-full", statusStyle.bg)}>
              <Text
                className={cn(
                  "text-[10px] font-poppins-bold",
                  statusStyle.text,
                )}
              >
                {getStatusLabel(aggregateStatus)}
              </Text>
            </View>
          </View>

          {/* Nome da rota */}
          <Text
            className="text-primary-500 font-poppins-bold text-base leading-5"
            numberOfLines={2}
          >
            {routeName}
          </Text>

          {/* Qtd servicos */}
          <Text className="text-secondary-400 text-xs font-poppins-medium">
            {count} {count === 1 ? "servico" : "servicos"}
          </Text>
        </View>

        {/* Detalhes */}
        <View className="flex flex-col gap-1.5">
          <View className="flex flex-row gap-1.5 items-center">
            <Route color="#ED6842" size={14} />
            <Text className="text-secondary-500 text-xs">
              Toque para ver a rota
            </Text>
          </View>
          {date ? (
            <View className="flex flex-row gap-1.5 items-center">
              <Calendar color="#ED6842" size={14} />
              <Text className="text-secondary-500 text-xs">{date}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}
