import { Text } from "@/components/PoppinsText";
import { fetchMyTrainings, type WorkerTraining } from "@/services/trainings";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, CheckCircle, GraduationCap, Play } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

export default function TrainingsScreen() {
  const router = useRouter();
  const [trainings, setTrainings] = useState<WorkerTraining[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      fetchMyTrainings()
        .then((t) => {
          if (!cancelled) setTrainings(t);
        })
        .catch(() => {
          if (!cancelled) setTrainings([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const completedCount = trainings.filter((t) => t.completed).length;

  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 p-4">
        <TouchableOpacity
          onPress={() => router.replace("/home")}
          className="py-2 self-start"
        >
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>

        <Text className="text-primary-500 font-poppins-bold text-xl mt-4">
          Meus treinamentos
        </Text>
        <Text className="text-secondary-500 mt-2">
          Treinamentos exigidos pela sua função
          {trainings.length > 0
            ? ` — ${completedCount}/${trainings.length} concluídos`
            : ""}
          .
        </Text>

        <ScrollView
          className="flex-1 mt-6"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color="#ED6842" />
            </View>
          ) : trainings.length === 0 ? (
            <Text className="text-secondary-500 text-sm">
              Nenhum treinamento atribuído à sua função.
            </Text>
          ) : (
            <View className="gap-2">
              {trainings.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() =>
                    router.push({
                      pathname: "/trainings/[trainingId]",
                      params: { trainingId: t.id },
                    })
                  }
                  className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex-row items-center gap-3"
                >
                  <GraduationCap color="#182D53" size={24} />
                  <View className="flex-1">
                    <Text className="font-poppins-medium text-primary-500">
                      {t.title}
                    </Text>
                    {t.level ? (
                      <Text className="text-secondary-500 text-xs mt-0.5">
                        {t.level}
                      </Text>
                    ) : null}
                  </View>
                  {t.completed ? (
                    <CheckCircle color="#16a34a" size={22} />
                  ) : (
                    <Play color="#ED6842" size={22} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
