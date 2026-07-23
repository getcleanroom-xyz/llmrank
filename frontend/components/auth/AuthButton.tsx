"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { authLogout } from "@/lib/api";

interface AuthButtonProps {
  credits?: never;
  onBuyClick?: never;
}

export function AuthButton(_props?: AuthButtonProps) {
  const { user, setUser, openAuthModal } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showMenu]);

  if (!user) {
    return (
      <button onClick={() => openAuthModal("login")} className="btn btn-sm">
        <span>Sign in</span>
      </button>
    );
  }

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="btn btn-sm"
        style={{ gap: 6 }}
      >
        <div style={{ width: 20, height: 20, borderRadius: "var(--radius)", background: "var(--primary)", border: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
          {user.display_name.charAt(0).toUpperCase()}
        </div>
        <span>{user.display_name}</span>
      </button>

      {showMenu && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          right: 0,
          background: "var(--surface)",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: 8,
          minWidth: 180,
          zIndex: 50,
          boxShadow: "var(--shadow)"
        }}>
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{user.display_name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{user.email}</div>
          </div>

          <Link
            href="/account"
            style={{
              display: "block",
              width: "100%",
              padding: "6px 8px",
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: "var(--radius)",
              color: "var(--text)",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--background)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            onClick={() => setShowMenu(false)}
          >
            Account
          </Link>

          {user.is_admin && (
            <Link
              href="/admin"
              style={{
                display: "block",
                width: "100%",
                padding: "6px 8px",
                fontSize: 12,
                fontWeight: 600,
                textAlign: "left",
                background: "none",
                border: "none",
                cursor: "pointer",
                borderRadius: "var(--radius)",
                color: "var(--text)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--background)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
              onClick={() => setShowMenu(false)}
            >
              Admin
            </Link>
          )}

          <button
            onClick={async () => {
              setShowMenu(false);
              try { await authLogout(); } catch {}
              setUser(null);
              queryClient.clear();
              router.push("/");
            }}
            style={{
              width: "100%",
              padding: "6px 8px",
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              background: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: "var(--radius)",
              color: "var(--text)"
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "var(--background)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "none"}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
