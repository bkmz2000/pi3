import { create } from 'zustand';
import { api, User, outsiderSignup, outsiderLogin, getMe, setFreezeUpdates } from './api';

type AuthState = 'loading' | 'logged_out' | 'logged_in';

interface UserStore {
  authState: AuthState;
  user: User | null;
  error: string | null;

  initiateOAuthLogin: () => void;
  outsiderLogin: (name: string, password: string) => Promise<void>;
  outsiderSignup: (name: string, password: string, role: 'student' | 'teacher') => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  toggleFreezeUpdates: (freeze: boolean) => Promise<void>;
}

// Push the freeze flag to the service worker so it stops promoting new
// bundles until the teacher toggles it off. Best-effort — the flag lives
// server-side too, so we can recover on next login.
function notifyServiceWorker(freeze: boolean) {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  navigator.serviceWorker.ready
    .then((reg) => {
      const target = reg.active ?? reg.installing ?? reg.waiting;
      target?.postMessage({ type: 'set_freeze', on: freeze });
    })
    .catch(() => { /* ignore */ });
}

export const useUser = create<UserStore>((set) => ({
  authState: 'loading',
  user: null,
  error: null,

  initiateOAuthLogin: () => {
    window.location.href = '/api/auth/login';
  },

  outsiderLogin: async (name: string, password: string) => {
    set({ error: null });
    try {
      const user = await outsiderLogin(name, password);
      set({ authState: 'logged_in', user });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Login failed' });
      throw error;
    }
  },

  outsiderSignup: async (name: string, password: string, role: 'student' | 'teacher') => {
    set({ error: null });
    try {
      const user = await outsiderSignup(name, password, role);
      set({ authState: 'logged_in', user });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Signup failed' });
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post<{ ok: boolean }>('/api/auth/logout');
    } catch {
      // Swallow — logout must complete locally even if the server call fails.
    }
    set({ authState: 'logged_out', user: null });
    window.location.href = '/';
  },

  toggleFreezeUpdates: async (freeze: boolean) => {
    const res = await setFreezeUpdates(freeze);
    notifyServiceWorker(res.freeze_updates);
    set((prev) => ({ user: prev.user ? { ...prev.user, freeze_updates: res.freeze_updates } : prev.user }));
  },

  checkSession: async () => {
    try {
      const user = await getMe();
      notifyServiceWorker(!!user.freeze_updates);
      set({ authState: 'logged_in', user });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'Unauthorized') {
        set({ authState: 'logged_out', user: null, error: null });
      } else if (message.toLowerCase().includes('fetch') || message === 'Failed to fetch' || message === 'NetworkError') {
        set({ authState: 'logged_out', user: null, error: 'Could not reach server' });
      } else {
        set({ authState: 'logged_out', user: null, error: 'Server error during sign-in check' });
      }
    }
  },
}));
