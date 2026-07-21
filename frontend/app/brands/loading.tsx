export default function Loading() {
  return (
    <div className="page" style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "var(--gap)" }}>
        <div className="skeleton" style={{ width: 120, height: 28 }} />
        <div style={{ flex: 1 }} />
        <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 16 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="card" style={{ padding: 16 }}>
            <div className="skeleton" style={{ width: "50%", height: 16, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: "30%", height: 12, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: "100%", height: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
