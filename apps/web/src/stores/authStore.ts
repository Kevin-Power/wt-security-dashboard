import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/services/api';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, token } = response.data;

          // Set token in API client
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const message = error.response?.data?.message || 'Login failed';
          set({ isLoading: false, error: message });
          throw new Error(message);
        }
      },

      logout: () => {
        // Remove token from API client
        delete api.defaults.headers.common['Authorization'];
        
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }

        set({ isLoading: true });
        try {
          // Set token in API client
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          
          const response = await api.get('/auth/me');
          const { user } = response.data;

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // Token invalid or expired
          delete api.defaults.headers.common['Authorization'];
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
);

// Initialize auth on app load
export const initializeAuth = () => {
  const { token, checkAuth } = useAuthStore.getState();
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    checkAuth();
  }
};
