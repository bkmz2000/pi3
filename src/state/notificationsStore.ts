import { create } from 'zustand';
import { getHelpRequests, addressHelpRequest, type HelpRequest } from './api';

const BASE_INTERVAL = 10_000;
const ORIGINAL_TITLE = typeof document !== 'undefined' ? document.title : '';

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
let seenIds = new Set<string>();
let firstPoll = true;
let audioCtx: AudioContext | null = null;

function pingForNewRequest() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    // Two-tone chirp, ~180ms total. Quiet.
    const now = audioCtx.currentTime;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    gain.connect(audioCtx.destination);
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.09);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    // Audio may be blocked until user gesture — fail silently.
  }
}

function syncDocumentTitle(pending: number) {
  if (typeof document === 'undefined') return;
  const base = ORIGINAL_TITLE || 'pi3';
  document.title = pending > 0 ? `(${pending}) ${base}` : base;
}

export const useNotificationsStore = create<NotificationsState>((set) => {
  const poll = async () => {
    try {
      const results = await getHelpRequests();
      const newIds = results.filter((r) => !seenIds.has(r.id));
      if (newIds.length > 0 && !firstPoll) {
        pingForNewRequest();
      }
      seenIds = new Set(results.map((r) => r.id));
      firstPoll = false;
      syncDocumentTitle(results.length);
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
      set((s) => {
        const next = s.helpRequests.filter((r) => r.id !== id);
        seenIds.delete(id);
        syncDocumentTitle(next.length);
        return { helpRequests: next };
      });
    },

    refresh: async () => {
      await poll();
    },

    _startPolling: () => {
      if (isPolling) return;
      isPolling = true;
      firstPoll = true;
      poll();
      scheduleNext();
    },

    _stopPolling: () => {
      isPolling = false;
      if (timeoutRef) clearTimeout(timeoutRef);
      syncDocumentTitle(0);
    },
  };
});
