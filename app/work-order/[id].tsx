import { Text } from "@/components/PoppinsText";
import { orderKey, useStartedOrders } from "@/context/StartedOrdersContext";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { updateWorkOrderStatus } from "@/services/workOrder";
import { ServiceStatusBadge } from "@/components/ServiceStatusBadge";
import { ToolsAndMaterialsSection } from "@/components/ToolsAndMaterialsSection";
import type { WorkOrderApi } from "@/types/workOrder";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

function getLocal(wo: WorkOrderApi): string {
  const firstService = wo.cipService ?? wo.cipServices?.[0];
  const equipment = firstService?.cip?.subset?.set?.equipment;
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

export default function WorkOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { workOrders, loading, error, refetch } = useWorkOrders();
  const { isRouteStarted, isOrderStarted, startOrder } = useStartedOrders();
  const [updating, setUpdating] = useState(false);

  const workOrder = workOrders.find((wo) => wo.id === id);
  const isRouteWO = !!(workOrder?.routeId && (workOrder.cipServices?.length ?? 0) > 1);
  const belongsToRouteLegacy = workOrder?.routeId && workOrder?.route && !isRouteWO;
  const routeNotStarted =
    belongsToRouteLegacy && !isRouteStarted(workOrder!.routeId!);
  const isSingleOrder = workOrder && (!workOrder.routeId || isRouteWO);
  const singleOrderNotStarted =
    isSingleOrder && !isOrderStarted(orderKey("single", workOrder!.id));

  useEffect(() => {
    refetch();
  }, [id, refetch]);

  const handleStartExecution = useCallback(async () => {
    if (!id || !workOrder) return;
    if (workOrder.status !== "pending" && workOrder.status !== "scheduled") return;
    setUpdating(true);
    try {
      await updateWorkOrderStatus(id, {
        status: "in_progress",
        executedAt: new Date().toISOString(),
      });
      await startOrder(orderKey("single", workOrder.id));
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
  }, [id, workOrder, refetch, startOrder]);

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

  if (!workOrder) {
    return (
      <View className="flex-1 bg-white p-4">
        <TouchableOpacity onPress={() => router.back()} className="py-2">
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <Text className="text-secondary-500 mt-4">
          Ordem de serviço não encontrada.
        </Text>
      </View>
    );
  }

  const firstService = workOrder.cipService ?? workOrder.cipServices?.[0];
  const serviceName = isRouteWO
    ? (workOrder.route?.name ?? workOrder.route?.code ?? "Rota")
    : (firstService?.serviceModel?.name ?? "Serviço");
  const equipmentName =
    firstService?.cip?.subset?.set?.equipment?.name ??
    firstService?.cip?.subset?.set?.equipment?.tag ??
    "—";
  const tag = firstService?.cip?.subset?.set?.equipment?.tag ?? "—";
  const local = getLocal(workOrder);
  const servicesList = workOrder.cipServices?.length
    ? workOrder.cipServices
    : workOrder.cipService
      ? [workOrder.cipService]
      : [];
  const canStart =
    workOrder.status === "pending" || workOrder.status === "scheduled";
  const inProgress = workOrder.status === "in_progress";
  const isFinished =
    workOrder.status === "completed" || workOrder.status === "cancelled";

  if (routeNotStarted) {
    const routeName = workOrder.route?.name || workOrder.route?.code || "Ordem de serviço";
    return (
      <View className="flex-1 bg-white p-4">
        <TouchableOpacity onPress={() => router.back()} className="py-2 self-start">
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <View className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <Text className="text-primary-500 font-poppins-bold text-lg">
            Serviço vinculado à ordem de serviço
          </Text>
          <Text className="text-secondary-500 mt-2">
            Este serviço faz parte da ordem de serviço "{routeName}". Inicie a execução da
            ordem primeiro para poder executar os serviços.
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.replace({
                pathname: "/route/[routeId]",
                params: { routeId: workOrder.routeId! },
              })
            }
            className="bg-secondary-500 rounded-full py-3 items-center justify-center mt-4"
          >
            <Text className="text-white font-poppins-bold">
              Ir para a ordem
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (singleOrderNotStarted) {
    return (
      <View className="flex-1 bg-white">
        <View className="px-4 pt-4 pb-2 border-b border-gray-200">
          <TouchableOpacity onPress={() => router.back()} className="py-2 self-start">
            <ArrowLeft color="#182D53" size={24} />
          </TouchableOpacity>
          <Text className="text-primary-500 font-poppins-bold text-xl mt-2">
            {serviceName}
          </Text>
          <Text className="text-secondary-500 text-sm">
            {isRouteWO ? `${servicesList.length} serviço(s)` : equipmentName}
          </Text>
          <View className="flex-row items-center gap-2 mt-1">
            {!isRouteWO && tag ? (
              <View className="bg-secondary-100 px-2 py-0.5 rounded">
                <Text className="text-secondary-500 text-xs font-poppins-bold">
                  {tag}
                </Text>
              </View>
            ) : null}
            {workOrder.route && (
              <Text className="text-secondary-500 text-xs">
                Rota: {workOrder.route.name}
              </Text>
            )}
          </View>
        </View>
        <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
          <View className="gap-4">
            {isRouteWO && servicesList.length > 0 ? (
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
              <View className="mt-1">
                <ServiceStatusBadge
                  status={workOrder.status}
                  label={
                    workOrder.status === "in_progress" ? "Em execução" : undefined
                  }
                />
              </View>
            </View>
            <View className="border-b border-gray-200 pb-4">
              <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
                Datas
              </Text>
              <Text className="text-primary-500 mt-1">
                Agendada: {formatDateTime(workOrder.scheduledAt)}
              </Text>
              {workOrder.executedAt && (
                <Text className="text-primary-500 mt-1">
                  Início execução: {formatDateTime(workOrder.executedAt)}
                </Text>
              )}
              {workOrder.completedAt && (
                <Text className="text-primary-500 mt-1">
                  Conclusão: {formatDateTime(workOrder.completedAt)}
                </Text>
              )}
            </View>
            <ToolsAndMaterialsSection servicesList={servicesList} />
          </View>
        </ScrollView>
        <View className="p-4 border-t border-gray-200">
          <View className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <Text className="text-primary-500 font-poppins-bold text-lg">
              Ordem de serviço não iniciada
            </Text>
            <Text className="text-secondary-500 mt-2">
              Esta ordem de serviço ainda não foi iniciada. Inicie a execução da
              ordem primeiro para poder executar o serviço.
            </Text>
            <TouchableOpacity
              onPress={() =>
                router.replace({
                  pathname: "/order/[orderId]",
                  params: { orderId: workOrder.id },
                })
              }
              className="bg-secondary-500 rounded-full py-3 items-center justify-center mt-4"
            >
              <Text className="text-white font-poppins-bold">
                Ir para a ordem
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (isRouteWO) {
    return (
      <View className="flex-1 bg-white p-4">
        <TouchableOpacity onPress={() => router.back()} className="py-2 self-start">
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <View className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <Text className="text-primary-500 font-poppins-bold text-lg">
            Ordem com vários serviços
          </Text>
          <Text className="text-secondary-500 mt-2">
            Esta ordem contém vários serviços. Acesse a ordem para executar cada
            serviço individualmente.
          </Text>
          <TouchableOpacity
            onPress={() =>
              router.replace({
                pathname: "/order/[orderId]",
                params: { orderId: workOrder.id },
              })
            }
            className="bg-secondary-500 rounded-full py-3 items-center justify-center mt-4"
          >
            <Text className="text-white font-poppins-bold">
              Ir para a ordem
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-4 pb-2 border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="py-2 self-start">
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>
        <Text className="text-primary-500 font-poppins-bold text-xl mt-2">
          {serviceName}
        </Text>
        <Text className="text-secondary-500 text-sm">
          {isRouteWO ? `${servicesList.length} serviço(s)` : equipmentName}
        </Text>
        <View className="flex-row items-center gap-2 mt-1">
          {!isRouteWO && tag ? (
            <View className="bg-secondary-100 px-2 py-0.5 rounded">
              <Text className="text-secondary-500 text-xs font-poppins-bold">
                {tag}
              </Text>
            </View>
          ) : null}
          {workOrder.route && (
            <Text className="text-secondary-500 text-xs">
              Rota: {workOrder.route.name}
            </Text>
          )}
        </View>
      </View>

      <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
        <View className="gap-4">
          {isRouteWO && servicesList.length > 0 ? (
            <View className="border-b border-gray-200 pb-4">
              <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
                Serviços desta ordem
              </Text>
              <View className="mt-2 gap-2">
                {servicesList.map((s, idx) => (
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
                    </View>
                    <ServiceStatusBadge status={s.status} />
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
            <View className="mt-1">
              <ServiceStatusBadge
                status={workOrder.status}
                label={
                  workOrder.status === "in_progress" ? "Em execução" : undefined
                }
              />
            </View>
          </View>
          <View className="border-b border-gray-200 pb-4">
            <Text className="text-secondary-400 text-xs font-poppins-bold uppercase">
              Datas
            </Text>
            <Text className="text-primary-500 mt-1">
              Agendada: {formatDateTime(workOrder.scheduledAt)}
            </Text>
            {workOrder.executedAt && (
              <Text className="text-primary-500 mt-1">
                Início execução: {formatDateTime(workOrder.executedAt)}
              </Text>
            )}
            {workOrder.completedAt && (
              <Text className="text-primary-500 mt-1">
                Conclusão: {formatDateTime(workOrder.completedAt)}
              </Text>
            )}
          </View>
          <ToolsAndMaterialsSection servicesList={servicesList} />
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
                Em execução — escolha como encerrar:
              </Text>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/work-order/[id]/complete",
                    params: { id: workOrder.id },
                  })
                }
                className="bg-green-600 rounded-full py-4 items-center justify-center"
              >
                <Text className="text-white font-poppins-bold text-lg">
                  CONCLUIR COM SUCESSO
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/work-order/[id]/report-issue",
                    params: { id: workOrder.id },
                  })
                }
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
