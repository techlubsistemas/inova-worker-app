import { AiBanner } from "@/components/aiBanner";
import { UserHeader } from "@/components/headers/userHeader";
import { Text } from "@/components/PoppinsText";
import { WorkOrdersView } from "@/components/workOrdersView";
import { useWorkOrders } from "@/context/WorkOrdersContext";
import { useFocusEffect, useRouter } from "expo-router";
import { ChevronRight, GraduationCap } from "lucide-react-native";
import { useCallback } from "react";
import {
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

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
            <TouchableOpacity
              onPress={() => router.push("/trainings")}
              className="flex-row items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
            >
              <GraduationCap color="#ED6842" size={22} />
              <Text className="flex-1 font-poppins-medium text-primary-500">
                Meus treinamentos
              </Text>
              <ChevronRight color="#9ca3af" size={20} />
            </TouchableOpacity>
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
