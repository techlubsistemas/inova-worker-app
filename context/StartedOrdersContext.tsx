import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const STORAGE_KEY = "inova-worker-started-orders";
const LEGACY_STORAGE_KEY = "inova-worker-started-routes";

/** Chave única por ordem: "route-{routeId}" ou "single-{workOrderId}". */
export function orderKey(type: "route" | "single", id: string): string {
  return `${type}-${id}`;
}

interface StartedOrdersContextData {
  startedOrderKeys: Set<string>;
  isOrderStarted: (key: string) => boolean;
  startOrder: (key: string) => Promise<void>;
  finishOrder: (key: string) => void;
  isLoading: boolean;
  /** Compatibilidade com telas de rota. */
  isRouteStarted: (routeId: string) => boolean;
  startRoute: (routeId: string) => Promise<void>;
  finishRoute: (routeId: string) => void;
}

const StartedOrdersContext = createContext<StartedOrdersContextData>(
  {} as StartedOrdersContextData
);

function normalizeStoredKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string").map((x) => {
    if (x.startsWith("route-") || x.startsWith("single-")) return x;
    return `route-${x}`;
  });
}

export function StartedOrdersProvider({ children }: { children: React.ReactNode }) {
  const [startedOrderKeys, setStartedOrderKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      SecureStore.getItemAsync(STORAGE_KEY),
      SecureStore.getItemAsync(LEGACY_STORAGE_KEY),
    ])
      .then(([raw, legacyRaw]) => {
        if (cancelled) return;
        let keys: string[] = [];
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as unknown;
            keys = normalizeStoredKeys(parsed);
          } catch {
            // ignore
          }
        }
        if (keys.length === 0 && legacyRaw) {
          try {
            const legacyIds = JSON.parse(legacyRaw) as unknown;
            keys = Array.isArray(legacyIds)
              ? (legacyIds as string[]).map((id) => `route-${id}`)
              : [];
            if (keys.length > 0) {
              SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(keys));
              SecureStore.deleteItemAsync(LEGACY_STORAGE_KEY).catch(() => {});
            }
          } catch {
            // ignore
          }
        }
        setStartedOrderKeys(new Set(keys));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((keys: Set<string>) => {
    SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(Array.from(keys))).catch(() => {});
  }, []);

  const isOrderStarted = useCallback(
    (key: string) => startedOrderKeys.has(key),
    [startedOrderKeys]
  );

  const startOrder = useCallback(
    async (key: string) => {
      setStartedOrderKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const finishOrder = useCallback((key: string) => {
    setStartedOrderKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      persist(next);
      return next;
    });
  }, [persist]);

  const isRouteStarted = useCallback(
    (routeId: string) => isOrderStarted(orderKey("route", routeId)),
    [isOrderStarted]
  );

  const startRoute = useCallback(
    (routeId: string) => startOrder(orderKey("route", routeId)),
    [startOrder]
  );

  const finishRoute = useCallback(
    (routeId: string) => finishOrder(orderKey("route", routeId)),
    [finishOrder]
  );

  return (
    <StartedOrdersContext.Provider
      value={{
        startedOrderKeys,
        isOrderStarted,
        startOrder,
        finishOrder,
        isLoading,
        isRouteStarted,
        startRoute,
        finishRoute,
      }}
    >
      {children}
    </StartedOrdersContext.Provider>
  );
}

export function useStartedOrders() {
  return useContext(StartedOrdersContext);
}
