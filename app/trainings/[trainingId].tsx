import { Text } from "@/components/PoppinsText";
import {
  completeTraining,
  fetchMyTrainings,
  type WorkerTraining,
} from "@/services/trainings";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle,
  ExternalLink,
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
import { WebView } from "react-native-webview";

function normalizeParam(p: string | string[] | undefined): string {
  if (p == null) return "";
  return Array.isArray(p) ? (p[0] ?? "") : p;
}

const KIND_LABEL = {
  video_youtube: "Vídeo (YouTube)",
  video_upload: "Vídeo",
  file: "Arquivo / PDF",
} as const;

type TrainingAttachment = WorkerTraining["attachments"][number];

function youtubeEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const id = host === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.searchParams.get("v") ??
        url.pathname.split("/").filter(Boolean).find((part, index, parts) =>
          ["embed", "shorts", "live"].includes(parts[index - 1] ?? ""),
        );
    return id
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1`
      : null;
  } catch {
    return null;
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function uploadedVideoHtml(url: string): string {
  const safeUrl = escapeHtmlAttribute(url);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body{margin:0;width:100%;height:100%;background:#000}video{width:100%;height:100%;object-fit:contain;background:#000}</style></head><body><video controls playsinline webkit-playsinline preload="metadata" src="${safeUrl}"></video></body></html>`;
}

function InlineVideo({ attachment }: { attachment: TrainingAttachment }) {
  const source = attachment.kind === "video_youtube"
    ? youtubeEmbedUrl(attachment.url)
    : null;

  if (attachment.kind === "video_youtube" && !source) return null;

  return (
    <View className="mt-3 overflow-hidden rounded-xl bg-black">
      <WebView
        source={source ? { uri: source } : { html: uploadedVideoHtml(attachment.url) }}
        style={{ height: 210, backgroundColor: "#000000" }}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction
        allowsInlineMediaPlayback
        scrollEnabled={false}
      />
    </View>
  );
}

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
    <View className="flex-1 bg-gray-50">
      <LinearGradient
        colors={["#182D53", "#244574"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="px-4 pt-5 pb-8 rounded-b-[32px]"
      >
        <TouchableOpacity
          onPress={() => router.replace("/trainings")}
          className="h-10 w-10 rounded-full bg-white/10 items-center justify-center"
        >
          <ArrowLeft color="#FFFFFF" size={22} />
        </TouchableOpacity>
        {!loading && training ? (
          <View className="mt-5">
            <View className="flex-row items-center gap-2">
              <BookOpenCheck color="#ED6842" size={20} />
              <Text className="text-white/70 text-xs">
                TREINAMENTO OPERACIONAL
              </Text>
            </View>
            <Text className="text-white font-poppins-bold text-2xl mt-2">
              {training.title}
            </Text>
            <View className="flex-row items-center gap-2 mt-2">
              {training.level ? (
                <View className="rounded-full bg-white/10 px-3 py-1">
                  <Text className="text-white/80 text-xs">{training.level}</Text>
                </View>
              ) : null}
              {training.completed ? (
                <View className="rounded-full bg-green-500/20 px-3 py-1 flex-row items-center gap-1">
                  <CheckCircle color="#86EFAC" size={13} />
                  <Text className="text-green-200 text-xs">Concluído</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
      </LinearGradient>

      <View className="flex-1 px-4 -mt-4">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#ED6842" />
          </View>
        ) : !training ? (
          <Text className="text-secondary-500 mt-6">
            Treinamento não encontrado.
          </Text>
        ) : (
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 28 }}
          >
            {training.description ? (
              <View className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <Text className="text-secondary-500 text-xs">SOBRE</Text>
                <Text className="text-primary-500 mt-2 leading-6">
                  {training.description}
                </Text>
              </View>
            ) : null}

            <View className="flex-row items-center justify-between mt-6 mb-3">
              <Text className="text-primary-500 font-poppins-bold text-lg">
                Conteúdo
              </Text>
              <Text className="text-secondary-500 text-xs">
                {training.attachments.length} {training.attachments.length === 1 ? "item" : "itens"}
              </Text>
            </View>
            {training.attachments.length === 0 ? (
              <View className="rounded-2xl border border-dashed border-gray-300 p-8 items-center bg-white">
                <FileText color="#94A3B8" size={32} />
                <Text className="text-secondary-500 text-sm mt-2">
                  Sem conteúdo anexado.
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                {training.attachments.map((a, index) => {
                  const isVideo = a.kind === "video_youtube" || a.kind === "video_upload";
                  return (
                  <View
                    key={a.id}
                    className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="h-11 w-11 rounded-xl bg-orange-50 items-center justify-center">
                        {a.kind === "video_youtube" ? (
                          <Youtube color="#EF4444" size={22} />
                        ) : a.kind === "video_upload" ? (
                          <PlayCircle color="#ED6842" size={22} />
                        ) : (
                          <FileText color="#182D53" size={22} />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-secondary-500 text-[10px]">
                          CONTEÚDO {String(index + 1).padStart(2, "0")}
                        </Text>
                        <Text className="font-poppins-medium text-primary-500">
                          {a.originalName ?? KIND_LABEL[a.kind]}
                        </Text>
                      </View>
                    </View>
                    {isVideo ? <InlineVideo attachment={a} /> : null}
                    <TouchableOpacity
                      onPress={() => openAttachment(a.url)}
                      className={`${isVideo ? "mt-3" : "mt-4"} flex-row items-center justify-center gap-2 rounded-xl border border-gray-200 py-3`}
                    >
                      <ExternalLink color="#64748B" size={16} />
                      <Text className="font-poppins-medium text-secondary-500 text-xs">
                        {isVideo ? "ABRIR EM TELA EXTERNA" : "ABRIR / BAIXAR ARQUIVO"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );})}
              </View>
            )}

            {!training.completed && (
              <TouchableOpacity
                onPress={handleComplete}
                disabled={completing}
                className="mt-8 bg-primary-500 rounded-2xl py-4 items-center justify-center shadow-sm"
              >
                {completing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-poppins-bold text-lg">
                    CONCLUIR TREINAMENTO
                  </Text>
                )}
              </TouchableOpacity>
            )}
            {training.completed && (
              <View className="mt-8 rounded-2xl border border-green-100 bg-green-50 p-4 flex-row items-center gap-3">
                <CheckCircle color="#16A34A" size={24} />
                <View className="flex-1">
                  <Text className="font-poppins-medium text-green-800">
                    Treinamento concluído
                  </Text>
                  <Text className="text-green-700 text-xs mt-0.5">
                    Seu progresso já foi registrado para o gestor.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
