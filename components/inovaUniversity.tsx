import type { Tutorial } from "@/types/tutorial";
import { FileText, Video } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { Text } from "./PoppinsText";

function getDiffDays(dateString: string) {
  const date = new Date(dateString);
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffTime = Date.now() - date.getTime();
  const diffDays = Math.floor(diffTime / msPerDay);
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return `${diffDays} dias atras`;
}

export interface InovaUniversityProps {
  tutorials: Tutorial[];
  loading: boolean;
  onTutorialPress: (tutorial: Tutorial) => void;
}

export function InovaUniversity({
  tutorials,
  loading,
  onTutorialPress,
}: InovaUniversityProps) {
  if (loading || tutorials.length === 0) {
    return null;
  }

  return (
    <View className="w-full px-5 flex flex-col gap-4 mt-2">
      <Text className="text-primary-500 text-2xl font-poppins-semi-bold">
        UNIVERSIDADE TECHLUB
      </Text>
      <View className="flex flex-col gap-4 pb-6">
        {tutorials.map((tutorial) => (
          <TouchableOpacity
            onPress={() => onTutorialPress(tutorial)}
            key={tutorial.id}
            className="flex flex-row shadow-md rounded-lg p-6 bg-white justify-between items-center"
          >
            <View className="flex flex-row gap-2 flex-1 items-center">
              <View className="h-12 w-12 bg-secondary-400 rounded-lg flex items-center justify-center">
                {tutorial.type === "video" ? (
                  <Video color="white" size={24} />
                ) : (
                  <FileText color="white" size={24} />
                )}
              </View>
              <View className="flex flex-col flex-1">
                <Text className="text-primary-500 font-poppins-bold">
                  {tutorial.name}
                </Text>
                <Text className="text-[#AEAEB3]">
                  {getDiffDays(tutorial.createdAt)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
