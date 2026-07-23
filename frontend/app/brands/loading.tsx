export default function Loading() {
  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      {/* Decorative squiggles */}
      <svg width="120" height="40" viewBox="0 0 120 40" fill="none" style={{ position: "absolute", top: 40, right: 60, opacity: 0.15, pointerEvents: "none" }}>
        <path d="M0 20 Q15 5 30 25 Q45 40 60 15 Q75 0 90 20 Q105 35 120 10" stroke="#3B82F6" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
      <svg width="80" height="30" viewBox="0 0 80 30" fill="none" style={{ position: "absolute", top: 120, left: 40, opacity: 0.12, pointerEvents: "none" }}>
        <path d="M0 15 Q10 5 20 18 Q30 28 40 12 Q50 2 60 16 Q70 26 80 10" stroke="#22C55E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>

      <div style={{ flex: 1, maxWidth: 700, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {/* Centered logo skeleton */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div className="skeleton" style={{ width: 180, height: 36, margin: "0 auto 10px" }} />
          <div className="skeleton" style={{ width: 200, height: 12, margin: "0 auto" }} />
        </div>

        {/* Search bar skeleton */}
        <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <div className="skeleton" style={{ flex: 1, height: 36 }} />
          <div className="skeleton" style={{ width: 60, height: 36 }} />
          <div className="skeleton" style={{ width: 50, height: 36 }} />
        </div>

        {/* Brand cards skeleton */}
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          <div className="skeleton" style={{ width: 80, height: 10 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              position: "relative",
              background: "var(--bg-dark)",
              border: "2px solid var(--border)",
              padding: "16px 16px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              transform: `rotate(${i % 2 === 0 ? "-0.5deg" : "0.4deg"})`,
            }}>
              <div className="skeleton" style={{ width: 40, height: 40, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: "60%", height: 16, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: "40%", height: 10 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
