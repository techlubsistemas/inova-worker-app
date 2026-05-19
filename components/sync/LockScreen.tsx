import { Text } from "@/components/PoppinsText";
import { useAuth } from "@/context/AuthContext";
import { useLocalAuth } from "@/context/LocalAuthContext";
import { Fingerprint, LockKeyhole } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Tela full-screen de destravamento. Renderizada como overlay quando
 * `LocalAuthContext.state` é "locked_pin" ou "locked_biometric".
 */
export function LockScreen() {
  const { worker, signOut } = useAuth();
  const {
    state,
    hasPin,
    biometricEnabled,
    biometricAvailable,
    unlockWithPin,
    unlockWithBiometric,
  } = useLocalAuth();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state === "locked_biometric" && biometricAvailable && biometricEnabled) {
      // Auto-trigger biometric prompt when entering the locked_biometric state.
      unlockWithBiometric();
    }
  }, [state, biometricAvailable, biometricEnabled, unlockWithBiometric]);

  const handleSubmitPin = async () => {
    if (pin.length < 4) {
      setError("PIN deve ter ao menos 4 dígitos.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ok = await unlockWithPin(pin);
      if (!ok) {
        setError("PIN incorreto.");
        setPin("");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLogoutInstead = () => {
    Alert.alert(
      "Sair",
      "Você precisará fazer login novamente com CPF e senha. Operações offline pendentes serão preservadas.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: () => signOut(),
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <View className="flex-1 items-center justify-center px-6 gap-6">
        <View className="w-20 h-20 rounded-full bg-orange-100 items-center justify-center">
          {state === "locked_biometric" ? (
            <Fingerprint color="#ED6842" size={40} />
          ) : (
            <LockKeyhole color="#ED6842" size={40} />
          )}
        </View>
        <View className="items-center gap-1">
          <Text className="text-xl font-poppins-bold text-gray-900">
            App bloqueado
          </Text>
          <Text className="text-sm text-gray-600 text-center">
            Olá {worker?.name?.split(" ")[0] ?? ""}, confirme sua identidade
            para continuar.
          </Text>
        </View>

        {state === "locked_pin" && hasPin && (
          <View className="w-full gap-3">
            <TextInput
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              placeholder="Digite seu PIN"
              className="border border-gray-300 rounded-xl px-4 py-3 text-center text-lg font-poppins-semibold tracking-widest"
              autoFocus
            />
            {error && (
              <Text className="text-red-600 text-sm text-center">{error}</Text>
            )}
            <TouchableOpacity
              onPress={handleSubmitPin}
              disabled={busy}
              className={`py-3 rounded-xl ${busy ? "bg-gray-300" : "bg-orange-500"}`}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-center font-poppins-semibold">
                  Desbloquear
                </Text>
              )}
            </TouchableOpacity>
            {biometricAvailable && biometricEnabled && (
              <TouchableOpacity onPress={unlockWithBiometric} className="py-2">
                <Text className="text-orange-500 text-center font-poppins-semibold">
                  Usar biometria
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {state === "locked_biometric" && (
          <TouchableOpacity onPress={unlockWithBiometric} className="py-3 px-6 bg-orange-500 rounded-xl">
            <Text className="text-white font-poppins-semibold">
              Tentar biometria novamente
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleLogoutInstead} className="py-2">
          <Text className="text-gray-500 text-sm">Sair e fazer login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
