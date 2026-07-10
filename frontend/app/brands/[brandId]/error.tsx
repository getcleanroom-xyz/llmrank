"use client";

import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "var(--page-px)", background: "var(--bg)" }}>
      <div style={{ position: "relative", maxWidth: 440, width: "100%" }}>
        {/* Doodle background decoration */}
        <svg width="100%" height="100%" viewBox="0 0 440 300" fill="none" style={{ position: "absolute", top: -20, left: -20, pointerEvents: "none", opacity: 0.15 }}>
          <path d="M20 80 Q60 30 100 80 Q140 130 180 80" stroke="var(--primary)" strokeWidth="2" fill="none" />
          <path d="M280 40 Q320 90 360 40 Q400 -10 440 40" stroke="#3B82F6" strokeWidth="2" fill="none" />
          <circle cx="50" cy="260" r="8" stroke="#22C55E" strokeWidth="2" fill="none" />
          <circle cx="400" cy="240" r="6" stroke="#A855F7" strokeWidth="2" fill="none" />
          <path d="M350 100 Q370 80 390 100 Q410 120 430 100" stroke="#F97316" strokeWidth="1.5" fill="none" />
        </svg>

        <div className="card" style={{ padding: "32px 28px", textAlign: "center", position: "relative", zIndex: 1 }}>
          {/* Pushpin */}
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", zIndex: 2 }}>
            <ellipse cx="11" cy="5" rx="5.5" ry="5.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
            <rect x="9" y="10" width="4" height="10" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
          </svg>

          <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 48, fontWeight: 700, color: "#EF4444", lineHeight: 1, marginTop: 8 }}>
            Oops
          </div>
          <svg width="60%" height="6" viewBox="0 0 120 6" preserveAspectRatio="none" style={{ display: "block", margin: "8px auto 16px" }}>
            <path d="M0 3 Q8 0 16 4 Q24 6 32 2 Q40 0 48 5 Q56 6 64 2 Q72 0 80 4 Q88 6 96 2 Q104 0 112 4 Q120 3 120 2" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
          </svg>

          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>
            Something went wrong loading this page.
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, fontFamily: "var(--font-mono)" }}>
            {error.message?.length > 80 ? error.message.slice(0, 80) + "..." : error.message}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={reset} className="btn btn-primary">
              Try again
            </button>
            <Link href="/brands" className="btn btn-ghost" style={{ textDecoration: "none" }}>
              Back to brands
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
