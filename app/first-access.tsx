import { LoginHeader } from "@/components/headers/loginHeader";
import { Text } from "@/components/PoppinsText";
import { useAuth } from "@/context/AuthContext";
import { applyCpfMask } from "@/utils/cpfMask";
import { useRouter } from "expo-router";
import { Check, Eye, EyeOff, Key, Lock, User } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function FirstAccessScreen() {
  const [isShowingPassword, setIsShowingPassword] = useState(false);
  const [cpf, setCpf] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const { firstAccess, isLoading } = useAuth();
  const router = useRouter();

  async function handleFirstAccess() {
    try {
      if (!cpf || !tempPassword || !newPassword || !confirmNewPassword) {
        Alert.alert("Erro", "Preencha todos os campos");
        return;
      }
      if (newPassword !== confirmNewPassword) {
        Alert.alert("Erro", "As senhas não coincidem");
        return;
      }

      await firstAccess(
        cpf.replace(/\D/g, ""),
        tempPassword,
        newPassword,
        confirmNewPassword,
      );

      Alert.alert(
        "Sucesso",
        "Senha criada com sucesso! Faça login para continuar.",
      );
      router.back();
    } catch (error: any) {
      Alert.alert("Erro", error.message);
    }
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
            <Text className="text-primary-500 text-2xl font-poppins-semi-bold text-center">
              Primeiro Acesso
            </Text>
            <Text className="text-secondary-400 text-sm font-poppins-regular text-center mt-2">
              Informe seu CPF, a senha temporária recebida e crie uma nova senha.
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
                onChangeText={(text) => setCpf(applyCpfMask(text))}
                maxLength={14}
              />
            </View>
          </View>

          <View className="flex flex-col gap-1 w-full">
            <Text className="text-secondary-400 font-poppins-bold">
              Senha Temporária
            </Text>
            <View className="flex flex-row gap-2 w-full items-center border-[#a3a3a3] border-b">
              <Key color={"#ED6842"} />
              <TextInput
                placeholderTextColor={"#a3a3a3"}
                placeholder="Senha recebida do administrador"
                className="flex-1 h-12"
                autoCapitalize="none"
                value={tempPassword}
                onChangeText={setTempPassword}
              />
            </View>
          </View>

          <View className="flex flex-col gap-1 w-full">
            <Text className="text-secondary-400  font-poppins-bold">
              Nova Senha
            </Text>
            <View className="flex flex-row gap-2 w-full items-center border-[#a3a3a3] border-b">
              <Lock color={"#ED6842"} />
              <TextInput
                placeholderTextColor={"#a3a3a3"}
                placeholder="Crie uma senha"
                className="flex-1 h-12"
                secureTextEntry={!isShowingPassword}
                value={newPassword}
                onChangeText={setNewPassword}
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

          <View className="flex flex-col gap-1 w-full">
            <Text className="text-secondary-400  font-poppins-bold">
              Confirmar Senha
            </Text>
            <View className="flex flex-row gap-2 w-full items-center border-[#a3a3a3] border-b">
              <Check color={"#ED6842"} />
              <TextInput
                placeholderTextColor={"#a3a3a3"}
                placeholder="Confirme a senha"
                className="flex-1 h-12"
                secureTextEntry={!isShowingPassword}
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
      <View className="w-full flex flex-col flex-1 p-4 py-8 justify-between">
        <TouchableOpacity
          onPress={handleFirstAccess}
          disabled={isLoading}
          className={`bg-secondary-500  flex items-center justify-center w-full rounded-xl py-4 ${
            isLoading ? "opacity-50" : ""
          }`}
        >
          <Text className="text-white text-xl font-poppins-bold text-center">
            CRIAR SENHA
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-secondary-500 text-base font-poppins-regular text-center">
            Voltar para Login
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
