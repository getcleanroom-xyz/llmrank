export default function Loading() {
  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div className="skeleton" style={{ width: 80, height: 16 }} />
        <div className="skeleton" style={{ width: 200, height: 12 }} />
      </div>
    </div>
  );
}
