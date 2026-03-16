import { Text } from "@/components/PoppinsText";
import { updateWorkOrderStatus } from "@/services/workOrder";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
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

export default function WorkOrderReportIssueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!id) return;
    const trimmed = description.trim();
    if (!trimmed) {
      Alert.alert("Campo obrigatório", "Descreva o problema encontrado.");
      return;
    }
    setSubmitting(true);
    try {
      await updateWorkOrderStatus(id, {
        status: "cancelled",
        cancellationReason: trimmed,
      });
      router.replace("/home");
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as Error).message
          : "Não foi possível enviar o relato.";
      Alert.alert("Erro", msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <View className="p-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="py-2 self-start"
        >
          <ArrowLeft color="#182D53" size={24} />
        </TouchableOpacity>

        <Text className="text-primary-500 font-poppins-bold text-xl mt-4">
          Relatar problema
        </Text>
        <Text className="text-secondary-500 mt-2">
          Descreva o que impediu a execução desta ordem de serviço. O relato é
          obrigatório.
        </Text>

        <ScrollView className="flex-1 mt-6" keyboardShouldPersistTaps="handled">
          <Text className="text-secondary-400 text-sm font-poppins-bold mb-2">
            Descrição do problema *
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Ex.: Equipamento quebrado; peça não disponível..."
            placeholderTextColor="#a3a3a3"
            multiline
            numberOfLines={4}
            className="border border-gray-300 rounded-xl p-4 min-h-[120px] text-primary-500"
            textAlignVertical="top"
            editable={!submitting}
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
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
