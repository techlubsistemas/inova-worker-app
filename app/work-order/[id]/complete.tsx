import { Text } from "@/components/PoppinsText";
import { updateWorkOrderStatus } from "@/services/workOrder";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  View,
} from "react-native";

export default function WorkOrderCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleComplete() {
    if (!id) return;
    setSubmitting(true);
    try {
      await updateWorkOrderStatus(id, {
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      router.replace("/home");
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as Error).message
          : "Não foi possível concluir a ordem de serviço.";
      Alert.alert("Erro", msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 bg-white p-4">
      <TouchableOpacity
        onPress={() => router.back()}
        className="py-2 self-start"
      >
        <ArrowLeft color="#182D53" size={24} />
      </TouchableOpacity>

      <View className="flex-1 justify-center px-4">
        <Text className="text-primary-500 font-poppins-bold text-xl text-center">
          Concluir ordem de serviço
        </Text>
        <Text className="text-secondary-500 text-center mt-2">
          Confirme que todos os serviços desta ordem foram realizados com
          sucesso.
        </Text>

        <TouchableOpacity
          onPress={handleComplete}
          disabled={submitting}
          className="mt-8 bg-green-600 rounded-full py-4 items-center justify-center"
        >
          {submitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white font-poppins-bold text-lg">
              CONFIRMAR CONCLUSÃO
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
