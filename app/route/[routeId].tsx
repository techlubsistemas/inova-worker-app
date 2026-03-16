import { Text } from "@/components/PoppinsText";
import { useStartedOrders } from "@/context/StartedOrdersContext";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import type { WorkOrderApi, CipServiceInWorkOrder } from "@/types/workOrder";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CheckCircle, ListTodo } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import {
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

function getStatusLabel(status: WorkOrderApi["status"]): string {
  switch (status) {
    case "pending":
    case "scheduled":
      return "A fazer";
    case "in_progress":
      return "Em execução";
    case "completed":
      return "Concluída";
    case "cancelled":
      return "Cancelada";
    default:
      return status;
  }
}

function getLocalFromService(service: CipServiceInWorkOrder | undefined): string {
  const equipment = service?.cip?.subset?.set?.equipment;
  if (!equipment) return "—";
  const sector = equipment.sector?.name;
  const area = equipment.sector?.area?.name;
  if (sector && area) return `${area} / ${sector}`;
  return sector ?? area ?? equipment.tag ?? "—";
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** Extrai lista plana de serviços a partir das WOs da rota (cipService ou cipServices). */
function collectServicesFromWOs(routeWOs: WorkOrderApi[]): CipServiceInWorkOrder[] {
  const list: CipServiceInWorkOrder[] = [];
  for (const wo of routeWOs) {
    if (wo.cipServices?.length) {
      list.push(...wo.cipServices);
    } else if (wo.cipService) {
      list.push(wo.cipService);
    }
  }
  return list;
}

export default function RouteDetailScreen() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const router = useRouter();
  const { workOrders, loading, refetch } = useWorkOrders();
  const { isRouteStarted, startRoute, finishRoute } = useStartedOrders();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const routeWOs = useMemo(() => {
    if (!routeId) return [];
    return workOrders.filter((wo) => wo.routeId === routeId);
  }, [workOrders, routeId]);

  const routeInfo = routeWOs[0]?.route;
  const started = routeId ? isRouteStarted(routeId) : false;
  const allFinished =
    routeWOs.length > 0 &&
    routeWOs.every((wo) => wo.status === "completed" || wo.status === "cancelled");

  const servicesList = useMemo(() => collectServicesFromWOs(routeWOs), [routeWOs]);
  const firstWo = routeWOs[0];
  const firstService = firstWo?.cipService ?? firstWo?.cipServices?.[0];
  const local = getLocalFromService(firstService);
  const scheduledAt = firstWo?.scheduledAt ?? null;
  const statusLabel =
    routeWOs.length === 0
      ? "—"
      : allFinished
        ? "Concluída"
        : routeWOs.some((wo) => wo.status === "in_progress")
          ? "Em execução"
          : "A fazer";

  const handleStartRoute = useCallback(async () => {
    if (!routeId) return;
    await startRoute(routeId);
  }, [routeId, startRoute]);

  const handleFinishRoute = useCallback(() => {
    if (!routeId) return;
    finishRoute(routeId);
    Alert.alert(
      "Ordem concluída",
      "Todos os serviços desta ordem foram finalizados.",
      [{ text: "OK", onPress: () => router.back() }]
    );
  }, [routeId, finishRoute, router]);

  if (!routeId) {
    return (
      <View className="flex-1 bg-white p-4">
        <TouchableOpacity onPress={() => router.back()} className="py-2">
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <Text className="text-secondary-500 mt-4">Ordem de serviço não informada.</Text>
      </View>
    );
  }

  if (routeWOs.length === 0 && !loading) {
    return (
      <View className="flex-1 bg-white p-4">
        <TouchableOpacity onPress={() => router.back()} className="py-2">
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <Text className="text-secondary-500 mt-4">Ordem de serviço não encontrada.</Text>
      </View>
    );
  }

  const routeName = routeInfo?.name || routeInfo?.code || "Rota";

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-4 pb-2 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => router.back()}
          className="py-2 self-start"
        >
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <View className="flex-row items-center gap-2 mt-2">
          <View className="bg-secondary-500 px-2 py-0.5 rounded">
            <Text className="text-white text-xs font-poppins-bold">Ordem de serviço</Text>
          </View>
        </View>
        <Text className="text-primary-500 font-poppins-bold text-xl mt-2">
          {routeName}
        </Text>
        <Text className="text-secondary-500 text-sm">
          {servicesList.length} {servicesList.length === 1 ? "serviço" : "serviços"}
        </Text>
        <View className="flex-row items-center gap-2 mt-1">
          <Text className="text-secondary-500 text-xs">Rota: {routeName}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        <View className="gap-4">
          {servicesList.length > 0 ? (
            <View className="border-b border-gray-200 pb-4">
              <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
                Serviços desta ordem
              </Text>
              <View className="mt-2 gap-2">
                {servicesList.map((s, idx) => (
                  <View
                    key={s.id ?? idx}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                  >
                    <Text className="text-primary-500 font-poppins-medium">
                      {s.serviceModel?.name ?? "Serviço"}
                    </Text>
                    <Text className="text-secondary-500 text-sm mt-0.5">
                      {s.cip?.subset?.set?.equipment?.name ??
                        s.cip?.subset?.set?.equipment?.tag ??
                        "—"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          <View className="border-b border-gray-200 pb-4">
            <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
              Local
            </Text>
            <Text className="text-primary-500 mt-1">{local}</Text>
          </View>
          <View className="border-b border-gray-200 pb-4">
            <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
              Status
            </Text>
            <Text className="text-primary-500 mt-1">{statusLabel}</Text>
          </View>
          <View className="border-b border-gray-200 pb-4">
            <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
              Datas
            </Text>
            <Text className="text-primary-500 mt-1">
              Agendada: {formatDateTime(scheduledAt)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {!allFinished && (
        <View className="p-4 border-t border-gray-200 gap-3">
          {!started ? (
            <TouchableOpacity
              onPress={handleStartRoute}
              className="bg-secondary-500 rounded-full py-4 items-center justify-center flex-row gap-2"
            >
              <ListTodo color="white" size={20} />
              <Text className="text-white font-poppins-bold text-lg">
                INICIAR EXECUÇÃO
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleFinishRoute}
              className="bg-green-600 rounded-full py-4 items-center justify-center flex-row gap-2"
            >
              <CheckCircle color="white" size={20} />
              <Text className="text-white font-poppins-bold text-lg">
                CONCLUIR ORDEM
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
