import { useEffect } from 'react';
import { useUser } from './useUser';
import { useNotificationsStore } from './notificationsStore';

export function useNotifications() {
  const { user } = useUser();
  const helpRequests = useNotificationsStore((s) => s.helpRequests);
  const lastPolledAt = useNotificationsStore((s) => s.lastPolledAt);
  const error = useNotificationsStore((s) => s.error);
  const refresh = useNotificationsStore((s) => s.refresh);
  const address = useNotificationsStore((s) => s.address);
  const startPolling = useNotificationsStore((s) => s._startPolling);
  const stopPolling = useNotificationsStore((s) => s._stopPolling);

  useEffect(() => {
    if (user?.role === 'teacher') {
      startPolling();
      return () => {
        stopPolling();
      };
    }
  }, [user?.role, startPolling, stopPolling]);

  return { helpRequests, lastPolledAt, error, refresh, address };
}
