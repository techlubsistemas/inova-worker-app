import { fetchMyWorkOrders } from "@/services/workOrder";
import type { WorkOrderApi } from "@/types/workOrder";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

const CACHE_TTL = 30_000; // 30 seconds

interface WorkOrdersContextValue {
  workOrders: WorkOrderApi[];
  loading: boolean;
  error: string | null;
  /** Force-refetch from API regardless of cache. */
  refetch: () => Promise<void>;
  /** Refetch only if cache is stale (older than CACHE_TTL). */
  refetchIfStale: () => Promise<void>;
  /** Optimistically update a single work order in local state. */
  updateLocal: (
    orderId: string,
    updater: (wo: WorkOrderApi) => WorkOrderApi,
  ) => void;
}

const WorkOrdersContext = createContext<WorkOrdersContextValue | null>(null);

export function WorkOrdersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [workOrders, setWorkOrders] = useState<WorkOrderApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedAt = useRef(0);
  const fetchingRef = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    // Deduplicate concurrent calls — if a fetch is already in-flight, reuse it
    if (fetchingRef.current) {
      await fetchingRef.current;
      return;
    }

    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchMyWorkOrders();
        setWorkOrders(res.workOrders ?? []);
        lastFetchedAt.current = Date.now();
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "message" in err
            ? String((err as Error).message)
            : "Falha ao carregar ordens de serviço.";
        setError(message);
      } finally {
        setLoading(false);
        fetchingRef.current = null;
      }
    })();

    fetchingRef.current = promise;
    await promise;
  }, []);

  const refetchIfStale = useCallback(async () => {
    if (Date.now() - lastFetchedAt.current > CACHE_TTL) {
      await refetch();
    }
  }, [refetch]);

  const updateLocal = useCallback(
    (orderId: string, updater: (wo: WorkOrderApi) => WorkOrderApi) => {
      setWorkOrders((prev) =>
        prev.map((wo) => (wo.id === orderId ? updater(wo) : wo)),
      );
    },
    [],
  );

  const value = useMemo<WorkOrdersContextValue>(
    () => ({
      workOrders,
      loading,
      error,
      refetch,
      refetchIfStale,
      updateLocal,
    }),
    [workOrders, loading, error, refetch, refetchIfStale, updateLocal],
  );

  return (
    <WorkOrdersContext.Provider value={value}>
      {children}
    </WorkOrdersContext.Provider>
  );
}

export function useWorkOrders(): WorkOrdersContextValue {
  const ctx = useContext(WorkOrdersContext);
  if (!ctx) {
    throw new Error("useWorkOrders must be used within WorkOrdersProvider");
  }
  return ctx;
}
