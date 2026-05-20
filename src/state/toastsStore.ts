import { create } from 'zustand';

export type Toast = {
  id: string;
  message: string;
  type: 'error' | 'success' | 'info';
  duration?: number;
};

type ToastsState = {
  toasts: Toast[];
  show: (message: string, type: Toast['type'], duration?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

let toastCounter = 0;

export const useToastsStore = create<ToastsState>((set) => ({
  toasts: [],

  show: (message: string, type: Toast['type'], duration = 4000) => {
    const id = `toast-${++toastCounter}`;
    set((s) => ({
      toasts: [...s.toasts, { id, message, type, duration }],
    }));

    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({
          toasts: s.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }

    return id;
  },

  dismiss: (id: string) => {
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    }));
  },

  clear: () => {
    set({ toasts: [] });
  },
}));
