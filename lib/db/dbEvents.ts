type Listener = () => void;

const dataChangedListeners = new Set<Listener>();
const pullRequestedListeners = new Set<Listener>();

/**
 * Pub/sub minimalista para notificar o SyncContext (e telas que precisem)
 * que algo mudou no banco local fora do fluxo de pull (ex.: mutação via outbox).
 *
 * Usado para evitar que código não-React (services, sync engine) precise
 * importar contexts do React.
 */
export const dbEvents = {
  subscribe(listener: Listener): () => void {
    dataChangedListeners.add(listener);
    return () => {
      dataChangedListeners.delete(listener);
    };
  },
  emitDataChanged(): void {
    dataChangedListeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error("[dbEvents] listener falhou:", err);
      }
    });
  },
  /**
   * Solicita um pull do servidor (ex.: depois de uma rejeição definitiva
   * que precisa refrescar o estado local da WO).
   */
  subscribePullRequested(listener: Listener): () => void {
    pullRequestedListeners.add(listener);
    return () => {
      pullRequestedListeners.delete(listener);
    };
  },
  emitPullRequested(): void {
    pullRequestedListeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error("[dbEvents] pull listener falhou:", err);
      }
    });
  },
};
