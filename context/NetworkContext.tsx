import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

interface NetworkContextData {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
  /** true se o app pode confiavelmente fazer requests (conectado E internet alcançável). */
  isOnline: boolean;
}

const NetworkContext = createContext<NetworkContextData>({
  isConnected: true,
  isInternetReachable: true,
  type: "unknown",
  isOnline: true,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NetInfoState | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((s) => setState(s));
    NetInfo.fetch().then((s) => setState(s));
    return () => unsubscribe();
  }, []);

  const value = useMemo<NetworkContextData>(() => {
    const isConnected = state?.isConnected ?? true;
    // isInternetReachable pode ser null em alguns dispositivos enquanto não testou.
    // Tratamos null como "presumivelmente alcançável" para não bloquear o app.
    const reachable = state?.isInternetReachable;
    const isInternetReachable = reachable === null || reachable === undefined ? isConnected : reachable;
    return {
      isConnected,
      isInternetReachable,
      type: state?.type ?? "unknown",
      isOnline: isConnected && isInternetReachable,
    };
  }, [state]);

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
