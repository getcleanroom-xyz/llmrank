import { create } from "zustand";

interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

type AuthMode = "login" | "register";

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  authModalOpen: boolean;
  authModalMode: AuthMode;
  openAuthModal: (mode?: AuthMode) => void;
  closeAuthModal: () => void;
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
  authModalOpen: false,
  authModalMode: "login",
  openAuthModal: (mode) => set({ authModalOpen: true, authModalMode: mode ?? "login" }),
  closeAuthModal: () => set({ authModalOpen: false }),
}));
