import { useSync } from "@/context/SyncContext";
import { serverOverwritesRepo, type ServerOverwriteRow } from "@/lib/db/repositories/serverOverwritesRepo";
import { workOrdersRepo } from "@/lib/db/repositories/workOrdersRepo";
import { AlertTriangle, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Text } from "../PoppinsText";

interface OverwriteWithCode extends ServerOverwriteRow {
  workOrderCode?: number | null;
}

/**
 * Banner persistente listando OS cujas alterações offline foram descartadas
 * pelo servidor. Aparece no topo das telas até que o usuário dispense.
 */
export function ServerOverwriteAlert() {
  const { unacknowledgedOverwrites, dataVersion, refreshCounters } = useSync();
  const [items, setItems] = useState<OverwriteWithCode[]>([]);

  useEffect(() => {
    if (unacknowledgedOverwrites === 0) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const rows = await serverOverwritesRepo.listUnacknowledged();
      const enriched = await Promise.all(
        rows.map(async (r) => {
          const wo = await workOrdersRepo.findById(r.work_order_id);
          return {
            ...r,
            workOrderCode: (wo?.data.code as number | null | undefined) ?? null,
          };
        }),
      );
      if (!cancelled) setItems(enriched);
    })();
    return () => {
      cancelled = true;
    };
  }, [unacknowledgedOverwrites, dataVersion]);

  if (items.length === 0) return null;

  const handleDismissAll = async () => {
    await serverOverwritesRepo.acknowledgeAll();
    await refreshCounters();
  };

  return (
    <View className="bg-amber-100 border-b border-amber-300">
      <View className="flex flex-row items-start gap-3 px-4 py-3">
        <AlertTriangle color="#b45309" size={20} />
        <View className="flex-1">
          <Text className="text-amber-900 font-poppins-semibold text-sm">
            {items.length === 1
              ? "1 OS foi atualizada pelo escritório"
              : `${items.length} OS foram atualizadas pelo escritório`}
          </Text>
          <Text className="text-amber-800 text-xs mt-0.5">
            Suas alterações offline para{" "}
            {items
              .slice(0, 3)
              .map((i) => `OS ${formatCode(i.workOrderCode)}`)
              .join(", ")}
            {items.length > 3 ? ` e mais ${items.length - 3}` : ""} foram
            descartadas.
          </Text>
        </View>
        <TouchableOpacity onPress={handleDismissAll} className="p-1">
          <X color="#b45309" size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatCode(code: number | null | undefined): string {
  if (code == null) return "—";
  return String(code).padStart(8, "0");
}
