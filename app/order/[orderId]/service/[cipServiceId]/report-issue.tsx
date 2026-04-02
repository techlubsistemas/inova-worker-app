import { Text } from "@/components/PoppinsText";
import {
  fetchProblemReasonsForWorker,
  type ServiceProblemReason,
} from "@/services/problemReasons";
import { updateWorkOrderServiceStatus } from "@/services/workOrder";
import axios from "axios";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const OTHER_ID = "other";

function normalizeParam(p: string | string[] | undefined): string {
  if (p == null) return "";
  return Array.isArray(p) ? (p[0] ?? "") : p;
}

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    if (axios.isAxiosError(err) && err.response?.data) {
      const d = err.response.data as { message?: string };
      if (typeof d.message === "string") return d.message;
    }
    if ("message" in err && typeof (err as Error).message === "string") {
      return (err as Error).message;
    }
  }
  return "Não foi possível enviar o relato.";
}

export default function WorkOrderServiceReportIssueScreen() {
  const params = useLocalSearchParams<{ orderId: string; cipServiceId: string }>();
  const orderId = useMemo(() => normalizeParam(params.orderId), [params.orderId]);
  const cipServiceId = useMemo(
    () => normalizeParam(params.cipServiceId),
    [params.cipServiceId],
  );
  const router = useRouter();
  const [reasons, setReasons] = useState<ServiceProblemReason[]>([]);
  const [loadingReasons, setLoadingReasons] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoadingReasons(true);
      fetchProblemReasonsForWorker()
        .then((res) => {
          if (!cancelled) setReasons(res.reasons ?? []);
        })
        .catch(() => {
          if (!cancelled) setReasons([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingReasons(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  async function handleSubmit() {
    if (!orderId || !cipServiceId) {
      Alert.alert("Erro", "Ordem ou serviço não identificado.");
      return;
    }
    if (selectedId === null) {
      Alert.alert(
        "Campo obrigatório",
        'Selecione um motivo ou "Outro" e descreva a anomalia.',
      );
      return;
    }
    if (selectedId === OTHER_ID) {
      const trimmed = otherText.trim();
      if (!trimmed) {
        Alert.alert(
          "Campo obrigatório",
          'Descreva a anomalia quando escolher "Outro".',
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: {
        status: "cancelled";
        completedAt: string;
        cancellationReason?: string;
        cancellationReasonId?: string;
      } = {
        status: "cancelled",
        completedAt: new Date().toISOString(),
      };
      if (selectedId === OTHER_ID) {
        payload.cancellationReason = otherText.trim();
      } else {
        payload.cancellationReasonId = selectedId;
      }
      await updateWorkOrderServiceStatus(orderId, cipServiceId, payload);
      router.replace({
        pathname: "/order/[orderId]",
        params: { orderId },
      });
    } catch (err) {
      Alert.alert("Erro", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <View className="flex-1 p-4">
        <TouchableOpacity
          onPress={() => router.replace({ pathname: "/order/[orderId]", params: { orderId } })}
          className="py-2 self-start"
        >
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>

        <Text className="text-primary-500 font-poppins-bold text-xl mt-4">
          Relatar anomalia
        </Text>
        <Text className="text-secondary-500 mt-2">
          Selecione o motivo que impediu a execução deste serviço ou escolha
          &quot;Outro&quot; para descrever.
        </Text>

        <ScrollView
          className="flex-1 mt-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {loadingReasons ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color="#ED6842" />
              <Text className="text-secondary-500 mt-2">
                Carregando motivos...
              </Text>
            </View>
          ) : (
            <View className="gap-2">
              {reasons.length === 0 && (
                <Text className="text-secondary-500 text-sm mb-2">
                  Nenhum motivo cadastrado para sua empresa. Use
                  &quot;Outro&quot; para descrever.
                </Text>
              )}
              {reasons.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setSelectedId(r.id)}
                  disabled={submitting}
                  className={`rounded-xl border p-4 flex-row items-center ${
                    selectedId === r.id
                      ? "border-secondary-500 bg-secondary-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full border-2 mr-3 ${
                      selectedId === r.id
                        ? "border-secondary-500 bg-secondary-500"
                        : "border-gray-400"
                    }`}
                  />
                  <Text
                    className={`flex-1 font-poppins-medium ${
                      selectedId === r.id
                        ? "text-primary-600"
                        : "text-primary-500"
                    }`}
                  >
                    {r.name}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => setSelectedId(OTHER_ID)}
                disabled={submitting}
                className={`rounded-xl border p-4 flex-row items-center ${
                  selectedId === OTHER_ID
                    ? "border-secondary-500 bg-secondary-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <View
                  className={`w-5 h-5 rounded-full border-2 mr-3 ${
                    selectedId === OTHER_ID
                      ? "border-secondary-500 bg-secondary-500"
                      : "border-gray-400"
                  }`}
                />
                <Text
                  className={`flex-1 font-poppins-medium ${
                    selectedId === OTHER_ID
                      ? "text-primary-600"
                      : "text-primary-500"
                  }`}
                >
                  Outro
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedId === OTHER_ID && (
            <View className="mt-4">
              <Text className="text-secondary-400 text-sm font-poppins-bold mb-2">
                Descrição da anomalia *
              </Text>
              <TextInput
                value={otherText}
                onChangeText={setOtherText}
                placeholder="Ex.: Equipamento quebrado; peça não disponível..."
                placeholderTextColor="#a3a3a3"
                multiline
                numberOfLines={4}
                className="border border-gray-300 rounded-xl p-4 min-h-[120px] text-primary-500"
                textAlignVertical="top"
                editable={!submitting}
              />
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || selectedId === null}
            className="mt-8 bg-red-500 rounded-full py-4 items-center justify-center"
          >
            {submitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text className="text-white font-poppins-bold text-lg">
                ENVIAR RELATO
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
