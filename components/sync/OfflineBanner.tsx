import { useNetwork } from "@/context/NetworkContext";
import { useSync } from "@/context/SyncContext";
import { CloudOff, WifiOff } from "lucide-react-native";
import { View } from "react-native";
import { Text } from "../PoppinsText";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type BannerMode = "never_synced" | "stale" | "offline" | null;

function pickMode(
  isOnline: boolean,
  lastPullAt: string | null,
): BannerMode {
  if (isOnline) return null;
  if (!lastPullAt) return "never_synced";
  const elapsed = Date.now() - new Date(lastPullAt).getTime();
  if (elapsed > SEVEN_DAYS_MS) return "stale";
  return "offline";
}

const MODE_STYLES: Record<
  Exclude<BannerMode, null>,
  { bg: string; text: string; icon: typeof WifiOff; title: string; subtitle: string }
> = {
  never_synced: {
    bg: "bg-red-600",
    text: "text-white",
    icon: CloudOff,
    title: "Você nunca sincronizou",
    subtitle: "Conecte-se à internet para baixar suas ordens de serviço.",
  },
  stale: {
    bg: "bg-amber-700",
    text: "text-white",
    icon: CloudOff,
    title: "Dados desatualizados",
    subtitle: "Sem sincronizar há mais de 7 dias. Verifique sua conexão.",
  },
  offline: {
    bg: "bg-amber-500",
    text: "text-white",
    icon: WifiOff,
    title: "Sem conexão",
    subtitle: "Suas alterações serão sincronizadas quando voltar a rede.",
  },
};

export function OfflineBanner() {
  const { isOnline } = useNetwork();
  const { lastPullAt } = useSync();
  const mode = pickMode(isOnline, lastPullAt);
  if (!mode) return null;

  const style = MODE_STYLES[mode];
  const Icon = style.icon;

  return (
    <View className={`${style.bg} flex flex-row items-center gap-3 px-4 py-2`}>
      <Icon color="#fff" size={20} />
      <View className="flex-1">
        <Text className={`${style.text} font-poppins-semibold text-sm`}>
          {style.title}
        </Text>
        <Text className={`${style.text} text-xs opacity-90`}>
          {style.subtitle}
        </Text>
      </View>
    </View>
  );
}
