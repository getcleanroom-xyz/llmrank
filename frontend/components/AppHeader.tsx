"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { getCredits, type CreditBalance } from "@/lib/api";
import { AuthButton } from "@/components/auth/AuthButton";
import { BuyCreditsModal } from "@/components/BuyCreditsModal";

export function AppHeader({ before, after }: { before?: React.ReactNode; after?: React.ReactNode }) {
  const { user } = useAuth();
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [showBuy, setShowBuy] = useState(false);

  useEffect(() => {
    if (user) {
      getCredits().then(setCredits).catch(() => {});
    } else {
      setCredits(null);
    }
  }, [user]);

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-content">
          <Link
            href={user ? "/brands" : "/"}
            style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", textDecoration: "none", flexShrink: 0, lineHeight: 1 }}
          >
            llm<span style={{ background: "var(--primary)", padding: "0 4px", border: "2px solid var(--border)" }}>rank</span>
          </Link>

          {before && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, marginLeft: 8 }}>
              {before}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }} />

          {after && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginRight: 8 }}>
              {after}
            </div>
          )}

          <AuthButton credits={credits} onBuyClick={() => setShowBuy(true)} />
        </div>
      </div>
      <BuyCreditsModal open={showBuy} onClose={() => setShowBuy(false)} />
    </header>
  );
}
