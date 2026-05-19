type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Pub/sub minimalista para notificar o SyncContext (e telas que precisem)
 * que algo mudou no banco local fora do fluxo de pull (ex.: mutação via outbox).
 *
 * Usado para evitar que código não-React (services, sync engine) precise
 * importar contexts do React.
 */
export const dbEvents = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  emitDataChanged(): void {
    listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error("[dbEvents] listener falhou:", err);
      }
    });
  },
};
