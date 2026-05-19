import { Text } from "@/components/PoppinsText";
import { useLocalAuth } from "@/context/LocalAuthContext";
import { useRouter } from "expo-router";
import { ArrowLeft, Fingerprint, KeyRound } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SecurityScreen() {
  const router = useRouter();
  const {
    hasPin,
    biometricEnabled,
    biometricAvailable,
    setPin,
    setBiometric,
  } = useLocalAuth();

  const [showPinForm, setShowPinForm] = useState(false);
  const [pin, setPin1] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSavePin = async () => {
    if (pin.length < 4) {
      setError("PIN deve ter ao menos 4 dígitos.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PINs não coincidem.");
      return;
    }
    setBusy(true);
    try {
      await setPin(pin);
      setShowPinForm(false);
      setPin1("");
      setPinConfirm("");
      setError(null);
      Alert.alert("PIN configurado", "Seu PIN foi salvo com sucesso.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemovePin = () => {
    Alert.alert(
      "Remover PIN",
      "Sem PIN, o app só pode ser desbloqueado por biometria (se habilitada). Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            await setPin(null);
            Alert.alert("PIN removido");
          },
        },
      ],
    );
  };

  const handleToggleBiometric = async (next: boolean) => {
    if (next && !biometricAvailable) {
      Alert.alert(
        "Biometria indisponível",
        "Configure uma impressão digital ou Face ID nas configurações do seu dispositivo primeiro.",
      );
      return;
    }
    await setBiometric(next);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex flex-row items-center gap-3 px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft color="#374151" size={24} />
        </TouchableOpacity>
        <Text className="text-lg font-poppins-semibold text-gray-900">
          Segurança
        </Text>
      </View>

      <View className="px-4 py-4 gap-6">
        <Text className="text-sm text-gray-600">
          Configure um PIN ou biometria para travar o app quando não estiver em
          uso. Útil para uso em campo onde o dispositivo pode ser deixado
          temporariamente.
        </Text>

        {/* PIN */}
        <View className="gap-3 border border-gray-200 rounded-xl p-4">
          <View className="flex-row items-center gap-3">
            <KeyRound color="#ED6842" size={22} />
            <View className="flex-1">
              <Text className="font-poppins-semibold text-gray-900">PIN</Text>
              <Text className="text-xs text-gray-500">
                {hasPin ? "Configurado" : "Não configurado"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setShowPinForm(!showPinForm);
                setError(null);
              }}
              className="px-3 py-1 rounded-md bg-orange-100"
            >
              <Text className="text-orange-700 text-sm font-poppins-semibold">
                {hasPin ? "Alterar" : "Configurar"}
              </Text>
            </TouchableOpacity>
          </View>

          {showPinForm && (
            <View className="gap-2 mt-2">
              <TextInput
                value={pin}
                onChangeText={(t) => setPin1(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="Novo PIN (4-6 dígitos)"
                className="border border-gray-300 rounded-lg px-3 py-2 font-poppins-regular tracking-widest"
              />
              <TextInput
                value={pinConfirm}
                onChangeText={(t) =>
                  setPinConfirm(t.replace(/\D/g, "").slice(0, 6))
                }
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                placeholder="Confirme o PIN"
                className="border border-gray-300 rounded-lg px-3 py-2 font-poppins-regular tracking-widest"
              />
              {error && (
                <Text className="text-red-600 text-xs">{error}</Text>
              )}
              <TouchableOpacity
                onPress={handleSavePin}
                disabled={busy}
                className={`py-2 rounded-lg ${busy ? "bg-gray-300" : "bg-orange-500"}`}
              >
                <Text className="text-white text-center font-poppins-semibold">
                  Salvar PIN
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {hasPin && !showPinForm && (
            <TouchableOpacity onPress={handleRemovePin} className="mt-1">
              <Text className="text-red-600 text-sm">Remover PIN</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Biometria */}
        <View className="border border-gray-200 rounded-xl p-4">
          <View className="flex-row items-center gap-3">
            <Fingerprint color="#ED6842" size={22} />
            <View className="flex-1">
              <Text className="font-poppins-semibold text-gray-900">
                Biometria
              </Text>
              <Text className="text-xs text-gray-500">
                {biometricAvailable
                  ? biometricEnabled
                    ? "Ativada"
                    : "Disponível mas desativada"
                  : "Indisponível neste dispositivo"}
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleToggleBiometric}
              disabled={!biometricAvailable}
              trackColor={{ true: "#ED6842" }}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
