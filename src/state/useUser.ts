import { create } from 'zustand';
import { api, User, createUser, getMe } from './api';

type AuthState = 'loading' | 'logged_out' | 'logged_in';

interface UserStore {
  authState: AuthState;
  user: User | null;
  token: string | null;
  error: string | null;

  login: (name: string) => Promise<void>;
  logout: () => void;
  checkSession: () => Promise<void>;
}

export const useUser = create<UserStore>((set) => ({
  authState: 'loading',
  user: null,
  token: null,
  error: null,

  login: async (name: string) => {
    set({ error: null });
    try {
      const { user, api_token } = await createUser(name);
      localStorage.setItem('pi3_token', api_token);
      api.setToken(api_token);
      set({ authState: 'logged_in', user, token: api_token });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Login failed' });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('pi3_token');
    api.setToken(null);
    set({ authState: 'logged_out', user: null, token: null });
  },

  checkSession: async () => {
    const token = localStorage.getItem('pi3_token');
    if (!token) {
      set({ authState: 'logged_out' });
      return;
    }

    api.setToken(token);
    set({ authState: 'loading', token });

    try {
      const user = await getMe();
      set({ authState: 'logged_in', user, token });
    } catch {
      localStorage.removeItem('pi3_token');
      api.setToken(null);
      set({ authState: 'logged_out', token: null });
    }
  },
}));
