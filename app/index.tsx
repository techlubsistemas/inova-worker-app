import { LoginHeader } from "@/components/headers/loginHeader";
import { Text } from "@/components/PoppinsText";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "expo-router";
import { Eye, EyeOff, Lock, User } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function HomeScreen() {
  const [isShowingPassword, setIsShowingPassword] = useState(false);
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const { signIn, isLoading, worker } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && worker) {
      router.replace("/home");
    }
  }, [isLoading, worker, router]);

  async function handleLogin() {
    try {
      if (!cpf || !password) {
        Alert.alert("Erro", "Preencha todos os campos");
        return;
      }
      await signIn(cpf, password);
    } catch (error: any) {
      Alert.alert("Erro no login", error.message);
    }
  }

  if (isLoading) {
    return (
      <View className="h-full w-full bg-white items-center justify-center flex flex-col">
        <ActivityIndicator size="large" color="#ED6842" />
      </View>
    );
  }

  return (
    <View className="h-full w-full bg-white gap-4 flex flex-col">
      <LoginHeader />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="w-full px-4 flex flex-col"
      >
        <View className="flex flex-col gap-8 items-start w-full">
          <View className="w-full flex flex-wrap flex-row items-center justify-center">
            <Text className="text-primary-500 text-3xl font-poppins-semi-bold">
              Entrar no InovAi
            </Text>
          </View>

          <View className="flex flex-col gap-1 w-full">
            <Text className="text-secondary-400 font-poppins-bold">CPF</Text>
            <View className="flex flex-row gap-2 w-full items-center border-[#a3a3a3] border-b">
              <User color={"#ED6842"} />
              <TextInput
                placeholderTextColor={"#a3a3a3"}
                placeholder="Insira o seu CPF"
                className="flex-1 h-12"
                autoCapitalize="none"
                keyboardType="numeric"
                value={cpf}
                onChangeText={setCpf}
              />
            </View>
          </View>

          <View className="flex flex-col gap-1 w-full">
            <Text className="text-secondary-400  font-poppins-bold">Senha</Text>
            <View className="flex flex-row gap-2 w-full items-center border-[#a3a3a3] border-b">
              <Lock color={"#ED6842"} />
              <TextInput
                placeholderTextColor={"#a3a3a3"}
                placeholder="Coloque sua senha"
                className="flex-1 h-12"
                secureTextEntry={!isShowingPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setIsShowingPassword(!isShowingPassword)}
              >
                {isShowingPassword ? (
                  <EyeOff color={"#a3a3a3"} />
                ) : (
                  <Eye color={"#a3a3a3"} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
      <View className="w-full flex flex-col flex-1 p-4 py-14 justify-between">
        <View className="w-full flex flex-col gap-6 items-center">
          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            className={`bg-secondary-500  flex items-center justify-center w-[80%] rounded-xl py-4 ${
              isLoading ? "opacity-50" : ""
            }`}
          >
            <Text className="text-white text-xl font-poppins-bold text-center">
              ENTRAR
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/first-access")}>
            <Text className="text-secondary-500 text-base font-poppins-regular text-center underline">
              Primeiro Acesso? Crie sua senha
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
