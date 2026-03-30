import { Text } from "@/components/PoppinsText";
import { ServiceStatusBadge } from "@/components/ServiceStatusBadge";
import { ToolsAndMaterialsSection } from "@/components/ToolsAndMaterialsSection";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import type { CipServiceInWorkOrder } from "@/types/workOrder";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { AlertTriangle, ArrowLeft } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

function getLocal(service: CipServiceInWorkOrder | undefined): string {
  const equipment = service?.cip?.subset?.set?.equipment;
  if (!equipment) return "—";
  const sector = equipment.sector?.name;
  const area = equipment.sector?.area?.name;
  if (sector && area) return `${area} / ${sector}`;
  return sector ?? area ?? equipment.tag ?? "—";
}

function formatDateTime(iso: string | null | undefined): string {
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

export default function WorkOrderServiceDetailScreen() {
  const { orderId, cipServiceId } = useLocalSearchParams<{
    orderId: string;
    cipServiceId: string;
  }>();
  const router = useRouter();
  const { workOrders, loading, error, refetch } = useWorkOrders();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const workOrder = useMemo(
    () => workOrders.find((wo) => wo.id === orderId),
    [workOrders, orderId],
  );
  const service = useMemo(
    () =>
      workOrder?.cipServices?.find((s) => s.id === cipServiceId) ??
      (workOrder?.cipService?.id === cipServiceId
        ? workOrder.cipService
        : null),
    [workOrder, cipServiceId],
  );

  const serviceStatus = service?.status ?? "pending";
  const isCancelled = serviceStatus === "cancelled";
  const isCompleted = serviceStatus === "completed";
  const canReportProblem = !isCancelled && !isCompleted;

  if (loading && !workOrder) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#ED6842" />
        <Text className="text-secondary-500 mt-2">Carregando...</Text>
      </View>
    );
  }

  if (error && !workOrder) {
    return (
      <View className="flex-1 bg-white p-4">
        <TouchableOpacity
          onPress={() =>
            router.replace({
              pathname: "/order/[orderId]",
              params: { orderId: orderId! },
            })
          }
          className="py-2"
        >
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <Text className="text-red-600 mt-4">{error}</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="mt-4 bg-secondary-500 py-3 rounded-xl items-center"
        >
          <Text className="text-white font-poppins-bold">Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!workOrder || !service) {
    return (
      <View className="flex-1 bg-white p-4">
        <TouchableOpacity
          onPress={() =>
            router.replace({
              pathname: "/order/[orderId]",
              params: { orderId: orderId! },
            })
          }
          className="py-2"
        >
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <Text className="text-secondary-500 mt-4">
          Serviço não encontrado nesta ordem.
        </Text>
      </View>
    );
  }

  const serviceName = service.serviceModel?.name ?? "Serviço";
  const equipmentName =
    service.cip?.subset?.set?.equipment?.name ??
    service.cip?.subset?.set?.equipment?.tag ??
    "—";
  const local = getLocal(service);
  const cancellationText = isCancelled
    ? service.cancellationReasonName || service.cancellationReason || null
    : null;

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-4 pb-2 border-b border-gray-200">
        <TouchableOpacity
          onPress={() =>
            router.replace({
              pathname: "/order/[orderId]",
              params: { orderId: orderId! },
            })
          }
          className="py-2 self-start"
        >
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <Text className="text-primary-500 font-poppins-bold text-xl mt-2">
          {serviceName}
        </Text>
        <Text className="text-secondary-500 text-sm">{equipmentName}</Text>
        <View className="flex-row items-center gap-2 mt-1">
          <ServiceStatusBadge status={serviceStatus} />
        </View>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        <View className="gap-4">
          <View className="border-b border-gray-200 pb-4">
            <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
              Local
            </Text>
            <Text className="text-primary-500 mt-1">{local}</Text>
          </View>
          <View className="border-b border-gray-200 pb-4">
            <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
              Datas
            </Text>
            {service.executedAt && (
              <Text className="text-primary-500 mt-1">
                Início execução: {formatDateTime(service.executedAt)}
              </Text>
            )}
            {service.completedAt && (
              <Text className="text-primary-500 mt-1">
                Conclusão: {formatDateTime(service.completedAt)}
              </Text>
            )}
            {!service.executedAt && !service.completedAt && (
              <Text className="text-secondary-500 mt-1">—</Text>
            )}
          </View>

          {isCancelled && cancellationText && (
            <View className="border-b border-gray-200 pb-4">
              <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
                Problema relatado
              </Text>
              <View className="flex-row items-start gap-2 mt-1">
                <AlertTriangle color="#ef4444" size={16} />
                <Text className="text-red-600 flex-1">{cancellationText}</Text>
              </View>
            </View>
          )}

          <ToolsAndMaterialsSection servicesList={[service]} />
        </View>
      </ScrollView>

      {canReportProblem && (
        <View className="p-4 border-t border-gray-200">
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname:
                  "/order/[orderId]/service/[cipServiceId]/report-issue",
                params: { orderId: orderId!, cipServiceId: cipServiceId! },
              })
            }
            className="bg-red-500 rounded-full py-4 items-center justify-center flex-row gap-2"
          >
            <AlertTriangle color="white" size={20} />
            <Text className="text-white font-poppins-bold text-lg">
              RELATAR PROBLEMA
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
