import { cn } from "@/utils/cn";
import { useRouter } from "expo-router";
import { Calendar, MapPin } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { LinearGradientOrange } from "./linearGradientOrange";
import { Text } from "./PoppinsText";
import type { WorkOrderApi } from "@/types/workOrder";
import type { WorkOrderStatus } from "@/types/workOrder";

function getStatusLabel(status: WorkOrderStatus): string {
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
      return status;
  }
}

function getLocal(wo: WorkOrderApi): string {
  const firstService = wo.cipService ?? wo.cipServices?.[0];
  const equipment = firstService?.cip?.subset?.set?.equipment;
  if (!equipment) return "—";
  const sector = equipment.sector?.name;
  const area = equipment.sector?.area?.name;
  if (sector && area) return `${area} / ${sector}`;
  return sector ?? area ?? equipment.tag ?? "—";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

interface WorkOrderCardProps {
  data: WorkOrderApi;
  index: number;
  quantity: number;
  /** Quando definido, navega para a tela da ordem (ordem de 1 serviço) em vez do detalhe do WO. */
  orderId?: string;
}

export function WorkOrderCard({ data, index, quantity, orderId }: WorkOrderCardProps) {
  const router = useRouter();
  const firstService = data.cipService ?? data.cipServices?.[0];
  const isRouteWO = !!(data.routeId && data.route && (data.cipServices?.length ?? 0) > 1);
  const serviceName = isRouteWO
    ? `${data.route!.name ?? data.route!.code ?? "Rota"}`
    : (firstService?.serviceModel?.name ?? "Serviço");
  const subtitle = isRouteWO
    ? `${data.cipServices!.length} ${data.cipServices!.length === 1 ? "serviço" : "serviços"}`
    : (firstService?.cip?.subset?.set?.equipment?.name ??
       firstService?.cip?.subset?.set?.equipment?.tag ??
       "—");
  const tag = firstService?.cip?.subset?.set?.equipment?.tag ?? "—";
  const local = getLocal(data);
  const date = formatDate(data.scheduledAt);

  return (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: orderId ? "/order/[orderId]" : "/work-order/[id]",
          params: orderId ? { orderId } : { id: data.id },
        })
      }
      className={cn(
        "w-60 flex overflow-hidden h-60 rounded-2xl relative",
        index === 0 ? "ml-6" : "",
        index === quantity ? "mr-6" : ""
      )}
    >
      <LinearGradientOrange />
      <View className="absolute w-[80%] rounded-full h-[80%] -top-1/3 -right-1/3 bg-secondary-400 opacity-20 " />
      <View className="absolute w-[80%] rounded-full h-[80%] -bottom-1/3 -left-1/3 bg-secondary-400 opacity-20 " />
      <View className="flex flex-col h-full bg-gray-50 border border-gray-200 shadow-sm rounded-lg w-72 p-4 justify-between">
        <View className="flex flex-row justify-between items-start">
          <View className="flex flex-col gap-1">
            <Text className="text-primary-500 font-poppins-bold text-lg leading-6 w-52">
              {serviceName}
            </Text>
            <Text className="text-secondary-400 text-sm font-poppins-medium">
              {subtitle}
            </Text>
            {!isRouteWO && tag ? (
              <View className="bg-secondary-100 self-start px-2 py-0.5 rounded">
                <Text className="text-secondary-500 text-xs font-poppins-bold">
                  {tag}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View className="flex flex-col gap-2 mt-4">
          <View className="flex flex-row gap-2 items-center">
            <MapPin color={"#ED6842"} size={16} />
            <Text className="text-secondary-500 text-sm">{local}</Text>
          </View>
          <View className="flex flex-row gap-2 items-center">
            <Calendar color={"#ED6842"} size={16} />
            <Text className="text-secondary-500 text-sm">{date}</Text>
          </View>
        </View>

        <View className="flex flex-row justify-between items-center mt-2">
          <View className="bg-primary-100 px-3 py-1 rounded-full">
            <Text className="text-primary-600 text-xs font-poppins-bold">
              {getStatusLabel(data.status)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
