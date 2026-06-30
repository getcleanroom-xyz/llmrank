"use client";

import { useEffect, ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useCurrentUser } from "@/lib/hooks";

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setUser, setLoading } = useAuth();
  const { data: user, isFetched } = useCurrentUser();

  useEffect(() => {
    if (isFetched) {
      setUser(user ?? null);
    }
  }, [user, isFetched, setUser, setLoading]);

  return <>{children}</>;
}
