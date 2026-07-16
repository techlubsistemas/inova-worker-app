import { Text } from "@/components/PoppinsText";
import { fetchMyTrainings, type WorkerTraining } from "@/services/trainings";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle,
  ChevronRight,
  GraduationCap,
  Play,
} from "lucide-react-native";
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
  const progress = trainings.length
    ? Math.round((completedCount / trainings.length) * 100)
    : 0;

  return (
    <View className="flex-1 bg-gray-50">
      <LinearGradient
        colors={["#182D53", "#244574"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="px-4 pt-5 pb-8 rounded-b-[32px]"
      >
        <TouchableOpacity
          onPress={() => router.replace("/home")}
          className="h-10 w-10 rounded-full bg-white/10 items-center justify-center"
        >
          <ArrowLeft color="#FFFFFF" size={22} />
        </TouchableOpacity>
        <View className="flex-row items-center gap-2 mt-5">
          <View className="h-10 w-10 rounded-xl bg-white/10 items-center justify-center">
            <BookOpenCheck color="#ED6842" size={22} />
          </View>
          <View className="flex-1">
            <Text className="text-white/70 text-xs">CAPACITAÇÃO OPERACIONAL</Text>
            <Text className="text-white font-poppins-bold text-2xl">
              Meus treinamentos
            </Text>
          </View>
        </View>
        <Text className="text-white/70 mt-3">
          Conteúdos obrigatórios definidos para a sua função.
        </Text>
      </LinearGradient>

      <View className="flex-1 px-4 -mt-4">
        <View className="rounded-2xl bg-white border border-gray-100 p-4 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-secondary-500 text-xs">SEU PROGRESSO</Text>
              <Text className="text-primary-500 font-poppins-bold text-lg mt-0.5">
                {completedCount} de {trainings.length} concluídos
              </Text>
            </View>
            <View className="h-12 w-12 rounded-full bg-orange-50 items-center justify-center">
              <Text className="text-primary-500 font-poppins-bold text-sm">
                {progress}%
              </Text>
            </View>
          </View>
          <View className="h-2 rounded-full bg-gray-100 mt-3 overflow-hidden">
            <View
              className="h-full rounded-full bg-primary-500"
              style={{ width: `${progress}%` }}
            />
          </View>
        </View>

        <ScrollView
          className="flex-1 mt-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 28 }}
        >
          {loading ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color="#ED6842" />
            </View>
          ) : trainings.length === 0 ? (
            <View className="rounded-2xl border border-dashed border-gray-300 p-8 items-center bg-white">
              <GraduationCap color="#94A3B8" size={34} />
              <Text className="text-primary-500 font-poppins-medium mt-3 text-center">
                Você está em dia
              </Text>
              <Text className="text-secondary-500 text-sm mt-1 text-center">
                Nenhum treinamento foi atribuído à sua função.
              </Text>
            </View>
          ) : (
            <View className="gap-3">
              {trainings.map((t, index) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() =>
                    router.push({
                      pathname: "/trainings/[trainingId]",
                      params: { trainingId: t.id },
                    })
                  }
                  className="rounded-2xl border border-gray-100 bg-white p-4 flex-row items-center gap-3 shadow-sm"
                >
                  <View
                    className={`h-12 w-12 rounded-xl items-center justify-center ${
                      t.completed ? "bg-green-50" : "bg-orange-50"
                    }`}
                  >
                    {t.completed ? (
                      <CheckCircle color="#16A34A" size={24} />
                    ) : (
                      <Play color="#ED6842" size={23} />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-secondary-500 text-[10px]">
                      TREINAMENTO {String(index + 1).padStart(2, "0")}
                    </Text>
                    <Text className="font-poppins-medium text-primary-500">
                      {t.title}
                    </Text>
                    {t.level ? (
                      <Text className="text-secondary-500 text-xs mt-0.5">
                        {t.level}
                      </Text>
                    ) : null}
                  </View>
                  <ChevronRight color="#94A3B8" size={20} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
