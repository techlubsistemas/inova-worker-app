import { useCallback, useState } from "react";
import { fetchMyWorkOrders } from "@/services/workOrder";
import type { WorkOrderApi } from "@/types/workOrder";

export function useWorkOrders() {
  const [workOrders, setWorkOrders] = useState<WorkOrderApi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMyWorkOrders();
      setWorkOrders(res.workOrders ?? []);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as Error).message)
          : "Falha ao carregar ordens de serviço. Verifique sua conexão.";
      setError(message);
      setWorkOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { workOrders, loading, error, refetch };
}
