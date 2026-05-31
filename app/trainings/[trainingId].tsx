import { Text } from "@/components/PoppinsText";
import {
  completeTraining,
  fetchMyTrainings,
  type WorkerTraining,
} from "@/services/trainings";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  PlayCircle,
  Youtube,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";

function normalizeParam(p: string | string[] | undefined): string {
  if (p == null) return "";
  return Array.isArray(p) ? (p[0] ?? "") : p;
}

const KIND_LABEL = {
  video_youtube: "Vídeo (YouTube)",
  video_upload: "Vídeo",
  file: "Arquivo / PDF",
} as const;

export default function TrainingDetailScreen() {
  const params = useLocalSearchParams<{ trainingId: string }>();
  const trainingId = useMemo(
    () => normalizeParam(params.trainingId),
    [params.trainingId],
  );
  const router = useRouter();
  const [training, setTraining] = useState<WorkerTraining | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMyTrainings()
      .then((list) => {
        if (!cancelled) setTraining(list.find((t) => t.id === trainingId) ?? null);
      })
      .catch(() => {
        if (!cancelled) setTraining(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [trainingId]);

  async function openAttachment(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o conteúdo.");
    }
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      await completeTraining(trainingId);
      setTraining((t) => (t ? { ...t, completed: true } : t));
      Alert.alert("Pronto", "Treinamento marcado como concluído.");
    } catch {
      Alert.alert("Erro", "Não foi possível marcar como concluído.");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 p-4">
        <TouchableOpacity
          onPress={() => router.replace("/trainings")}
          className="py-2 self-start"
        >
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#ED6842" />
          </View>
        ) : !training ? (
          <Text className="text-secondary-500 mt-6">
            Treinamento não encontrado.
          </Text>
        ) : (
          <ScrollView className="flex-1 mt-4" showsVerticalScrollIndicator={false}>
            <View className="flex-row items-center gap-2">
              <Text className="text-primary-500 font-poppins-bold text-xl flex-1">
                {training.title}
              </Text>
              {training.completed && <CheckCircle color="#16a34a" size={22} />}
            </View>
            {training.level ? (
              <Text className="text-secondary-500 mt-1">{training.level}</Text>
            ) : null}
            {training.description ? (
              <Text className="text-secondary-500 mt-3">
                {training.description}
              </Text>
            ) : null}

            <Text className="text-primary-500 font-poppins-bold mt-6 mb-2">
              Conteúdo
            </Text>
            {training.attachments.length === 0 ? (
              <Text className="text-secondary-500 text-sm">
                Sem conteúdo anexado.
              </Text>
            ) : (
              <View className="gap-2">
                {training.attachments.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => openAttachment(a.url)}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex-row items-center gap-3"
                  >
                    {a.kind === "video_youtube" ? (
                      <Youtube color="#ef4444" size={22} />
                    ) : a.kind === "video_upload" ? (
                      <PlayCircle color="#ED6842" size={22} />
                    ) : (
                      <FileText color="#182D53" size={22} />
                    )}
                    <Text className="flex-1 font-poppins-medium text-primary-500">
                      {a.originalName ?? KIND_LABEL[a.kind]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!training.completed && (
              <TouchableOpacity
                onPress={handleComplete}
                disabled={completing}
                className="mt-8 bg-primary-500 rounded-full py-4 items-center justify-center"
              >
                {completing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-poppins-bold text-lg">
                    MARCAR COMO CONCLUÍDO
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
