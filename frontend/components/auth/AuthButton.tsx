"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { authLogout } from "@/lib/api";
import type { CreditBalance } from "@/lib/api";

interface AuthButtonProps {
  credits?: CreditBalance | null;
  onBuyClick?: () => void;
}

export function AuthButton({ credits, onBuyClick }: AuthButtonProps) {
  const { user, setUser, openAuthModal } = useAuth();
  const router = useRouter();
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

          {credits && (
            <div style={{ padding: "6px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Credits</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{credits.balance}</span>
            </div>
          )}

          {onBuyClick && (
            <button
              onClick={() => { setShowMenu(false); onBuyClick(); }}
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
              Buy Credits
            </button>
          )}

          <button
            onClick={async () => {
              setShowMenu(false);
              try { await authLogout(); } catch {}
              setUser(null);
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
