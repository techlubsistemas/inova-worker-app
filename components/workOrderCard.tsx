import { cn } from "@/utils/cn";
import { Calendar, MapPin, Pause } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { Text } from "./PoppinsText";
import type { WorkOrderApi, WorkOrderStatus } from "@/types/workOrder";

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

function getLocal(wo: WorkOrderApi): string {
  const firstService = wo.cipService ?? wo.cipServices?.[0];
  const equipment = firstService?.cip?.subset?.set?.equipment;
  if (!equipment) return "";
  const sector = equipment.sector?.name;
  const area = equipment.sector?.area?.name;
  if (sector && area) return `${area} / ${sector}`;
  return sector ?? area ?? "";
}

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

/** Formata o codigo sequencial da WO: "OS 00000123". */
function formatWoCode(code: number | null | undefined): string {
  if (code == null) return "OS";
  return `OS ${String(code).padStart(8, "0")}`;
}

interface WorkOrderCardProps {
  data: WorkOrderApi;
  index: number;
  quantity: number;
  onPress: () => void;
}

export function WorkOrderCard({ data, onPress }: WorkOrderCardProps) {
  const firstService = data.cipService ?? data.cipServices?.[0];
  const isRouteWO = !!(
    data.routeId &&
    data.route &&
    (data.cipServices?.length ?? 0) > 1
  );

  // Hierarquia: 1) Codigo WO  2) Nome rota/servico  3) Detalhes
  const woCode = formatWoCode(data.code);
  const title = isRouteWO
    ? (data.route!.name || data.route!.code || "Rota")
    : (firstService?.serviceModel?.name ?? "Servico");
  const equipmentName =
    firstService?.cip?.subset?.set?.equipment?.name ?? "";
  const equipmentTag =
    firstService?.cip?.subset?.set?.equipment?.tag ?? "";
  const local = getLocal(data);
  const date = formatDate(data.scheduledAt);
  const serviceCount = data.cipServices?.length ?? (data.cipService ? 1 : 0);
  const statusStyle = getStatusBadgeStyle(data.status);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="w-60 h-60 rounded-2xl overflow-hidden"
    >
      <View className="flex flex-col h-full bg-white border border-gray-200 rounded-2xl p-4 justify-between">
        {/* Topo: Codigo WO + badge status */}
        <View className="flex flex-col gap-2">
          <View className="flex flex-row justify-between items-center">
            <View className="bg-secondary-500 px-2.5 py-1 rounded">
              <Text className="text-white text-xs font-poppins-bold">
                {woCode}
              </Text>
            </View>
            <View
              className={cn(
                "px-2.5 py-1 rounded-full flex-row items-center gap-1",
                statusStyle.bg,
              )}
            >
              {data.status === "paused" && (
                <Pause color="#a16207" size={10} />
              )}
              <Text
                className={cn(
                  "text-[10px] font-poppins-bold",
                  statusStyle.text,
                )}
              >
                {getStatusLabel(data.status)}
              </Text>
            </View>
          </View>

          {/* Nome do servico/rota */}
          <Text
            className="text-primary-500 font-poppins-bold text-base leading-5"
            numberOfLines={2}
          >
            {title}
          </Text>

          {/* Equipamento + tag */}
          {(equipmentName || equipmentTag) && (
            <View className="flex flex-row items-center gap-1.5">
              {equipmentTag ? (
                <View className="bg-secondary-100 px-1.5 py-0.5 rounded">
                  <Text className="text-secondary-500 text-[10px] font-poppins-bold">
                    {equipmentTag}
                  </Text>
                </View>
              ) : null}
              {equipmentName ? (
                <Text
                  className="text-secondary-400 text-xs font-poppins-medium flex-1"
                  numberOfLines={1}
                >
                  {equipmentName}
                </Text>
              ) : null}
            </View>
          )}

          {/* Qtd servicos (se rota) */}
          {isRouteWO && serviceCount > 1 && (
            <Text className="text-secondary-400 text-xs font-poppins-medium">
              {serviceCount} servicos
            </Text>
          )}
        </View>

        {/* Detalhes: local + data */}
        <View className="flex flex-col gap-1.5">
          {local ? (
            <View className="flex flex-row gap-1.5 items-center">
              <MapPin color="#ED6842" size={14} />
              <Text
                className="text-secondary-500 text-xs flex-1"
                numberOfLines={1}
              >
                {local}
              </Text>
            </View>
          ) : null}
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
