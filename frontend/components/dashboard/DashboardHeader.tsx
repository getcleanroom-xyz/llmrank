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

export function DashboardHeader({ brand, latestScan, onScanTriggered, onRefresh }: { brand: Brand; latestScan: Scan | null; onScanTriggered: () => void; onRefresh: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedLLMs, setSelectedLLMs] = useState(["chatgpt", "llama"]);
  const [showConfig, setShowConfig] = useState(false);
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  const isRunning = latestScan?.status === "pending" || latestScan?.status === "running";

  // Load credits
  useEffect(() => {
    getCredits().then(setCredits).catch(() => {});
  }, []);

  // Refresh credits after scan
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

  // Calculate estimated cost
  const estimatedCost = selectedLLMs.reduce((sum, id) => {
    const costPerQuery = credits?.cost_per_scan?.[id] ?? 0;
    return sum + costPerQuery;
  }, 0);

  return (
    <header style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px var(--page-px)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Link href="/" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700 }}>brands</Link>
        <span style={{ color: "var(--text-muted)" }}>/</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brand.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
            {brand.domain}
            {latestScan?.completed_at && <span style={{ marginLeft: 6 }}>scanned {new Date(latestScan.completed_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {/* Credit balance */}
          {credits && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", background: credits.balance > 50 ? "var(--surface)" : "#FEE2E2", color: credits.balance > 50 ? "var(--text)" : "#991B1B" }}>
                {credits.balance} credits
              </div>
              {credits.balance <= 50 && (
                <button
                  onClick={() => setShowBuyCredits(true)}
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: 10, padding: "3px 8px" }}
                >
                  Get more
                </button>
              )}
            </div>
          )}
          {isRunning && <span className="pill pill-gold">Scanning...</span>}
          <button onClick={onRefresh} className="btn btn-ghost btn-sm">Refresh</button>
          <div style={{ position: "relative" }} ref={configRef}>
            <button onClick={() => setShowConfig((s) => !s)} className="btn btn-ghost btn-sm">{selectedLLMs.length} models</button>
            {showConfig && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "var(--surface)", border: "2px solid var(--border)", borderRadius: "var(--radius)", padding: 12, minWidth: 260, zIndex: 50, boxShadow: "var(--shadow)" }}>
                <div className="section-label" style={{ marginBottom: 8 }}>Select models</div>
                {LLM_OPTIONS.map((llm) => {
                  const cost = credits?.cost_per_scan?.[llm.id] ?? 0;
                  return (
                    <label key={llm.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
                      <input type="checkbox" checked={selectedLLMs.includes(llm.id)} onChange={() => setSelectedLLMs((p) => p.includes(llm.id) ? p.filter((l) => l !== llm.id) : [...p, llm.id])} style={{ accentColor: "var(--primary)", width: 14, height: 14 }} />
                      <span style={{ flex: 1 }}>{llm.label}</span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{cost}cr</span>
                    </label>
                  );
                })}
                {estimatedCost > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1.5px solid var(--border)", fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>
                    Est. cost: {estimatedCost} credits per query
                  </div>
                )}
              </div>
            )}
          </div>
          <button onClick={handleScan} disabled={scanning || selectedLLMs.length === 0 || isRunning || (credits?.balance ?? 0) <= 0} className={`btn btn-sm ${isRunning || scanning ? "btn-ghost" : "btn-primary"}`}>
            {isRunning ? "Running..." : scanning ? "Starting..." : "Scan"}
          </button>
        </div>
      </div>
      {scanError && <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 var(--page-px) 8px" }}><div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "6px 10px", fontSize: 12, color: "#991B1B", fontWeight: 600 }}>{scanError}</div></div>}
      {isRunning && <div className="scan-progress"><div className="scan-progress-fill" /></div>}
      <BuyCreditsModal open={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
    </header>
  );
}
