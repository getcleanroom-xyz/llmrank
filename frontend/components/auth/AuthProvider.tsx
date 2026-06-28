"use client";

import { useEffect, ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { authGetMe } from "@/lib/api";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setUser, setLoading } = useAuth();

  useEffect(() => {
    authGetMe()
      .then((user) => setUser(user))
      .catch(() => setUser(null));
  }, [setUser, setLoading]);

  return <>{children}</>;
}
