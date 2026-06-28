"use client";

import { useEffect, useState } from "react";
import type { Scan } from "@/types";
import { getScans } from "@/lib/api";

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ScanHistory({ brandId }: { brandId: string }) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getScans(brandId)
      .then(setScans)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [brandId]);

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center", fontWeight: 600 }}>Loading scans...</div>;
  if (!scans.length) return <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "16px 0", textAlign: "center", fontWeight: 600 }}>No scans yet.</div>;

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {scans.map((scan) => (
          <div key={scan.id} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className={`pill ${scan.status === "completed" ? "pill-pos" : scan.status === "failed" ? "pill-neg" : scan.status === "running" ? "pill-gold" : "pill-neu"}`}>
                  {scan.status}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                  {timeAgo(scan.started_at)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                {scan.completed_at
                  ? `Completed ${new Date(scan.completed_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                  : scan.status === "running"
                  ? "In progress..."
                  : `Started ${new Date(scan.started_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
              </div>
            </div>
            {scan.status === "completed" && (
              <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: scan.visibility_score != null && scan.visibility_score >= 70 ? "#166534" : scan.visibility_score != null && scan.visibility_score >= 40 ? "var(--text)" : "#991B1B" }}>
                    {scan.visibility_score ?? "-"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>visibility</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>
                    {scan.mention_rate != null ? `${scan.mention_rate}%` : "-"}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>mentions</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
