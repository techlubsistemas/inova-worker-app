import {
  detectBiometricCapability,
  hashPin,
  promptBiometric,
  verifyPin,
} from "@/lib/auth/localAuth";
import { authLocalRepo } from "@/lib/db/repositories/authLocalRepo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth } from "./AuthContext";
import { useSync } from "./SyncContext";

type LockState = "loading" | "unlocked" | "locked_pin" | "locked_biometric";

interface LocalAuthContextData {
  state: LockState;
  hasPin: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  /** Tenta destravar com PIN. Retorna true se sucesso. */
  unlockWithPin: (pin: string) => Promise<boolean>;
  /** Tenta destravar com biometria. Retorna true se sucesso. */
  unlockWithBiometric: () => Promise<boolean>;
  /** Cria/redefine o PIN local. Pin vazio remove. */
  setPin: (pin: string | null) => Promise<void>;
  /** Habilita/desabilita biometria. */
  setBiometric: (enabled: boolean) => Promise<void>;
}

const LocalAuthContext = createContext<LocalAuthContextData | undefined>(undefined);

export function LocalAuthProvider({ children }: { children: React.ReactNode }) {
  const { worker } = useAuth();
  const { dbReady } = useSync();
  const [state, setState] = useState<LockState>("loading");
  const [hasPin, setHasPin] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const wasUnlockedRef = useRef(false);

  // Detecta capacidade biométrica do dispositivo (independente de estar habilitado).
  useEffect(() => {
    detectBiometricCapability().then((cap) => {
      setBiometricAvailable(cap.hasHardware && cap.isEnrolled);
    });
  }, []);

  // Carrega config do worker no DB local.
  const loadConfig = useCallback(async () => {
    if (!worker || !dbReady) return null;
    const row = await authLocalRepo.get(worker.id);
    setHasPin(!!row?.pin_hash);
    setBiometricEnabled((row?.biometric_enabled ?? 0) === 1);
    return row;
  }, [worker, dbReady]);

  // Decide o estado inicial: travado ou destravado.
  useEffect(() => {
    if (!worker || !dbReady) {
      setState("loading");
      wasUnlockedRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      const row = await loadConfig();
      if (cancelled) return;
      const has = !!row?.pin_hash;
      const bio = (row?.biometric_enabled ?? 0) === 1;
      if (!has && !bio) {
        // Worker sem PIN/biometria configurados — nada a travar.
        setState("unlocked");
        wasUnlockedRef.current = true;
        return;
      }
      // Trava no primeiro carregamento. Biometria tem prioridade se disponível.
      setState(bio && biometricAvailable ? "locked_biometric" : "locked_pin");
    })();
    return () => {
      cancelled = true;
    };
  }, [worker, dbReady, biometricAvailable, loadConfig]);

  // Re-trava quando volta do background (se PIN/biometria configurados).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        if (wasUnlockedRef.current && (hasPin || biometricEnabled)) {
          setState(
            biometricEnabled && biometricAvailable
              ? "locked_biometric"
              : "locked_pin"
          );
          wasUnlockedRef.current = false;
        }
      }
    });
    return () => sub.remove();
  }, [hasPin, biometricEnabled, biometricAvailable]);

  const unlockWithPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!worker) return false;
      const row = await authLocalRepo.get(worker.id);
      if (!row?.pin_hash) return false;
      const ok = await verifyPin(pin, row.pin_hash);
      if (ok) {
        setState("unlocked");
        wasUnlockedRef.current = true;
      }
      return ok;
    },
    [worker]
  );

  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    const ok = await promptBiometric("Confirme sua identidade para continuar");
    if (ok) {
      setState("unlocked");
      wasUnlockedRef.current = true;
    } else if (hasPin) {
      // Fallback para PIN se biometria falhar.
      setState("locked_pin");
    }
    return ok;
  }, [hasPin]);

  const setPin = useCallback(
    async (pin: string | null) => {
      if (!worker) return;
      const hash = pin ? await hashPin(pin) : null;
      await authLocalRepo.setPin(worker.id, hash);
      setHasPin(!!hash);
    },
    [worker]
  );

  const setBiometric = useCallback(
    async (enabled: boolean) => {
      if (!worker) return;
      await authLocalRepo.setBiometric(worker.id, enabled);
      setBiometricEnabled(enabled);
    },
    [worker]
  );

  return (
    <LocalAuthContext.Provider
      value={{
        state,
        hasPin,
        biometricEnabled,
        biometricAvailable,
        unlockWithPin,
        unlockWithBiometric,
        setPin,
        setBiometric,
      }}
    >
      {children}
    </LocalAuthContext.Provider>
  );
}

export function useLocalAuth() {
  const ctx = useContext(LocalAuthContext);
  if (!ctx) {
    throw new Error("useLocalAuth must be used within a LocalAuthProvider");
  }
  return ctx;
}
