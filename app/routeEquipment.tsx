import { Text } from "@/components/PoppinsText";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { TouchableOpacity, View } from "react-native";

export default function RouteEquipment() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/home");
  }, [router]);

  return (
    <View className="flex-1 bg-white items-center justify-center p-4">
      <Text className="text-secondary-500 text-center">
        Acesse a ordem de serviço pela lista na página inicial.
      </Text>
      <TouchableOpacity
        onPress={() => router.replace("/home")}
        className="mt-4 bg-secondary-500 px-6 py-3 rounded-xl"
      >
        <Text className="text-white font-poppins-bold">Ir para início</Text>
      </TouchableOpacity>
    </View>
  );
}
