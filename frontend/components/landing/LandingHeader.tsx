"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function LandingCTA({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  const { user, openAuthModal } = useAuth();
  const router = useRouter();

  if (variant === "secondary") {
    return (
      <Link
        href="/#how-it-works"
        className="btn btn-ghost"
      >
        See how it works
      </Link>
    );
  }

  return (
    <button
      onClick={() => (user ? router.push("/brands") : openAuthModal("register"))}
      className="btn btn-primary"
    >
      {user ? "Go to Dashboard" : "Start tracking for free"}
    </button>
  );
}

export function LandingHeader() {
  const { user, openAuthModal } = useAuth();

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
            <Link
              href="/blog"
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                textDecoration: "none",
                fontWeight: 700,
                padding: "4px 8px",
              }}
            >
              Blog
            </Link>
            {user ? (
              <Link href="/brands" className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>
                Dashboard
              </Link>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => openAuthModal("login")}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
