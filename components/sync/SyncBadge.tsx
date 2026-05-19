import { useSync } from "@/context/SyncContext";
import { useRouter } from "expo-router";
import { Cloud, CloudUpload, RefreshCw } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import { Text } from "../PoppinsText";

interface Props {
  /** Cor do ícone — adapte ao header onde está renderizado. */
  color?: string;
}

/**
 * Badge fixo no header. Mostra contagem do outbox + estado do engine.
 * Sempre visível para que o usuário tenha acesso direto à tela de sync.
 */
export function SyncBadge({ color = "#fff" }: Props) {
  const { outboxCount, engineStatus, unacknowledgedOverwrites } = useSync();
  const router = useRouter();
  const isSyncing = engineStatus === "pulling" || engineStatus === "pushing";
  const total = outboxCount + unacknowledgedOverwrites;

  const IconComponent = isSyncing ? RefreshCw : total > 0 ? CloudUpload : Cloud;

  return (
    <TouchableOpacity
      onPress={() => router.push("/sync" as never)}
      className="relative w-10 h-10 items-center justify-center"
      accessibilityLabel="Abrir sincronização"
    >
      <IconComponent color={color} size={22} />
      {total > 0 && (
        <View
          className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full items-center justify-center px-1 ${unacknowledgedOverwrites > 0 ? "bg-red-600" : "bg-amber-500"}`}
        >
          <Text className="text-white text-[10px] font-poppins-bold">
            {total > 99 ? "99+" : total}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
