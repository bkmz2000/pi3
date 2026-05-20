import { create } from 'zustand';
import { getHelpRequests, addressHelpRequest, type HelpRequest } from './api';

const BASE_INTERVAL = 10_000;

type NotificationsState = {
  helpRequests: HelpRequest[];
  lastPolledAt: number | null;
  error: string | null;
  address: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  _startPolling: () => void;
  _stopPolling: () => void;
};

let timeoutRef: ReturnType<typeof setTimeout> | null = null;
let consecutiveErrors = 0;
let isPolling = false;

export const useNotificationsStore = create<NotificationsState>((set) => {
  const poll = async () => {
    try {
      const results = await getHelpRequests();
      set({ helpRequests: results, lastPolledAt: Date.now(), error: null });
      consecutiveErrors = 0;
    } catch (e) {
      consecutiveErrors++;
      set({ error: e instanceof Error ? e.message : 'Poll failed' });
    }
  };

  const scheduleNext = () => {
    if (!isPolling) return;
    const errs = consecutiveErrors;
    const delay = errs >= 6 ? 60_000 : errs >= 3 ? 30_000 : BASE_INTERVAL;
    timeoutRef = setTimeout(async () => {
      if (!isPolling) return;
      // Respect document.hidden (don't poll when tab is hidden)
      if (document.hidden) {
        scheduleNext();
        return;
      }
      await poll();
      scheduleNext();
    }, delay);
  };

  return {
    helpRequests: [],
    lastPolledAt: null,
    error: null,

    address: async (id: string) => {
      await addressHelpRequest(id);
      set((s) => ({
        helpRequests: s.helpRequests.filter((r) => r.id !== id),
      }));
    },

    refresh: async () => {
      await poll();
    },

    _startPolling: () => {
      if (isPolling) return;
      isPolling = true;
      poll();
      scheduleNext();
    },

    _stopPolling: () => {
      isPolling = false;
      if (timeoutRef) clearTimeout(timeoutRef);
    },
  };
});
