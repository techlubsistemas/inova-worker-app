import { AiBanner } from "@/components/aiBanner";
import { UserHeader } from "@/components/headers/userHeader";
import { InovaUniversity } from "@/components/inovaUniversity";
import { LessonModal } from "@/components/modals/lessonModal";
import { TutorialModal } from "@/components/modals/tutorialModal";
import { WorkOrdersView } from "@/components/workOrdersView";
import { useModal } from "@/context/modalContext";
import { useTutorials } from "@/hooks/useTutorials";
import { useWorkOrders } from "@/hooks/useWorkOrders";
import { RefreshControl, ScrollView, View } from "react-native";

export default function Home() {
  const { isLessonModalOpen } = useModal();
  const { workOrders, loading, error, refetch } = useWorkOrders();
  const {
    tutorials,
    loading: tutorialsLoading,
    refetch: tutorialsRefetch,
  } = useTutorials();

  const handleRefresh = async () => {
    await Promise.all([refetch(), tutorialsRefetch()]);
  };

  return (
    <View className="flex-1">
      <ScrollView
        className="bg-white flex flex-col"
        refreshControl={
          <RefreshControl
            refreshing={loading || tutorialsLoading}
            onRefresh={handleRefresh}
            colors={["#ED6842"]}
            tintColor="#ED6842"
            title="Atualizando..."
          />
        }
      >
        <View className="flex flex-col relative flex-1 gap-4 ">
          <UserHeader />
          <View className="flex flex-col gap-4 px-4">
            <AiBanner />
          </View>
          <WorkOrdersView
            workOrders={workOrders}
            loading={loading}
            error={error}
            refetch={refetch}
          />
          <InovaUniversity
            tutorials={tutorials}
            loading={tutorialsLoading}
            refetch={tutorialsRefetch}
          />
        </View>
      </ScrollView>
      {isLessonModalOpen && <LessonModal />}
      <TutorialModal />
    </View>
  );
}
