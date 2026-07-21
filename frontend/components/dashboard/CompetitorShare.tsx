"use client";

import { useParams, useRouter } from "next/navigation";
import type { CompetitorShareItem } from "@/types";
import { Bar } from "@/components/ui";

export function CompetitorShare({ items, brandName, brandScore }: { items: CompetitorShareItem[]; brandName: string; brandScore: number }) {
  const { brandId } = useParams<{ brandId: string }>();
  const router = useRouter();

  return (
    <div>
      <div style={{ background: "var(--primary)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", marginBottom: 8, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5, fontWeight: 700, fontSize: 13 }}>{brandName} <span>{brandScore}%</span></div>
        <div className="bar-track"><div className="bar-fill" style={{ width: `${brandScore}%`, background: "var(--black)" }} /></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
        {items.slice(0, 6).map((c) => (
          <div
            key={c.name}
            onClick={() => router.push(`/brands/${brandId}/competitors/${encodeURIComponent(encodeURIComponent(c.name))}`)}
            style={{ background: "var(--bg-dark)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 10px", cursor: "pointer", transition: "background 0.1s" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#FFF9DB"}
            onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-dark)"}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              {c.logo_url && (
                <img
                  src={c.logo_url}
                  alt=""
                  style={{ width: 18, height: 18, borderRadius: 4, objectFit: "contain", background: "#fff", border: "1px solid var(--border)", flexShrink: 0 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div style={{ fontSize: 12, fontWeight: 700 }}>{c.name}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Bar pct={c.mention_pct} color="var(--text-muted)" /><span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, minWidth: 30, textAlign: "right" }}>{c.mention_pct}%</span></div>
          </div>
        ))}
        {items.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 12, gridColumn: "1 / -1", fontWeight: 600 }}>No data yet.</div>}
      </div>
    </div>
  );
}
