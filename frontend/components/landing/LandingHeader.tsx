"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export function LandingCTA({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const { user } = useAuth();

  if (variant === "secondary") {
    return (
      <Link
        href={user ? "/brands" : "#"}
        onClick={(e) => {
          if (!user) {
            e.preventDefault();
            document.querySelector<HTMLButtonElement>("[data-auth-trigger]")?.click();
          }
        }}
        className="btn btn-ghost"
      >
        See how it works
      </Link>
    );
  }

  return (
    <Link
      href={user ? "/brands" : "#"}
      onClick={(e) => {
        if (!user) {
          e.preventDefault();
          document.querySelector<HTMLButtonElement>("[data-auth-trigger]")?.click();
        }
      }}
      className="btn btn-primary"
    >
      Start tracking for free
    </Link>
  );
}

export function LandingHeader() {
  const { user } = useAuth();

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-content">
          <Link
            href="/"
            style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", textDecoration: "none", flexShrink: 0, lineHeight: 1 }}
          >
            llm<span style={{ background: "var(--primary)", padding: "0 4px", border: "2px solid var(--border)" }}>rank</span>
          </Link>

          <div style={{ flex: 1, minWidth: 0 }} />

          <div className="app-header-actions">
            {user && (
              <Link href="/brands" className="btn btn-ghost btn-sm">
                Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
