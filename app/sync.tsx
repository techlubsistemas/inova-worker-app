import { Text } from "@/components/PoppinsText";
import { useNetwork } from "@/context/NetworkContext";
import { useSync } from "@/context/SyncContext";
import { OutboxOp, outboxRepo } from "@/lib/db/repositories/outboxRepo";
import { syncMetaRepo } from "@/lib/db/repositories/syncMetaRepo";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  Clock,
  RefreshCw,
  Trash2,
} from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SyncScreen() {
  const router = useRouter();
  const { isOnline } = useNetwork();
  const {
    outboxCount,
    unacknowledgedOverwrites,
    lastPullAt,
    engineStatus,
    forceSync,
    dataVersion,
  } = useSync();

  const [ops, setOps] = useState<OutboxOp[]>([]);
  const [lastPushAt, setLastPushAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [list, push] = await Promise.all([
      outboxRepo.findAll(),
      syncMetaRepo.get("last_push_at"),
    ]);
    setOps(list);
    setLastPushAt(push);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload, dataVersion]),
  );

  const handleForceSync = async () => {
    setBusy(true);
    try {
      await forceSync();
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleDiscardOp = useCallback(
    (op: OutboxOp) => {
      Alert.alert(
        "Descartar operação?",
        `Esta ação remove definitivamente a operação ${op.entity}.${op.op_type} do outbox. O estado da OS será atualizado pelo servidor na próxima sincronização.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Descartar",
            style: "destructive",
            onPress: async () => {
              await outboxRepo.deleteById(op.id);
              await reload();
            },
          },
        ],
      );
    },
    [reload],
  );

  const deadOps = ops.filter((o) => o.status === "dead");

  const handleDiscardAllDead = useCallback(() => {
    if (deadOps.length === 0) return;
    Alert.alert(
      "Descartar todas as operações com falha?",
      `Isto remove ${deadOps.length} operação(ões) do outbox.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descartar tudo",
          style: "destructive",
          onPress: async () => {
            await outboxRepo.deleteByStatus(["dead"]);
            await reload();
          },
        },
      ],
    );
  }, [deadOps.length, reload]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex flex-row items-center gap-3 px-4 py-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft color="#374151" size={24} />
        </TouchableOpacity>
        <Text className="text-lg font-poppins-semibold text-gray-900">
          Sincronização
        </Text>
      </View>

      <ScrollView className="flex-1">
        {/* Status */}
        <View className="px-4 py-4 gap-3">
          <StatusRow
            label="Conexão"
            value={isOnline ? "Online" : "Offline"}
            tone={isOnline ? "ok" : "warn"}
          />
          <StatusRow
            label="Última sincronização"
            value={formatRelative(lastPullAt)}
            tone={lastPullAt ? "ok" : "warn"}
          />
          <StatusRow
            label="Último envio"
            value={formatRelative(lastPushAt)}
            tone={lastPushAt ? "ok" : "neutral"}
          />
          <StatusRow
            label="Pendentes no envio"
            value={String(outboxCount)}
            tone={outboxCount > 0 ? "warn" : "ok"}
          />
          <StatusRow
            label="OS sobrescritas pelo servidor"
            value={String(unacknowledgedOverwrites)}
            tone={unacknowledgedOverwrites > 0 ? "warn" : "ok"}
          />
          <StatusRow
            label="Estado do motor"
            value={ENGINE_LABELS[engineStatus]}
            tone={engineStatus === "awaiting_auth" ? "warn" : "neutral"}
          />
        </View>

        {/* Action */}
        <View className="px-4 pb-4">
          <TouchableOpacity
            onPress={handleForceSync}
            disabled={busy || !isOnline}
            className={`flex-row items-center justify-center gap-2 py-3 rounded-xl ${busy || !isOnline ? "bg-gray-300" : "bg-orange-500"}`}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <RefreshCw color="#fff" size={18} />
            )}
            <Text className="text-white font-poppins-semibold">
              {busy ? "Sincronizando..." : "Sincronizar agora"}
            </Text>
          </TouchableOpacity>
          {!isOnline && (
            <Text className="text-xs text-gray-500 text-center mt-2">
              Conecte-se à internet para sincronizar.
            </Text>
          )}
        </View>

        {/* Outbox list */}
        <View className="px-4 pb-8">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-poppins-semibold text-gray-700">
              Operações no outbox ({ops.length})
            </Text>
            {deadOps.length > 0 && (
              <TouchableOpacity
                onPress={handleDiscardAllDead}
                className="flex-row items-center gap-1 px-2 py-1 rounded bg-red-50"
              >
                <Trash2 color="#dc2626" size={14} />
                <Text className="text-xs text-red-600 font-poppins-semibold">
                  Descartar falhas ({deadOps.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {ops.length === 0 ? (
            <Text className="text-sm text-gray-500">
              Nenhuma operação pendente.
            </Text>
          ) : (
            ops.map((op) => (
              <OpRow key={op.id} op={op} onDiscard={handleDiscardOp} />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ENGINE_LABELS: Record<string, string> = {
  idle: "Ocioso",
  pulling: "Baixando dados...",
  pushing: "Enviando alterações...",
  awaiting_auth: "Aguardando re-login",
  backoff: "Aguardando próxima tentativa",
};

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const dotColor =
    tone === "ok" ? "bg-green-500" : tone === "warn" ? "bg-amber-500" : "bg-gray-300";
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-2">
        <View className={`w-2 h-2 rounded-full ${dotColor}`} />
        <Text className="text-sm text-gray-700">{label}</Text>
      </View>
      <Text className="text-sm font-poppins-semibold text-gray-900">
        {value}
      </Text>
    </View>
  );
}

function OpRow({
  op,
  onDiscard,
}: {
  op: OutboxOp;
  onDiscard: (op: OutboxOp) => void;
}) {
  const Icon =
    op.status === "done"
      ? CheckCircle2
      : op.status === "dead" || op.status === "failed"
        ? CircleAlert
        : Clock;
  const iconColor =
    op.status === "done"
      ? "#22c55e"
      : op.status === "dead"
        ? "#dc2626"
        : op.status === "failed"
          ? "#f59e0b"
          : "#6b7280";
  return (
    <View className="flex-row items-start gap-3 py-2 border-b border-gray-100">
      <Icon color={iconColor} size={18} />
      <View className="flex-1">
        <Text className="text-sm text-gray-900 font-poppins-semibold">
          {op.entity}.{op.op_type}
        </Text>
        <Text className="text-xs text-gray-500">
          {op.entity_id} · {op.status}
          {op.attempts > 0 ? ` · tentativas: ${op.attempts}` : ""}
        </Text>
        {op.last_error && (
          <Text className="text-xs text-red-600 mt-1">{op.last_error}</Text>
        )}
      </View>
      {op.status === "dead" && (
        <TouchableOpacity
          onPress={() => onDiscard(op)}
          className="px-2 py-1 rounded bg-red-50"
          accessibilityLabel="Descartar operação"
        >
          <Trash2 color="#dc2626" size={14} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Nunca";
  const elapsed = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(elapsed / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min atrás`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h atrás`;
  const day = Math.floor(hr / 24);
  return `${day} d atrás`;
}
