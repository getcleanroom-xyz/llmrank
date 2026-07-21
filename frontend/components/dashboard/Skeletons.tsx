export function DashboardSkeleton() {
  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      {/* Header skeleton */}
      <div style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)", padding: "10px 16px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div className="skeleton" style={{ width: 80, height: 20 }} />
          <div className="skeleton" style={{ width: 40, height: 14 }} />
          <div style={{ flex: 1 }} />
          <div className="skeleton" style={{ width: 60, height: 28 }} />
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
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

        {/* Chart skeleton */}
        <div className="card" style={{ padding: 16 }}>
          <div className="skeleton" style={{ width: 100, height: 10, marginBottom: 12 }} />
          <div className="skeleton" style={{ width: "100%", height: 120 }} />
        </div>

        {/* Table skeleton */}
        <div className="card" style={{ padding: 16 }}>
          <div className="skeleton" style={{ width: 80, height: 10, marginBottom: 12 }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div className="skeleton" style={{ flex: 1, height: 14 }} />
              <div className="skeleton" style={{ width: 50, height: 14 }} />
            </div>
          ))}
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

export function ChartSkeleton() {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="skeleton" style={{ width: 100, height: 10, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: "100%", height: 120 }} />
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
