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
    <header style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "6px var(--page-px)", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          <Link
            href={user ? "/brands" : "/"}
            style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", textDecoration: "none", flexShrink: 0, lineHeight: 1 }}
          >
            llm<span style={{ background: "var(--primary)", padding: "0 4px", border: "2px solid var(--border)" }}>rank</span>
          </Link>

          {before && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              {before}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }} />

          {after && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              {after}
            </div>
          )}

          {user && credits && (
            <div
              onClick={credits.balance <= 50 ? () => setShowBuy(true) : undefined}
              role={credits.balance <= 50 ? "button" : undefined}
              tabIndex={credits.balance <= 50 ? 0 : undefined}
              onKeyDown={credits.balance <= 50 ? (e) => { if (e.key === "Enter") setShowBuy(true); } : undefined}
              style={{
                fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                padding: "2px 7px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)",
                background: credits.balance <= 50 ? "#FEE2E2" : "var(--surface)",
                color: credits.balance <= 50 ? "#991B1B" : "var(--text)",
                cursor: credits.balance <= 50 ? "pointer" : "default",
                flexShrink: 0, lineHeight: "20px",
              }}
            >
              {credits.balance}cr
            </div>
          )}
          {user && (
            <button
              onClick={() => setShowBuy(true)}
              className="btn btn-sm"
              style={{ fontSize: 10, padding: "2px 7px", flexShrink: 0, lineHeight: "20px" }}
            >
              Buy
            </button>
          )}
          <AuthButton />
        </div>
      </div>
      <BuyCreditsModal open={showBuy} onClose={() => setShowBuy(false)} />
    </header>
  );
}
