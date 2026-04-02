import { Text } from "@/components/PoppinsText";
import { ServiceStatusBadge } from "@/components/ServiceStatusBadge";
import { orderKey, useStartedOrders } from "@/context/StartedOrdersContext";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import {
  pauseWorkOrder,
  resumeWorkOrder,
  updateWorkOrderStatus,
} from "@/services/workOrder";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle,
  Home,
  ListTodo,
  Pause,
  Play,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

function formatExecutionTime(minutes: number | undefined): string | null {
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { workOrders, loading, refetch } = useWorkOrders();
  const { isOrderStarted, startOrder, finishOrder } = useStartedOrders();
  const [updating, setUpdating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const key = orderId ? orderKey("single", orderId) : "";
  const workOrder = useMemo(
    () => workOrders.find((wo) => wo.id === orderId),
    [workOrders, orderId],
  );
  const servicesList = useMemo(
    () =>
      workOrder?.cipServices?.length
        ? workOrder.cipServices
        : workOrder?.cipService
          ? [workOrder.cipService]
          : [],
    [workOrder],
  );
  const isRouteOrder = servicesList.length > 1 && !!workOrder?.route;
  const started = key ? isOrderStarted(key) : false;
  const allFinished = workOrder
    ? workOrder.status === "completed" || workOrder.status === "cancelled"
    : false;
  const isPaused = workOrder?.status === "paused";
  const isInProgress = workOrder?.status === "in_progress";

  const handleStartOrder = useCallback(async () => {
    if (!key || !orderId || !workOrder) return;
    setUpdating(true);
    try {
      await updateWorkOrderStatus(orderId, {
        status: "in_progress",
        executedAt: new Date().toISOString(),
      });
      await startOrder(key);
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
  }, [key, orderId, workOrder, startOrder, refetch]);

  const handlePause = useCallback(async () => {
    if (!orderId) return;
    setUpdating(true);
    try {
      await pauseWorkOrder(orderId);
      await refetch();
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as Error).message
          : "Não foi possível pausar a execução.";
      Alert.alert("Erro", msg);
    } finally {
      setUpdating(false);
    }
  }, [orderId, refetch]);

  const handleResume = useCallback(async () => {
    if (!orderId) return;
    setUpdating(true);
    try {
      await resumeWorkOrder(orderId);
      await refetch();
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as Error).message
          : "Não foi possível retomar a execução.";
      Alert.alert("Erro", msg);
    } finally {
      setUpdating(false);
    }
  }, [orderId, refetch]);

  const handleGoHome = useCallback(() => {
    if (key) finishOrder(key);
    router.replace("/home");
  }, [key, finishOrder, router]);

  if (!orderId) {
    return (
      <View className="flex-1 bg-white p-4">
        <TouchableOpacity
          onPress={() => router.replace("/home")}
          className="py-2"
        >
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <Text className="text-secondary-500 mt-4">Ordem não informada.</Text>
      </View>
    );
  }

  if (!workOrder && !loading) {
    return (
      <View className="flex-1 bg-white p-4">
        <TouchableOpacity
          onPress={() => router.replace("/home")}
          className="py-2"
        >
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <Text className="text-secondary-500 mt-4">Ordem não encontrada.</Text>
      </View>
    );
  }

  const orderTitle = isRouteOrder
    ? (workOrder?.route?.name ?? workOrder?.route?.code ?? "Ordem de serviço")
    : (workOrder?.cipService?.serviceModel?.name ?? "Ordem de serviço");

  const serviceCountLabel =
    servicesList.length === 1 ? "1 serviço" : `${servicesList.length} serviços`;

  const executionTimeText = formatExecutionTime(
    workOrder?.totalExecutionTimeMinutes,
  );

  const canInteract = started || allFinished || isPaused;

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-4 pb-2 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => router.replace("/home")}
          className="py-2 self-start"
        >
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <View className="flex-row items-center gap-2 mt-2">
          <View className="bg-secondary-500 px-2 py-0.5 rounded">
            <Text className="text-white text-xs font-poppins-bold">
              {workOrder?.code ?? "ORDEM DE SERVIÇO"}
            </Text>
          </View>
          {workOrder && <ServiceStatusBadge status={workOrder.status} />}
        </View>
        <Text className="text-primary-500 font-poppins-bold text-xl mt-2">
          {orderTitle}
        </Text>
        <Text className="text-secondary-500 text-sm">{serviceCountLabel}</Text>
        {executionTimeText && (
          <Text className="text-secondary-500 text-xs mt-1">
            Tempo de execução: {executionTimeText}
          </Text>
        )}
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {canInteract && !allFinished && (
          <Text className="text-secondary-500 font-poppins-medium mb-2">
            Serviços sem interação serão considerados concluídos. Toque em um
            serviço apenas para relatar uma anomalia.
          </Text>
        )}

        {canInteract && allFinished && (
          <Text className="text-secondary-500 font-poppins-medium mb-2">
            Toque em um serviço para ver os detalhes.
          </Text>
        )}

        <View className="gap-2 mb-4">
          <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
            Serviços desta ordem
          </Text>
          {servicesList.map((s, idx) => {
            const isClickable =
              canInteract && (isRouteOrder || servicesList.length === 1);
            const cancellationText =
              s.status === "cancelled" &&
              (s.cancellationReasonName || s.cancellationReason)
                ? s.cancellationReasonName || s.cancellationReason || ""
                : null;

            if (isClickable) {
              return (
                <TouchableOpacity
                  key={s.id ?? idx}
                  onPress={() =>
                    router.push({
                      pathname: "/order/[orderId]/service/[cipServiceId]",
                      params: { orderId: workOrder!.id, cipServiceId: s.id },
                    })
                  }
                  className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex-row items-center justify-between"
                >
                  <View className="flex-1">
                    <Text className="text-primary-500 font-poppins-medium">
                      {s.serviceModel?.name ?? "Serviço"}
                    </Text>
                    <Text className="text-secondary-500 text-sm mt-0.5">
                      {s.cip?.subset?.set?.equipment?.name ??
                        s.cip?.subset?.set?.equipment?.tag ??
                        "—"}
                    </Text>
                    {cancellationText && (
                      <Text className="text-red-500 text-xs mt-1">
                        Anomalia: {cancellationText}
                      </Text>
                    )}
                  </View>
                  <ServiceStatusBadge
                    status={s.status ?? workOrder?.status ?? "pending"}
                  />
                </TouchableOpacity>
              );
            }

            return (
              <View
                key={s.id ?? idx}
                className="rounded-lg border border-gray-200 bg-gray-50 p-3 flex-row items-center justify-between"
              >
                <View className="flex-1">
                  <Text className="text-primary-500 font-poppins-medium">
                    {s.serviceModel?.name ?? "Serviço"}
                  </Text>
                  <Text className="text-secondary-500 text-sm mt-0.5">
                    {s.cip?.subset?.set?.equipment?.name ??
                      s.cip?.subset?.set?.equipment?.tag ??
                      "—"}
                  </Text>
                  {cancellationText && (
                    <Text className="text-red-500 text-xs mt-1">
                      Anomalia: {cancellationText}
                    </Text>
                  )}
                </View>
                <ServiceStatusBadge
                  status={s.status ?? workOrder?.status ?? "pending"}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Ações do rodapé */}
      <View className="p-4 border-t border-gray-200">
        {!started && !allFinished && !isPaused && !isInProgress ? (
          /* WO não iniciada */
          <View className="gap-4">
            <Text className="text-secondary-500">
              {servicesList.length === 1
                ? "Inicie a execução da ordem para poder acessar e executar o serviço."
                : "Inicie a execução da ordem para poder acessar e executar os serviços."}
            </Text>
            <TouchableOpacity
              onPress={handleStartOrder}
              disabled={updating}
              className="bg-secondary-500 rounded-full py-4 items-center justify-center flex-row gap-2"
            >
              {updating ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <ListTodo color="white" size={20} />
                  <Text className="text-white font-poppins-bold text-lg">
                    INICIAR EXECUÇÃO DA ORDEM
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : allFinished ? (
          /* WO concluída */
          <View className="gap-4">
            <View className="flex-row items-center gap-2">
              <CheckCircle color="#16a34a" size={24} />
              <Text className="text-primary-500 font-poppins-bold text-lg">
                Ordem concluída
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleGoHome}
              className="bg-secondary-500 rounded-full py-4 items-center justify-center flex-row gap-2"
            >
              <Home color="white" size={20} />
              <Text className="text-white font-poppins-bold text-lg">
                Voltar ao início
              </Text>
            </TouchableOpacity>
          </View>
        ) : isPaused ? (
          /* WO pausada */
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Pause color="#ca8a04" size={20} />
              <Text className="text-yellow-700 font-poppins-bold">
                Execução pausada
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleResume}
              disabled={updating}
              className="bg-secondary-500 rounded-full py-4 items-center justify-center flex-row gap-2"
            >
              {updating ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Play color="white" size={20} />
                  <Text className="text-white font-poppins-bold text-lg">
                    RETOMAR EXECUÇÃO
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* WO em execução (in_progress) */
          <View className="gap-3">
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/order/[orderId]/complete",
                  params: { orderId: workOrder!.id },
                })
              }
              className="bg-green-600 rounded-full py-4 items-center justify-center flex-row gap-2"
            >
              <CheckCircle color="white" size={20} />
              <Text className="text-white font-poppins-bold text-lg">
                CONCLUIR EXECUÇÃO
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePause}
              disabled={updating}
              className="bg-amber-500 rounded-full py-4 items-center justify-center flex-row gap-2"
            >
              {updating ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Pause color="white" size={20} />
                  <Text className="text-white font-poppins-bold text-lg">
                    PAUSAR EXECUÇÃO
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}
