import { useEffect, useRef, useState, useCallback } from 'react';
import { useUser } from './useUser';
import { getHelpRequests, addressHelpRequest, type HelpRequest } from './api';

const BASE_INTERVAL = 10_000;

export function useNotifications() {
  const { user } = useUser();
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([]);
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const consecutiveErrors = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    try {
      const results = await getHelpRequests();
      if (!mountedRef.current) return;
      setHelpRequests(results);
      setLastPolledAt(Date.now());
      setError(null);
      consecutiveErrors.current = 0;
    } catch (e) {
      if (!mountedRef.current) return;
      consecutiveErrors.current++;
      setError(e instanceof Error ? e.message : 'Poll failed');
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'teacher') return;
    mountedRef.current = true;

    function scheduleNext() {
      if (!mountedRef.current) return;
      const errs = consecutiveErrors.current;
      const delay = errs >= 6 ? 60_000 : errs >= 3 ? 30_000 : BASE_INTERVAL;
      timeoutRef.current = setTimeout(async () => {
        if (document.hidden) { scheduleNext(); return; }
        await poll();
        scheduleNext();
      }, delay);
    }

    poll();
    scheduleNext();

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user?.role, poll]);

  const address = useCallback(async (id: string) => {
    await addressHelpRequest(id);
    setHelpRequests(prev => prev.filter(r => r.id !== id));
  }, []);

  const refresh = useCallback(() => { poll(); }, [poll]);

  return { helpRequests, lastPolledAt, error, refresh, address };
}
