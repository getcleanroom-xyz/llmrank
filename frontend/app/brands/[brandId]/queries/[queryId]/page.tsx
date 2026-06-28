"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getQueryDrilldown, triggerScan } from "@/lib/api";
import type { QueryDrilldown } from "@/types";
import { AppHeader } from "@/components/AppHeader";
import { InsightRow } from "@/components/ui";
import { LLMResponseCard } from "@/components/drilldown/LLMResponseCard";

export default function QueryDrilldownPage() {
  const { brandId, queryId } = useParams<{ brandId: string; queryId: string }>();
  const [data, setData] = useState<QueryDrilldown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const c = new AbortController();
    abortRef.current = c;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    getQueryDrilldown(brandId, queryId)
      .then((d) => { if (!c.signal.aborted) setData(d); })
      .catch((e) => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [brandId, queryId]);

  const handleRescan = async () => {
    setRescanning(true);
    try {
      await triggerScan(brandId, ["gemini", "llama", "chatgpt"]);
      setTimeout(() => { getQueryDrilldown(brandId, queryId).then(setData).catch(() => {}); }, 2000);
    } catch (e) { setError(e instanceof Error ? e.message : "Scan failed"); }
    finally { setRescanning(false); }
  };

  if (loading) return <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-muted)" }}>Loading...</div>;
  if (!data) return <div className="page" style={{ padding: "var(--page-px)" }}><div style={{ color: "var(--red)", fontWeight: 700, marginBottom: 8 }}>{error ?? "No data yet."}</div><Link href={`/brands/${brandId}`} style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>Back</Link></div>;

  const sentimentColor = data.overall_sentiment === "positive" ? "#166534" : data.overall_sentiment === "negative" || data.overall_sentiment === "mixed" ? "#92400E" : "var(--text-secondary)";
  const coveragePct = data.total_llms > 0 ? Math.round((data.llms_mentioned / data.total_llms) * 100) : 0;
  const mentioned = data.results.filter((r) => r.mentioned);
  const notMentioned = data.results.filter((r) => !r.mentioned);

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <AppHeader
        before={
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <Link href="/brands" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700, flexShrink: 0 }}>brands</Link>
            <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: 11 }}>/</span>
            <Link href={`/brands/${brandId}`} style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700, flexShrink: 0 }}>dashboard</Link>
            <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: 11 }}>/</span>
            <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.query_text}</span>
          </div>
        }
        after={
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>{new Date(data.scanned_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            <button onClick={handleRescan} disabled={rescanning} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "3px 8px" }}>{rescanning ? "..." : "Re-scan"}</button>
          </div>
        }
      />

      <div style={{ flex: 1, maxWidth: 1100, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <div className="card" style={{ padding: "12px 14px" }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Position</div>
            <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1 }}>{data.avg_position ? `#${data.avg_position}` : "-"}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontWeight: 600 }}>{data.avg_position && data.avg_position <= 2 ? "Strong" : data.avg_position ? "Room to improve" : "Not ranked"}</div>
          </div>
          <div className="card" style={{ padding: "12px 14px" }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Coverage</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: coveragePct >= 60 ? "#166534" : coveragePct >= 30 ? "var(--text)" : "#991B1B", lineHeight: 1 }}>{coveragePct}%</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontWeight: 600 }}>{data.llms_mentioned}/{data.total_llms} models</div>
          </div>
          <div className="card" style={{ padding: "12px 14px" }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Rival</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: data.top_competitor ? "#991B1B" : "var(--text-muted)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.top_competitor ?? "-"}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontWeight: 600 }}>{data.top_competitor ? "Most-cited" : "None"}</div>
          </div>
          <div className="card" style={{ padding: "12px 14px" }}>
            <div className="section-label" style={{ marginBottom: 4 }}>Sentiment</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: sentimentColor, lineHeight: 1, textTransform: "capitalize" }}>{data.overall_sentiment}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4, fontWeight: 600 }}>{data.overall_sentiment === "positive" ? "Favorable" : data.overall_sentiment === "negative" ? "Unfavorable" : "Mixed"}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span className="section-label">Responses</span>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
            <span className="span-brand" style={{ fontSize: 10, padding: "1px 5px" }}>Brand</span>
            <span className="span-competitor" style={{ fontSize: 10, padding: "1px 5px" }}>Competitor</span>
            <span className="span-qualifier" style={{ fontSize: 10, padding: "1px 5px" }}>Caveat</span>
          </div>
        </div>

        {mentioned.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 8 }}>Mentioned ({mentioned.length})</div>
            <div className="grid-2" style={{ marginBottom: 16 }}>{mentioned.map((r) => <LLMResponseCard key={r.id} result={r} />)}</div>
          </>
        )}
        {notMentioned.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>Not mentioned ({notMentioned.length})</div>
            <div className="grid-2" style={{ marginBottom: 16 }}>{notMentioned.map((r) => <LLMResponseCard key={r.id} result={r} />)}</div>
          </>
        )}

        {data.insights.length > 0 && (
          <div className="card" style={{ borderColor: "var(--primary)" }}>
            <div className="section-label" style={{ marginBottom: 10 }}>How to improve</div>
            {data.insights.map((ins, i) => <div key={i} style={i === data.insights.length - 1 ? { borderBottom: "none" } : {}}><InsightRow type={ins.type as "tip" | "warning"} text={ins.text} /></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
