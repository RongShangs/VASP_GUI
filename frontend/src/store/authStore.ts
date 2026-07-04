import { create } from 'zustand';
import { authApi } from '../api/auth';

interface AuthState {
  token: string | null;
  username: string | null;
  isLoggedIn: boolean;
  loading: boolean;
  requirePassword: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  setUsername: (username: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('access_token'),
  username: null,
  isLoggedIn: false,
  loading: true,
  requirePassword: false,

  login: async (username, password) => {
    try {
      const res = await authApi.login(username, password);
      const token = res.data.access_token;
      localStorage.setItem('access_token', token);
      set({ token, username, isLoggedIn: true, loading: false });
      return true;
    } catch {
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ token: null, username: null, isLoggedIn: false, loading: false });
  },

  setUsername: (username) => set({ username }),

  checkAuth: async () => {
    try {
      // Check if password is required
      const pwCheck = await authApi.requirePassword();
      const requirePw = pwCheck.data.require_password;
      set({ requirePassword: requirePw });

      if (!requirePw) {
        // No password set - auto-login as admin with empty password
        // Try up to 2 times in case of transient errors
        let ok = await get().login('admin', '');
        if (!ok) {
          // Brief delay then retry once (DB might still be initializing)
          await new Promise(r => setTimeout(r, 500));
          ok = await get().login('admin', '');
        }
        if (ok) {
          set({ isLoggedIn: true, username: 'admin', loading: false });
          return;
        }
        // Last resort: register admin user then login
        try {
          await authApi.register('admin', '');
          const ok2 = await get().login('admin', '');
          if (ok2) {
            set({ isLoggedIn: true, username: 'admin', loading: false });
            return;
          }
        } catch { /* ignore */ }
        // Fallback: guest mode — still set a flag that we tried
        set({ isLoggedIn: true, username: 'admin', loading: false, token: null });
        return;
      }

      // Password required - check existing token
      const token = get().token || localStorage.getItem('access_token');
      if (!token) {
        set({ isLoggedIn: false, loading: false });
        return;
      }
      const res = await authApi.me();
      set({ username: res.data.username, isLoggedIn: true, loading: false });
    } catch {
      localStorage.removeItem('access_token');
      set({ token: null, username: null, isLoggedIn: false, loading: false });
    }
  },
}));
