import type { WorkOrderApi, WorkOrderListItem } from "@/types/workOrder";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "./PoppinsText";
import { WorkOrderCard } from "./workOrderCard";
import { RouteCard } from "./routeCard";

type TabIndex = 0 | 1 | 2;

const TAB_LABELS: Record<TabIndex, string> = {
  0: "A fazer",
  1: "Em andamento",
  2: "Concluidas",
};

function woMatchesTab(wo: WorkOrderApi, tab: TabIndex): boolean {
  if (tab === 0) return wo.status === "pending" || wo.status === "scheduled";
  if (tab === 1) return wo.status === "in_progress" || wo.status === "paused";
  return wo.status === "completed" || wo.status === "cancelled";
}

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
  tab: TabIndex,
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
      .map((wo) =>
        wo.scheduledAt ? new Date(wo.scheduledAt).getTime() : Infinity,
      )
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

function getItemKey(item: WorkOrderListItem): string {
  return item.type === "route" ? `route-${item.routeId}` : item.workOrder.id;
}

export interface WorkOrdersViewProps {
  workOrders: WorkOrderApi[];
  loading: boolean;
  error: string | null;
  onRefetch: () => Promise<void>;
  onNavigateToOrder: (orderId: string) => void;
  onNavigateToRoute: (routeId: string) => void;
}

export function WorkOrdersView({
  workOrders,
  loading,
  error,
  onRefetch,
  onNavigateToOrder,
  onNavigateToRoute,
}: WorkOrdersViewProps) {
  const [selectedTab, setSelectedTab] = useState<TabIndex>(0);
  const flatListRef = useRef<FlatList<WorkOrderListItem>>(null);

  const allItems = useMemo(() => buildListItems(workOrders), [workOrders]);

  const tabCounts = useMemo(() => {
    const counts: [number, number, number] = [0, 0, 0];
    for (const item of allItems) {
      for (const tab of [0, 1, 2] as TabIndex[]) {
        if (item.type === "route") {
          if (item.workOrders.some((wo) => woMatchesTab(wo, tab)))
            counts[tab]++;
        } else {
          if (woMatchesTab(item.workOrder, tab)) counts[tab]++;
        }
      }
    }
    return counts;
  }, [allItems]);

  const listItems = useMemo(
    () => sortListByDate(filterListByTab(allItems, selectedTab)),
    [allItems, selectedTab],
  );

  const handleTabChange = (tab: TabIndex) => {
    setSelectedTab(tab);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

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
          onPress={() => onRefetch()}
          className="mt-4 bg-secondary-500 py-3 rounded-xl items-center"
        >
          <Text className="text-white font-poppins-bold">Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="w-full flex flex-col gap-4">
      {/* Tab bar */}
      <View style={tabStyles.container}>
        {([0, 1, 2] as TabIndex[]).map((tab) => {
          const isActive = selectedTab === tab;
          const count = tabCounts[tab];
          return (
            <Pressable
              key={tab}
              onPress={() => handleTabChange(tab)}
              style={[tabStyles.tab, isActive && tabStyles.tabActive]}
            >
              <Text
                style={[tabStyles.tabText, isActive && tabStyles.tabTextActive]}
                numberOfLines={1}
              >
                {TAB_LABELS[tab]}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    tabStyles.badge,
                    isActive ? tabStyles.badgeActive : tabStyles.badgeInactive,
                  ]}
                >
                  <Text
                    style={[
                      tabStyles.badgeText,
                      isActive
                        ? tabStyles.badgeTextActive
                        : tabStyles.badgeTextInactive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Lista horizontal de WO cards */}
      {listItems.length === 0 ? (
        <View className="py-12 items-center px-4">
          <Text className="text-secondary-500 text-center">
            {selectedTab === 0
              ? "Nenhuma ordem a fazer"
              : selectedTab === 1
                ? "Nenhuma ordem em andamento"
                : "Nenhuma ordem concluida"}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          data={listItems}
          extraData={selectedTab}
          keyExtractor={getItemKey}
          contentContainerStyle={listStyles.contentContainer}
          ItemSeparatorComponent={() => <View style={listStyles.separator} />}
          renderItem={({ item, index }) =>
            item.type === "route" ? (
              <RouteCard
                data={item}
                index={index}
                quantity={listItems.length - 1}
                onPress={() => onNavigateToRoute(item.routeId)}
              />
            ) : (
              <WorkOrderCard
                data={item.workOrder}
                index={index}
                quantity={listItems.length - 1}
                onPress={() => onNavigateToOrder(item.workOrder.id)}
              />
            )
          }
        />
      )}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: "#9ca3af",
  },
  tabTextActive: {
    color: "#182D53",
  },
  badge: {
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeActive: {
    backgroundColor: "#ED6842",
  },
  badgeInactive: {
    backgroundColor: "#d1d5db",
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Poppins_700Bold",
    lineHeight: 12,
  },
  badgeTextActive: {
    color: "#ffffff",
  },
  badgeTextInactive: {
    color: "#6b7280",
  },
});

const listStyles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 16,
  },
  separator: {
    width: 12,
  },
});
