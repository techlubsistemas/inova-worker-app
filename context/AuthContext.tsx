import axios from "axios";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

export const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3333";

export interface Worker {
  id: string;
  name: string;
  cpf: string;
  company: string;
  companyId?: string;
}

interface AuthContextData {
  worker: Worker | null;
  isLoading: boolean;
  signIn: (cpf: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  firstAccess: (
    cpf: string,
    password: string,
    confirmPassword: string,
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
      console.log("--- SIGN IN START ---");
      console.log("Sending request to:", `${API_URL}/auth/worker/login`);
      console.log("Payload:", { cpf, password });

      const response = await axios.post(`${API_URL}/auth/worker/login`, {
        cpf,
        password,
      });

      console.log("Response Status:", response.status);
      console.log("Response Data:", response.data);

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
      console.error("--- SIGN IN ERROR ---");
      console.error("Error Object:", error);
      if (error.response) {
        console.error("Error Response Status:", error.response.status);
        console.error("Error Response Data:", error.response.data);
        throw new Error(error.response.data.message || "Erro ao fazer login");
      } else if (error.request) {
        console.error("Error Request:", error.request);
        throw new Error("Sem resposta do servidor. Verifique sua conexão.");
      } else {
        console.error("Error Message:", error.message);
        throw new Error(error.message);
      }
    }
  }

  async function firstAccess(
    cpf: string,
    password: string,
    confirmPassword: string,
  ) {
    try {
      console.log("--- FIRST ACCESS START ---");
      console.log("Sending request to:", `${API_URL}/auth/worker/first-access`);
      // Warning: Don't log passwords in production. For now keeping it for debug request.
      console.log("Payload:", { cpf, password, confirmPassword });

      const response = await axios.post(`${API_URL}/auth/worker/first-access`, {
        cpf,
        password,
        confirmPassword,
      });

      console.log("Response Status:", response.status);
      console.log("Response Data:", response.data);
    } catch (error: any) {
      console.error("--- FIRST ACCESS ERROR ---");
      console.error("Error Object:", error);
      if (error.response) {
        console.error("Error Response Status:", error.response.status);
        console.error("Error Response Data:", error.response.data);
        throw new Error(
          error.response.data.message || "Erro ao cadastrar senha",
        );
      } else if (error.request) {
        console.error("Error Request:", error.request);
        throw new Error("Sem resposta do servidor. Verifique sua conexão.");
      } else {
        console.error("Error Message:", error.message);
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

  return (
    <AuthContext.Provider
      value={{ worker, isLoading, signIn, signOut, firstAccess }}
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
