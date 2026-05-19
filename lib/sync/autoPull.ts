import { syncMetaRepo } from "../db/repositories/syncMetaRepo";
import { runWorkerPull, PullResult } from "./bootstrap";

const AUTO_PULL_THROTTLE_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Versão throttled do pull, usada por triggers automáticos (foreground,
 * recuperação de rede, intervalo de fundo). Se a última pull foi há menos
 * de 5min, faz no-op.
 *
 * Para forçar pull manual (botão "Sincronizar agora"), use `runWorkerPull`
 * diretamente.
 */
export async function maybeAutoPull(): Promise<PullResult | { ok: true; skipped: true }> {
  const lastPullAt = await syncMetaRepo.get("last_pull_at");
  if (lastPullAt) {
    const elapsed = Date.now() - new Date(lastPullAt).getTime();
    if (elapsed < AUTO_PULL_THROTTLE_MS) {
      return { ok: true, skipped: true };
    }
  }
  return runWorkerPull();
}

export const AUTO_PULL_INTERVAL_MS = AUTO_PULL_THROTTLE_MS;
