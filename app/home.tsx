import { AiBanner } from "@/components/aiBanner";
import { UserHeader } from "@/components/headers/userHeader";
import { InovaUniversity } from "@/components/inovaUniversity";
import { LessonModal } from "@/components/modals/lessonModal";
import { WorkOrdersView } from "@/components/workOrdersView";
import { useModal } from "@/context/modalContext";
import { ScrollView, View } from "react-native";

export default function Home() {
  const { isLessonModalOpen } = useModal();

  return (
    <View className="flex-1">
      <ScrollView className="bg-white flex flex-col">
        <View className="flex flex-col relative flex-1 gap-4 ">
          <UserHeader />
          <View className="flex flex-col gap-4 px-4">
            <AiBanner />
          </View>
          <WorkOrdersView />
          <InovaUniversity />
        </View>
      </ScrollView>
      {isLessonModalOpen && <LessonModal />}
    </View>
  );
}
