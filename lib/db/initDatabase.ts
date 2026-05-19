import { runMigrations } from "./migrations/runner";
import { outboxRepo } from "./repositories/outboxRepo";
import { getDatabase } from "./sqlite";

let initPromise: Promise<void> | null = null;

export function initDatabase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await getDatabase();
      const result = await runMigrations(db);
      if (result.applied.length > 0) {
        console.log(
          `[db] migrations aplicadas: ${result.fromVersion} → ${result.toVersion} (${result.applied.join(", ")})`
        );
      }
      const orphans = await outboxRepo.resetOrphanedSyncing();
      if (orphans > 0) {
        console.log(`[db] resetadas ${orphans} ops 'syncing' órfãs para 'pending'`);
      }
    })();
  }
  return initPromise;
}
