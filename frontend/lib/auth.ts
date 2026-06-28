import { create } from "zustand";

interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  logout: () => {
    document.cookie = "session=; path=/; max-age=0";
    set({ user: null });
  },
}));
