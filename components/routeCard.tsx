import { cn } from "@/utils/cn";
import { useRouter } from "expo-router";
import { Calendar, Route } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { LinearGradientOrange } from "./linearGradientOrange";
import { Text } from "./PoppinsText";
import type { RouteGroup } from "@/types/workOrder";

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

interface RouteCardProps {
  data: RouteGroup;
  index: number;
  quantity: number;
}

export function RouteCard({ data, index, quantity }: RouteCardProps) {
  const router = useRouter();
  const routeName = data.route.name || data.route.code || "Rota";
  const count = data.workOrders.length;
  const firstDate = data.workOrders.reduce<string | null>((acc, wo) => {
    const d = wo.scheduledAt ?? null;
    if (!d) return acc;
    if (!acc) return d;
    return new Date(d) < new Date(acc) ? d : acc;
  }, null);
  const date = formatDate(firstDate);

  return (
    <TouchableOpacity
      onPress={() =>
        router.push({
          pathname: "/route/[routeId]",
          params: { routeId: data.routeId },
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
      <View className="flex flex-col h-full bg-gray-50 border border-secondary-300 shadow-sm rounded-lg w-72 p-4 justify-between">
        <View className="flex flex-row justify-between items-start">
          <View className="flex flex-col gap-1">
            <View className="flex-row items-center gap-2">
              <View className="bg-secondary-500 px-2 py-0.5 rounded">
                <Text className="text-white text-xs font-poppins-bold">Ordem de serviço</Text>
              </View>
            </View>
            <Text className="text-primary-500 font-poppins-bold text-lg leading-6 w-52">
              {routeName}
            </Text>
            <Text className="text-secondary-400 text-sm font-poppins-medium">
              {count} {count === 1 ? "serviço" : "serviços"}
            </Text>
          </View>
        </View>

        <View className="flex flex-col gap-2 mt-4">
          <View className="flex flex-row gap-2 items-center">
            <Route color={"#ED6842"} size={16} />
            <Text className="text-secondary-500 text-sm">
              Toque para iniciar a execução
            </Text>
          </View>
          <View className="flex flex-row gap-2 items-center">
            <Calendar color={"#ED6842"} size={16} />
            <Text className="text-secondary-500 text-sm">{date}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
