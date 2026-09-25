import { useEffect } from "react";
import { useIde } from "../state/IdeState";
import { onOnline, triggerSync } from "../utils/storage";

export function useOnlineSync() {
  const syncQueuedSaves = useIde((s) => s.syncQueuedSaves);

  useEffect(() => {
    // Inspect the persistent queue on mount even while offline, so the
    // beforeunload guard reflects saves left by an earlier session.
    void syncQueuedSaves();

    // Listen for online events
    const unsub = onOnline(() => {
      syncQueuedSaves();
    });

    return unsub;
  }, [syncQueuedSaves]);
}

export { triggerSync };
