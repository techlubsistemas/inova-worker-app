import { Text } from "@/components/PoppinsText";
import { orderKey, useStartedOrders } from "@/context/StartedOrdersContext";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import type { CipServiceInWorkOrder, WorkOrderApi } from "@/types/workOrder";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, CheckCircle, Home, ListTodo } from "lucide-react-native";
import { useCallback, useMemo } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";

function getStatusLabel(status: WorkOrderApi["status"] | CipServiceInWorkOrder["status"]): string {
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
      return status ?? "A fazer";
  }
}

export default function OrderDetailScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { workOrders, loading, refetch } = useWorkOrders();
  const { isOrderStarted, startOrder, finishOrder } = useStartedOrders();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const key = orderId ? orderKey("single", orderId) : "";
  const workOrder = useMemo(
    () => workOrders.find((wo) => wo.id === orderId),
    [workOrders, orderId]
  );
  const servicesList = useMemo(
    () =>
      workOrder?.cipServices?.length
        ? workOrder.cipServices
        : workOrder?.cipService
          ? [workOrder.cipService]
          : [],
    [workOrder]
  );
  const isRouteOrder = servicesList.length > 1 && !!workOrder?.route;
  const started = key ? isOrderStarted(key) : false;
  const allFinished = workOrder
    ? workOrder.status === "completed" || workOrder.status === "cancelled"
    : false;

  const handleStartOrder = useCallback(async () => {
    if (!key) return;
    await startOrder(key);
  }, [key, startOrder]);

  const handleGoHome = useCallback(() => {
    if (key) finishOrder(key);
    router.replace("/home");
  }, [key, finishOrder, router]);

  if (!orderId) {
    return (
      <View className="flex-1 bg-white p-4">
        <TouchableOpacity onPress={() => router.back()} className="py-2">
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <Text className="text-secondary-500 mt-4">Ordem não informada.</Text>
      </View>
    );
  }

  if (!workOrder && !loading) {
    return (
      <View className="flex-1 bg-white p-4">
        <TouchableOpacity onPress={() => router.back()} className="py-2">
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
          {orderTitle}
        </Text>
        <Text className="text-secondary-500 text-sm">{serviceCountLabel}</Text>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        {(started || allFinished) && (
          <Text className="text-secondary-500 font-poppins-medium mb-2">
            {allFinished
              ? "Toque em um serviço para ver os detalhes."
              : isRouteOrder
                ? "Toque em um serviço para executá-lo."
                : "Toque no serviço para executá-lo."}
          </Text>
        )}

        <View className="gap-2 mb-4">
          <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
            Serviços desta ordem
          </Text>
          {servicesList.map((s, idx) => {
            const isClickable =
              (started || allFinished) &&
              (isRouteOrder || (servicesList.length === 1 && !!workOrder));
            const statusLabel = getStatusLabel(
              s.status ?? workOrder?.status ?? "pending"
            );
            const cancellationText =
              s.status === "cancelled" &&
              (s.cancellationReasonName || s.cancellationReason)
                ? s.cancellationReasonName || s.cancellationReason || ""
                : null;

            if (isClickable && isRouteOrder) {
              return (
                <TouchableOpacity
                  key={s.id ?? idx}
                  onPress={() =>
                    router.push({
                      pathname: "/work-order/[id]/service/[cipServiceId]",
                      params: { id: workOrder!.id, cipServiceId: s.id },
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
                      <Text className="text-secondary-500 text-xs mt-1">
                        {cancellationText}
                      </Text>
                    )}
                  </View>
                  <View className="bg-primary-100 px-3 py-1 rounded-full">
                    <Text className="text-primary-600 text-xs font-poppins-bold">
                      {statusLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }

            if (isClickable && !isRouteOrder && workOrder) {
              return (
                <TouchableOpacity
                  key={s.id ?? idx}
                  onPress={() =>
                    router.push({
                      pathname: "/work-order/[id]",
                      params: { id: workOrder.id },
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
                      <Text className="text-secondary-500 text-xs mt-1">
                        {cancellationText}
                      </Text>
                    )}
                  </View>
                  <View className="bg-primary-100 px-3 py-1 rounded-full">
                    <Text className="text-primary-600 text-xs font-poppins-bold">
                      {statusLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }

            return (
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
                {cancellationText && (
                  <Text className="text-secondary-500 text-xs mt-1">
                    {cancellationText}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {!started && !allFinished ? (
          <View className="gap-4">
            <Text className="text-secondary-500">
              {servicesList.length === 1
                ? "Inicie a execução da ordem para poder acessar e executar o serviço."
                : "Inicie a execução da ordem para poder acessar e executar os serviços."}
            </Text>
            <TouchableOpacity
              onPress={handleStartOrder}
              className="bg-secondary-500 rounded-full py-4 items-center justify-center flex-row gap-2"
            >
              <ListTodo color="white" size={20} />
              <Text className="text-white font-poppins-bold text-lg">
                INICIAR EXECUÇÃO DA ORDEM
              </Text>
            </TouchableOpacity>
          </View>
        ) : allFinished ? (
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
        ) : null}
      </ScrollView>
    </View>
  );
}
