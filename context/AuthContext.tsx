import axios from "axios";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

// Throw em vez de fallback pra localhost — build de produção sem env var devia falhar imediatamente
// em vez de tentar conectar ao localhost do dispositivo do usuário.
if (!process.env.EXPO_PUBLIC_API_URL) {
  if (__DEV__) {
    console.warn(
      "[AuthContext] EXPO_PUBLIC_API_URL ausente — usando fallback http://localhost:3333 (apenas DEV)"
    );
  } else {
    throw new Error(
      "EXPO_PUBLIC_API_URL ausente. Configure no eas.json ou .env antes do build de produção."
    );
  }
}
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3333";

export type CompanyModule =
  | "CADASTROS"
  | "PLANEJAMENTO"
  | "ORDENS_SERVICO"
  | "ANOMALIAS"
  | "DASHBOARD"
  | "TREINAMENTOS"
  | "ANALISE_OLEO";

export interface Worker {
  id: string;
  name: string;
  cpf: string;
  company: string;
  companyId?: string;
  /** Módulos contratados pela empresa. Ausente em sessões antigas (trata-se como "tudo liberado"). */
  modules?: CompanyModule[];
}

interface AuthContextData {
  worker: Worker | null;
  isLoading: boolean;
  /** true se a empresa contratou o módulo. Sessão sem `modules` (legado) libera tudo; backend ainda trava. */
  hasModule: (m: CompanyModule) => boolean;
  signIn: (cpf: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  firstAccess: (
    cpf: string,
    tempPassword: string,
    newPassword: string,
    confirmNewPassword: string,
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const signOutRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    async function loadStorageData() {
      const token = await SecureStore.getItemAsync("inova-worker-token");
      const workerData = await SecureStore.getItemAsync("inova-worker-data");

      if (token && workerData) {
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        setWorker(JSON.parse(workerData));
      }
      setIsLoading(false);
    }

    loadStorageData();
  }, []);

  useEffect(() => {
    signOutRef.current = signOut;
  });

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (res) => res,
      (error) => {
        if (error.response?.status === 401) {
          signOutRef.current();
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptorId);
    };
  }, []);

  async function signIn(cpf: string, password: string) {
    try {
      // NUNCA logar password / credenciais no console (vaza em logs do device)
      const response = await axios.post(`${API_URL}/auth/worker/login`, {
        cpf,
        password,
      });

      const { access_token, worker } = response.data;

      axios.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
      await SecureStore.setItemAsync("inova-worker-token", access_token);
      await SecureStore.setItemAsync(
        "inova-worker-data",
        JSON.stringify(worker),
      );

      setWorker(worker);
      router.replace("/home");
    } catch (error: any) {
      if (error.response) {
        throw new Error(error.response.data.message || "Erro ao fazer login");
      } else if (error.request) {
        throw new Error("Sem resposta do servidor. Verifique sua conexão.");
      } else {
        throw new Error(error.message);
      }
    }
  }

  async function firstAccess(
    cpf: string,
    tempPassword: string,
    newPassword: string,
    confirmNewPassword: string,
  ) {
    try {
      // Não loga payload — contém senhas
      await axios.post(`${API_URL}/auth/worker/first-access`, {
        cpf,
        tempPassword,
        newPassword,
        confirmNewPassword,
      });
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          error.response.data.message || "Erro ao cadastrar senha",
        );
      } else if (error.request) {
        throw new Error("Sem resposta do servidor. Verifique sua conexão.");
      } else {
        throw new Error(error.message);
      }
    }
  }

  async function signOut() {
    await SecureStore.deleteItemAsync("inova-worker-token");
    await SecureStore.deleteItemAsync("inova-worker-data");
    setWorker(null);
    router.replace("/");
  }

  function hasModule(m: CompanyModule) {
    // Sessão legada sem `modules`: libera (backend ainda é a trava). Caso contrário, checa a lista.
    if (!worker?.modules) return true;
    return worker.modules.includes(m);
  }

  return (
    <AuthContext.Provider
      value={{ worker, isLoading, hasModule, signIn, signOut, firstAccess }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
