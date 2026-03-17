import { cn } from "@/utils/cn";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import type {
  WorkOrderApi,
  WorkOrderListItem,
  RouteGroup,
} from "@/types/workOrder";
import { useFocusEffect } from "expo-router";
import { List, ListChecks, ListTodo } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "./PoppinsText";
import { RouteCard } from "./routeCard";
import { WorkOrderCard } from "./workOrderCard";

type TabIndex = 0 | 1 | 2;

function woMatchesTab(wo: WorkOrderApi, tab: TabIndex): boolean {
  if (tab === 0)
    return wo.status === "pending" || wo.status === "scheduled";
  if (tab === 1) return wo.status === "in_progress";
  return wo.status === "completed" || wo.status === "cancelled";
}

/**
 * Lista: 1 item por WO. Rotas no novo modelo (1 WO com cipServices) vão para work-order/[id].
 * Legado: várias WOs com mesmo routeId+scheduledAt são agrupadas em um RouteCard -> /route/[routeId].
 */
function buildListItems(workOrders: WorkOrderApi[]): WorkOrderListItem[] {
  const individuals: WorkOrderApi[] = [];
  const byRouteKey = new Map<string, WorkOrderApi[]>();

  for (const wo of workOrders) {
    if (wo.routeId && wo.route) {
      const key = `${wo.routeId}\n${wo.scheduledAt ?? ""}`;
      const list = byRouteKey.get(key) ?? [];
      list.push(wo);
      byRouteKey.set(key, list);
    } else {
      individuals.push(wo);
    }
  }

  const items: WorkOrderListItem[] = [];
  for (const wos of byRouteKey.values()) {
    const wo = wos[0]!;
    if (wos.length === 1) {
      items.push({ type: "wo", workOrder: wo });
    } else {
      items.push({
        type: "route",
        routeId: wo.routeId!,
        route: wo.route!,
        workOrders: wos,
      });
    }
  }
  for (const wo of individuals) {
    items.push({ type: "wo", workOrder: wo });
  }
  return items;
}

function filterListByTab(
  items: WorkOrderListItem[],
  tab: TabIndex
): WorkOrderListItem[] {
  return items.filter((item) => {
    if (item.type === "route") {
      return item.workOrders.some((wo) => woMatchesTab(wo, tab));
    }
    return woMatchesTab(item.workOrder, tab);
  });
}

function sortKey(item: WorkOrderListItem): number {
  if (item.type === "route") {
    const dates = item.workOrders
      .map((wo) => (wo.scheduledAt ? new Date(wo.scheduledAt).getTime() : Infinity))
      .filter((t) => t !== Infinity);
    return dates.length ? Math.min(...dates) : Infinity;
  }
  return item.workOrder.scheduledAt
    ? new Date(item.workOrder.scheduledAt).getTime()
    : Infinity;
}

function sortListByDate(items: WorkOrderListItem[]): WorkOrderListItem[] {
  return [...items].sort((a, b) => sortKey(a) - sortKey(b));
}

export interface WorkOrdersViewProps {
  workOrders?: WorkOrderApi[];
  loading?: boolean;
  error?: string | null;
  refetch?: () => Promise<void>;
}

export function WorkOrdersView(props?: WorkOrdersViewProps) {
  const hook = useWorkOrders();
  const workOrders = props?.workOrders ?? hook.workOrders;
  const loading = props?.loading ?? hook.loading;
  const error = props?.error ?? hook.error;
  const refetch = props?.refetch ?? hook.refetch;
  const [selectedTab, setSelectedTab] = useState<TabIndex>(0);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const listItems = useMemo(
    () =>
      sortListByDate(filterListByTab(buildListItems(workOrders), selectedTab)),
    [workOrders, selectedTab]
  );

  if (loading && workOrders.length === 0) {
    return (
      <View className="w-full py-12 items-center justify-center">
        <ActivityIndicator size="large" color="#ED6842" />
        <Text className="text-secondary-500 mt-2">Carregando ordens...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="w-full py-8 px-4">
        <Text className="text-red-600 text-center">{error}</Text>
        <TouchableOpacity
          onPress={() => refetch()}
          className="mt-4 bg-secondary-500 py-3 rounded-xl items-center"
        >
          <Text className="text-white font-poppins-bold">Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="w-full flex flex-col gap-4">
      <View className="flex flex-row justify-between px-6">
        <TouchableOpacity
          onPress={() => setSelectedTab(0)}
          className={cn(
            "w-32 transition-all duration-700 border flex items-center justify-center gap-2 flex-row py-4 border-secondary-400",
            selectedTab === 0
              ? "bg-secondary-400/20 rounded-3xl"
              : "bg-white rounded-2xl"
          )}
        >
          <List color={"#182D53"} />
          <Text className="text-sm text-primary-500">A Fazer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedTab(1)}
          className={cn(
            "w-32 transition-all duration-700 border flex items-center justify-center gap-2 flex-row py-4 border-secondary-400",
            selectedTab === 1
              ? "bg-secondary-400/20 rounded-3xl"
              : "bg-white rounded-2xl"
          )}
        >
          <ListTodo color={"#182D53"} />
          <Text className="text-sm text-primary-500">Em andamento</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedTab(2)}
          className={cn(
            "w-32 transition-all duration-700 border flex items-center justify-center gap-2 flex-row py-4 border-secondary-400",
            selectedTab === 2
              ? "bg-secondary-400/20 rounded-3xl"
              : "bg-white rounded-2xl"
          )}
        >
          <ListChecks color={"#182D53"} />
          <Text className="text-sm text-primary-500">Concluídas</Text>
        </TouchableOpacity>
      </View>
      <View className="flex">
        {listItems.length === 0 ? (
          <View className="py-12 px-4 items-center">
            <Text className="text-secondary-500 text-center">
              {selectedTab === 0
                ? "Nenhuma ordem de serviço a fazer"
                : selectedTab === 1
                  ? "Nenhuma ordem de serviço em andamento"
                  : "Nenhuma ordem de serviço concluída"}
            </Text>
          </View>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={listItems}
            keyExtractor={(item) =>
              item.type === "route" ? `route-${item.routeId}` : item.workOrder.id
            }
            ItemSeparatorComponent={() => <View className="w-4" />}
            renderItem={({ item, index }) =>
              item.type === "route" ? (
                <RouteCard
                  data={item}
                  index={index}
                  quantity={listItems.length - 1}
                />
              ) : (
                <WorkOrderCard
                  data={item.workOrder}
                  index={index}
                  quantity={listItems.length - 1}
                  orderId={item.workOrder.id}
                />
              )
            }
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refetch}
                colors={["#ED6842"]}
              />
            }
          />
        )}
      </View>
    </View>
  );
}
