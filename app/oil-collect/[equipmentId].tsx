import { Text } from "@/components/PoppinsText";
import { collectOilSample } from "@/services/oilSample";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Droplets } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

function normalizeParam(p: string | string[] | undefined): string {
  if (p == null) return "";
  return Array.isArray(p) ? (p[0] ?? "") : p;
}

export default function OilCollectScreen() {
  const params = useLocalSearchParams<{
    equipmentId: string;
    equipmentTag?: string;
  }>();
  const equipmentId = useMemo(
    () => normalizeParam(params.equipmentId),
    [params.equipmentId],
  );
  const equipmentTag = useMemo(
    () => normalizeParam(params.equipmentTag),
    [params.equipmentTag],
  );
  const router = useRouter();
  const [sampleCode, setSampleCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!equipmentId) {
      Alert.alert("Erro", "Equipamento não identificado.");
      return;
    }
    setSubmitting(true);
    try {
      await collectOilSample({
        equipmentId,
        sampleCode: sampleCode.trim() || undefined,
      });
      Alert.alert(
        "Coleta registrada",
        "A amostra foi registrada e aparecerá na análise de óleo do sistema.",
      );
      router.back();
    } catch {
      Alert.alert("Erro", "Não foi possível registrar a coleta.");
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
          onPress={() => router.back()}
          className="py-2 self-start"
        >
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>

        <View className="flex-row items-center gap-2 mt-4">
          <Droplets color="#182D53" size={22} />
          <Text className="text-primary-500 font-poppins-bold text-xl">
            Coletar amostra de óleo
          </Text>
        </View>
        {equipmentTag ? (
          <Text className="text-secondary-500 mt-1">
            Equipamento: {equipmentTag}
          </Text>
        ) : null}

        <View className="mt-6">
          <Text className="text-secondary-400 text-sm font-poppins-bold mb-2">
            Código da amostra (opcional)
          </Text>
          <TextInput
            value={sampleCode}
            onChangeText={setSampleCode}
            placeholder="Ex.: AMO-001"
            placeholderTextColor="#a3a3a3"
            className="border border-gray-300 rounded-xl p-4 text-primary-500"
            editable={!submitting}
            autoCapitalize="characters"
          />
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          className="mt-8 bg-primary-500 rounded-full py-4 items-center justify-center"
        >
          {submitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white font-poppins-bold text-lg">
              REGISTRAR COLETA
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
