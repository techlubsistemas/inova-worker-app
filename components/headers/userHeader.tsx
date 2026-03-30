import { useAuth } from "@/context/AuthContext";
import { LogOut } from "lucide-react-native";
import { Alert, Image, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "../linearGradient";
import { Text } from "../PoppinsText";

export function UserHeader() {
  const { signOut, worker } = useAuth();
  return (
    <View className="w-full h-52 relative rounded-b-[35px] overflow-hidden flex flex-col items-center justify-center ">
      <LinearGradient />
      <View className="flex flex-col gap-2 px-4">
        <View className="flex flex-row w-full h-20 justify-between items-center">
          <Image
            source={require("../../assets/images/logos/logo-white.png")}
            resizeMode="contain"
            className="w-1/3 "
          />
          <TouchableOpacity
            onPress={() => {
              Alert.alert("Sair", "Deseja realmente sair?", [
                {
                  text: "Cancelar",
                  style: "cancel",
                },
                {
                  text: "Sair",
                  onPress: () => signOut(),
                },
              ]);
            }}
          >
            <LogOut color={"#fff"} />
          </TouchableOpacity>
        </View>
        <View className="flex flex-col ">
          <Text className="text-white font-poppins-bold text-2xl">
            Olá {worker?.name ?? ""}
          </Text>
          <Text className="text-white opacity-60">
            {new Intl.DateTimeFormat("pt-BR").format(new Date())}
          </Text>
        </View>
      </View>
    </View>
  );
}
