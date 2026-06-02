import { useEffect } from "react";
import { useIde } from "../state/IdeState";
import { onOnline, isOnline, triggerSync } from "../utils/storage";

export function useOnlineSync() {
  const syncQueuedSaves = useIde((s) => s.syncQueuedSaves);

  useEffect(() => {
    // Sync on mount if online
    if (isOnline()) {
      syncQueuedSaves();
    }

    // Listen for online events
    const unsub = onOnline(() => {
      syncQueuedSaves();
    });

    return unsub;
  }, [syncQueuedSaves]);
}

export { triggerSync };
