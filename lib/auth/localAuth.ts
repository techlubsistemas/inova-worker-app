import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const SALT_KEY = "inova-worker-pin-salt";

/**
 * Per-device random salt persistido em SecureStore. Garantida que o mesmo PIN
 * em dispositivos diferentes produza hashes diferentes — útil contra rainbow
 * tables. Para um PIN de 4-6 dígitos isso é segurança suficiente: o atacante
 * precisa do salt (que está no keychain) E do hash (que está no SQLite local),
 * e mesmo então só pode brute-forçar offline (10⁴ a 10⁶ tentativas).
 */
async function getOrCreateSalt(): Promise<string> {
  let salt = await SecureStore.getItemAsync(SALT_KEY);
  if (!salt) {
    const bytes = await Crypto.getRandomBytesAsync(16);
    salt = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    await SecureStore.setItemAsync(SALT_KEY, salt);
  }
  return salt;
}

export async function hashPin(pin: string): Promise<string> {
  const salt = await getOrCreateSalt();
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`
  );
}

export async function verifyPin(pin: string, expectedHash: string): Promise<boolean> {
  const got = await hashPin(pin);
  return got === expectedHash;
}

export interface BiometricCapability {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

export async function detectBiometricCapability(): Promise<BiometricCapability> {
  const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  return { hasHardware, isEnrolled, supportedTypes };
}

export async function promptBiometric(reason: string): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: "Cancelar",
    fallbackLabel: "Usar PIN",
    disableDeviceFallback: false,
  });
  return result.success;
}

/** Limpa o salt local (chamar em hard logout). */
export async function clearLocalAuthSalt(): Promise<void> {
  await SecureStore.deleteItemAsync(SALT_KEY);
}
