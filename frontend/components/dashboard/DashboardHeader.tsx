"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { Brand, Scan } from "@/types";
import { triggerScan, getCredits, type CreditBalance } from "@/lib/api";
import { BuyCreditsModal } from "@/components/BuyCreditsModal";

const LLM_OPTIONS = [
  { id: "llama", label: "Llama 3.3 70B", provider: "Meta" },
  { id: "chatgpt", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "deepseek", label: "DeepSeek Chat", provider: "DeepSeek" },
  { id: "gemini", label: "Gemini 2.5 Flash", provider: "Google" },
  { id: "claude", label: "Claude Haiku", provider: "Anthropic" },
  { id: "mistral", label: "Mistral Large", provider: "Mistral" },
  { id: "qwen", label: "Qwen 2.5 72B", provider: "Alibaba" },
];

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export function DashboardHeader({ brand, latestScan, onScanTriggered, onRefresh }: { brand: Brand; latestScan: Scan | null; onScanTriggered: () => void; onRefresh: () => void }) {
  const isCompact = useMediaQuery("(max-width: 639px)");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedLLMs, setSelectedLLMs] = useState(["chatgpt", "llama"]);
  const [showConfig, setShowConfig] = useState(false);
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  const isRunning = latestScan?.status === "pending" || latestScan?.status === "running";

  useEffect(() => {
    getCredits().then(setCredits).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isRunning && latestScan?.status === "completed") {
      getCredits().then(setCredits).catch(() => {});
    }
  }, [isRunning, latestScan]);

  useEffect(() => {
    if (!showConfig) return;
    const close = (e: MouseEvent) => { if (configRef.current && !configRef.current.contains(e.target as Node)) setShowConfig(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setShowConfig(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [showConfig]);

  const handleScan = async () => {
    if (scanning || selectedLLMs.length === 0 || isRunning) return;
    setScanning(true);
    setScanError(null);
    setShowConfig(false);
    try {
      await triggerScan(brand.id, selectedLLMs);
      onScanTriggered();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scan failed";
      if (msg.includes("402") || msg.includes("Insufficient credits")) {
        setScanError("Insufficient credits. Contact support to purchase more.");
      } else {
        setScanError(msg);
      }
    } finally {
      setScanning(false);
    }
  };

  const estimatedCost = selectedLLMs.reduce((sum, id) => {
    const costPerQuery = credits?.cost_per_scan?.[id] ?? 0;
    return sum + costPerQuery;
  }, 0);

  const creditsEl = credits && (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div
        onClick={credits.balance <= 50 ? () => setShowBuyCredits(true) : undefined}
        role={credits.balance <= 50 ? "button" : undefined}
        tabIndex={credits.balance <= 50 ? 0 : undefined}
        onKeyDown={credits.balance <= 50 ? (e) => { if (e.key === "Enter") setShowBuyCredits(true); } : undefined}
        style={{
          fontSize: isCompact ? 11 : 12, fontWeight: 700,
          padding: isCompact ? "2px 6px" : "4px 10px",
          border: "1.5px solid var(--border)", borderRadius: "var(--radius)",
          background: credits.balance > 50 ? "var(--surface)" : "#FEE2E2",
          color: credits.balance > 50 ? "var(--text)" : "#991B1B",
          cursor: credits.balance <= 50 ? "pointer" : "default",
        }}
      >
        {credits.balance}cr
      </div>
    </div>
  );

  const modelBtn = (
    <div style={{ position: "relative" }} ref={configRef}>
      <button onClick={() => setShowConfig((s) => !s)} className="btn btn-ghost btn-sm" style={{ fontSize: isCompact ? 10 : 12 }}>
        {isCompact ? `${selectedLLMs.length}m` : `${selectedLLMs.length} models`}
      </button>
      {showConfig && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)",
          right: 0, left: isCompact ? 0 : "auto",
          background: "var(--surface)", border: "2px solid var(--border)",
          borderRadius: "var(--radius)", padding: 12,
          minWidth: isCompact ? "auto" : 260,
          zIndex: 50, boxShadow: "var(--shadow)",
        }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Select models</div>
          {LLM_OPTIONS.map((llm) => {
            const cost = credits?.cost_per_scan?.[llm.id] ?? 0;
            return (
              <label key={llm.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontSize: isCompact ? 12 : 13, fontWeight: 500 }}>
                <input type="checkbox" checked={selectedLLMs.includes(llm.id)} onChange={() => setSelectedLLMs((p) => p.includes(llm.id) ? p.filter((l) => l !== llm.id) : [...p, llm.id])} style={{ accentColor: "var(--primary)", width: 14, height: 14 }} />
                <span style={{ flex: 1 }}>{isCompact ? llm.id : llm.label}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{cost}cr</span>
              </label>
            );
          })}
          {estimatedCost > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1.5px solid var(--border)", fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
              Est. {estimatedCost}cr/q
            </div>
          )}
        </div>
      )}
    </div>
  );

  const scanBtn = (
    <button
      onClick={handleScan}
      disabled={scanning || selectedLLMs.length === 0 || isRunning || (credits?.balance ?? 0) <= 0}
      className={`btn btn-sm ${isRunning || scanning ? "btn-ghost" : "btn-primary"}`}
      style={{ fontSize: isCompact ? 11 : 12, padding: isCompact ? "6px 14px" : undefined }}
    >
      {isRunning ? "Running..." : scanning ? "Starting..." : isCompact ? "Go" : "Scan"}
    </button>
  );

  const brandInfo = (
    <div style={{ minWidth: 0, flex: isCompact ? undefined : 1, maxWidth: isCompact ? "100%" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {!isCompact && (
          <>
            <Link href="/brands" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700, flexShrink: 0 }}>brands</Link>
            <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>/</span>
          </>
        )}
        <div style={{ fontSize: isCompact ? 13 : 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brand.name}</div>
      </div>
      <div style={{ fontSize: isCompact ? 10 : 11, color: "var(--text-muted)", fontWeight: 500 }}>
        {brand.domain}
        {latestScan?.completed_at && (
          <span style={{ marginLeft: isCompact ? 4 : 6 }}>
            {isCompact ? new Date(latestScan.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : `scanned ${new Date(latestScan.completed_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
          </span>
        )}
      </div>
    </div>
  );

  const actions = (
    <div style={{ display: "flex", gap: isCompact ? 4 : 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
      {creditsEl}
      {isRunning && <span className="pill pill-gold" style={{ fontSize: 10 }}>...</span>}
      {!isCompact && <button onClick={onRefresh} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>Refresh</button>}
      {modelBtn}
      {scanBtn}
    </div>
  );

  return (
    <header style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isCompact ? "8px var(--page-px)" : "10px var(--page-px)", width: "100%" }}>
        {isCompact ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>
              <Link href="/brands" style={{ color: "var(--text-muted)", textDecoration: "none" }}>brands</Link>
              <span style={{ margin: "0 4px" }}>/</span>
              {brand.name}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              {brandInfo}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {brand.domain}
                {latestScan?.completed_at && <span style={{ marginLeft: 4 }}>{new Date(latestScan.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {creditsEl}
                {modelBtn}
                {scanBtn}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {brandInfo}
            {actions}
          </div>
        )}
      </div>
      {scanError && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 var(--page-px) 8px" }}>
          <div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "6px 10px", fontSize: 12, color: "#991B1B", fontWeight: 600 }}>{scanError}</div>
        </div>
      )}
      {isRunning && <div className="scan-progress"><div className="scan-progress-fill" /></div>}
      <BuyCreditsModal open={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
    </header>
  );
}
