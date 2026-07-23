export function DashboardSkeleton() {
  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      {/* Scan status bar skeleton */}
      <div style={{ width: "100%", padding: "0 var(--page-px)", background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 8, padding: "var(--gap) 0" }}>
          <div style={{ flex: 1 }} />
          <div className="skeleton" style={{ width: 80, height: 12 }} />
        </div>
      </div>

      <div style={{ flex: 1, padding: "0 var(--page-px)", width: "100%" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) 0", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
          {/* KPI cards skeleton */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card" style={{ padding: 14 }}>
                <div className="skeleton" style={{ width: "40%", height: 10, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: "60%", height: 22, marginBottom: 4 }} />
                <div className="skeleton" style={{ width: "30%", height: 10 }} />
              </div>
            ))}
          </div>

          {/* LLM breakdown skeleton */}
          <div className="card" style={{ padding: 16 }}>
            <div className="skeleton" style={{ width: 120, height: 10, marginBottom: 12 }} />
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div className="skeleton" style={{ width: 100, height: 14 }} />
                <div className="skeleton" style={{ flex: 1, height: 10 }} />
                <div className="skeleton" style={{ width: 40, height: 14 }} />
              </div>
            ))}
          </div>

          {/* Competitor share skeleton */}
          <div className="card" style={{ padding: 16 }}>
            <div className="skeleton" style={{ width: 100, height: 10, marginBottom: 12 }} />
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ flex: 1 }}>
                  <div className="skeleton" style={{ width: "70%", height: 12, marginBottom: 4 }} />
                  <div className="skeleton" style={{ width: "50%", height: 8 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="card" style={{ padding: 14 }}>
          <div className="skeleton" style={{ width: "40%", height: 10, marginBottom: 8 }} />
          <div className="skeleton" style={{ width: "60%", height: 22, marginBottom: 4 }} />
          <div className="skeleton" style={{ width: "30%", height: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="skeleton" style={{ width: 80, height: 10, marginBottom: 12 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div className="skeleton" style={{ flex: 1, height: 14 }} />
          <div className="skeleton" style={{ width: 50, height: 14 }} />
        </div>
      ))}
    </div>
  );
}
