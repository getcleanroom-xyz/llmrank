"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "var(--page-px)" }}>
      <div className="card" style={{ maxWidth: 400, textAlign: "center", padding: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Failed to load brands</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>{error.message}</div>
        <button onClick={reset} className="btn btn-primary">Try again</button>
      </div>
    </div>
  );
}
