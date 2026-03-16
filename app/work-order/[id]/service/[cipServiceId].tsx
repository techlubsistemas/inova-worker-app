import { Text } from "@/components/PoppinsText";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { updateWorkOrderServiceStatus } from "@/services/workOrder";
import type { CipServiceInWorkOrder } from "@/types/workOrder";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

function getStatusLabel(status: CipServiceInWorkOrder["status"]): string {
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

export default function WorkOrderServiceDetailScreen() {
  const { id: workOrderId, cipServiceId } = useLocalSearchParams<{
    id: string;
    cipServiceId: string;
  }>();
  const router = useRouter();
  const { workOrders, loading, error, refetch } = useWorkOrders();
  const [updating, setUpdating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const workOrder = useMemo(
    () => workOrders.find((wo) => wo.id === workOrderId),
    [workOrders, workOrderId]
  );
  const service = useMemo(
    () =>
      workOrder?.cipServices?.find((s) => s.id === cipServiceId) ??
      (workOrder?.cipService?.id === cipServiceId ? workOrder.cipService : null),
    [workOrder, cipServiceId]
  );

  const serviceStatus = service?.status ?? "pending";
  const canStart =
    serviceStatus === "pending" || serviceStatus === "scheduled";
  const inProgress = serviceStatus === "in_progress";
  const isFinished =
    serviceStatus === "completed" || serviceStatus === "cancelled";

  const handleStartExecution = useCallback(async () => {
    if (!workOrderId || !cipServiceId || !workOrder) return;
    setUpdating(true);
    try {
      await updateWorkOrderServiceStatus(workOrderId, cipServiceId, {
        status: "in_progress",
        executedAt: new Date().toISOString(),
      });
      await refetch();
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as Error).message
          : "Não foi possível iniciar a execução.";
      Alert.alert("Erro", msg);
    } finally {
      setUpdating(false);
    }
  }, [workOrderId, cipServiceId, workOrder, refetch]);

  const handleComplete = useCallback(async () => {
    if (!workOrderId || !cipServiceId) return;
    setUpdating(true);
    try {
      await updateWorkOrderServiceStatus(workOrderId, cipServiceId, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      await refetch();
      router.back();
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as Error).message
          : "Não foi possível concluir o serviço.";
      Alert.alert("Erro", msg);
    } finally {
      setUpdating(false);
    }
  }, [workOrderId, cipServiceId, refetch, router]);

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
        <TouchableOpacity onPress={() => router.back()} className="py-2">
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
        <TouchableOpacity onPress={() => router.back()} className="py-2">
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

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-4 pb-2 border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="py-2 self-start">
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <Text className="text-primary-500 font-poppins-bold text-xl mt-2">
          {serviceName}
        </Text>
        <Text className="text-secondary-500 text-sm">{equipmentName}</Text>
        <View className="flex-row items-center gap-2 mt-1">
          <View className="bg-primary-100 px-2 py-0.5 rounded">
            <Text className="text-primary-600 text-xs font-poppins-bold">
              {getStatusLabel(serviceStatus)}
            </Text>
          </View>
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
        </View>
      </ScrollView>

      {!isFinished && (
        <View className="p-4 border-t border-gray-200 gap-3">
          {canStart && (
            <TouchableOpacity
              onPress={handleStartExecution}
              disabled={updating}
              className="bg-secondary-500 rounded-full py-4 items-center justify-center"
            >
              {updating ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-poppins-bold text-lg">
                  INICIAR EXECUÇÃO
                </Text>
              )}
            </TouchableOpacity>
          )}
          {inProgress && (
            <>
              <Text className="text-center text-secondary-500 font-poppins-medium">
                Encerrar execução deste serviço:
              </Text>
              <TouchableOpacity
                onPress={handleComplete}
                disabled={updating}
                className="bg-green-600 rounded-full py-4 items-center justify-center"
              >
                {updating ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-poppins-bold text-lg">
                    CONCLUIR COM SUCESSO
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/work-order/[id]/service/[cipServiceId]/report-issue",
                    params: { id: workOrderId!, cipServiceId: cipServiceId! },
                  })
                }
                disabled={updating}
                className="bg-red-500 rounded-full py-4 items-center justify-center"
              >
                <Text className="text-white font-poppins-bold text-lg">
                  RELATAR PROBLEMA
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}
