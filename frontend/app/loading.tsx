export default function Loading() {
  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div className="skeleton" style={{ width: 120, height: 20 }} />
        <div className="skeleton" style={{ width: 200, height: 14 }} />
      </div>
    </div>
  );
}
