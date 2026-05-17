import { create } from 'zustand';
import { api, User, outsiderSignup, outsiderLogin, getMe } from './api';

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
}

export const useUser = create<UserStore>((set) => {
  api.setOnUnauthorized(() => set({ authState: 'logged_out', user: null }));

  return {
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
        const result = await api.post<{ ok: boolean; logoutUrl?: string }>('/api/auth/logout');
        set({ authState: 'logged_out', user: null });
        if (result.logoutUrl) {
          window.location.href = result.logoutUrl;
        } else {
          window.location.href = '/';
        }
      } catch {
        set({ authState: 'logged_out', user: null });
        window.location.href = '/';
      }
    },

    checkSession: async () => {
      try {
        const user = await getMe();
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
  };
});
