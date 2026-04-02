import { AiBanner } from "@/components/aiBanner";
import { UserHeader } from "@/components/headers/userHeader";
import { WorkOrdersView } from "@/components/workOrdersView";
import { useWorkOrders } from "@/context/WorkOrdersContext";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

export default function Home() {
  const router = useRouter();
  const { workOrders, loading, error, refetch, refetchIfStale } =
    useWorkOrders();

  useFocusEffect(
    useCallback(() => {
      refetchIfStale();
    }, [refetchIfStale]),
  );

  const handleRefresh = async () => {
    await Promise.all([refetch()]);
  };

  const handleNavigateToOrder = useCallback(
    (orderId: string) => {
      router.push({ pathname: "/order/[orderId]", params: { orderId } });
    },
    [router],
  );

  const handleNavigateToRoute = useCallback(
    (routeId: string) => {
      router.push({ pathname: "/route/[routeId]", params: { routeId } });
    },
    [router],
  );

  return (
    <View className="flex-1">
      <ScrollView
        className="bg-white flex flex-col"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            colors={["#ED6842"]}
            tintColor="#ED6842"
            title="Atualizando..."
          />
        }
      >
        <View className="flex flex-col relative flex-1 gap-4">
          <UserHeader />
          <View className="flex flex-col gap-4 px-4">
            <AiBanner />
          </View>
          <WorkOrdersView
            workOrders={workOrders}
            loading={loading}
            error={error}
            onRefetch={refetch}
            onNavigateToOrder={handleNavigateToOrder}
            onNavigateToRoute={handleNavigateToRoute}
          />
        </View>
      </ScrollView>
    </View>
  );
}
