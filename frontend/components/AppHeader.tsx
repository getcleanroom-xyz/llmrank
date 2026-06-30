"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useCredits } from "@/lib/hooks";
import { AuthButton } from "@/components/auth/AuthButton";
import { BuyCreditsModal } from "@/components/BuyCreditsModal";

function HeaderDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="header-drawer-overlay" onClick={onClose}>
      <div className="header-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="header-drawer-header">
          <Link href="/" style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", textDecoration: "none", lineHeight: 1 }}>
            llm<span style={{ background: "var(--primary)", padding: "0 4px", border: "2px solid var(--border)" }}>rank</span>
          </Link>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ fontSize: 14, lineHeight: 1 }}>✕</button>
        </div>
        <div className="header-drawer-body">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AppHeader({ breadcrumb }: { breadcrumb?: React.ReactNode }) {
  const { user } = useAuth();
  const { data: credits } = useCredits();
  const [showBuy, setShowBuy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-content">
          {breadcrumb && (
            <button
              className="header-hamburger"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}

          <Link
            href={user ? "/brands" : "/"}
            style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", textDecoration: "none", flexShrink: 0, lineHeight: 1 }}
          >
            llm<span style={{ background: "var(--primary)", padding: "0 4px", border: "2px solid var(--border)" }}>rank</span>
          </Link>

          {breadcrumb && (
            <div className="app-header-breadcrumb">
              {breadcrumb}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }} />

          <div className="app-header-actions">
            <AuthButton credits={credits} onBuyClick={() => setShowBuy(true)} />
          </div>
        </div>
      </div>

      <HeaderDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>Navigation</div>
        {breadcrumb}
      </HeaderDrawer>

      <BuyCreditsModal open={showBuy} onClose={() => setShowBuy(false)} />
    </header>
  );
}

export function PageHeader({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="page-header">
      <div className="page-header-inner">
        {children}
      </div>
    </div>
  );
}
