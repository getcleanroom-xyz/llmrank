import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  is_admin?: boolean;
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
    document.cookie = "session=; path=/; max-age=0; SameSite=Lax";
    set({ user: null });
    // Note: Server-side logout is handled by the AuthButton component which calls authLogout()
    // before invoking this function. The cookie deletion here is a client-side fallback.
  },
  authModalOpen: false,
  authModalMode: "login",
  openAuthModal: (mode) => set({ authModalOpen: true, authModalMode: mode ?? "login" }),
  closeAuthModal: () => set({ authModalOpen: false }),
}));
