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

  const showBuy = credits && credits.balance <= 50;

  return (
    <header style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "8px var(--page-px)", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Breadcrumb + brand info — min-width 0 so text can truncate */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 0, flex: "1 1 140px" }}>
            <Link href="/brands" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 700, flexShrink: 0 }}>brands</Link>
            <span style={{ color: "var(--text-muted)", flexShrink: 0, fontSize: 11 }}>/</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{brand.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {brand.domain}
                {latestScan?.completed_at && <span style={{ marginLeft: 4 }}>{new Date(latestScan.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
              </div>
            </div>
          </div>

          {/* Actions — shrink to fit */}
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
            {credits && (
              <div
                onClick={showBuy ? () => setShowBuyCredits(true) : undefined}
                role={showBuy ? "button" : undefined}
                tabIndex={showBuy ? 0 : undefined}
                onKeyDown={showBuy ? (e) => { if (e.key === "Enter") setShowBuyCredits(true); } : undefined}
                style={{
                  fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                  padding: "3px 8px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)",
                  background: showBuy ? "#FEE2E2" : "var(--surface)",
                  color: showBuy ? "#991B1B" : "var(--text)",
                  cursor: showBuy ? "pointer" : "default",
                }}
              >
                {credits.balance}cr
              </div>
            )}
            {isRunning && <span className="pill pill-gold" style={{ fontSize: 10 }}>...</span>}
            <button onClick={onRefresh} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "3px 8px" }}>Rfsh</button>
            <div style={{ position: "relative" }} ref={configRef}>
              <button onClick={() => setShowConfig((s) => !s)} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "3px 8px" }}>
                {selectedLLMs.length}m
              </button>
              {showConfig && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "var(--surface)", border: "2px solid var(--border)", borderRadius: "var(--radius)", padding: 10, minWidth: 220, zIndex: 50, boxShadow: "var(--shadow)" }}>
                  <div className="section-label" style={{ marginBottom: 6 }}>Models</div>
                  {LLM_OPTIONS.map((llm) => {
                    const cost = credits?.cost_per_scan?.[llm.id] ?? 0;
                    return (
                      <label key={llm.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
                        <input type="checkbox" checked={selectedLLMs.includes(llm.id)} onChange={() => setSelectedLLMs((p) => p.includes(llm.id) ? p.filter((l) => l !== llm.id) : [...p, llm.id])} style={{ accentColor: "var(--primary)", width: 14, height: 14 }} />
                        <span style={{ flex: 1 }}>{llm.id}</span>
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{cost}cr</span>
                      </label>
                    );
                  })}
                  {estimatedCost > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1.5px solid var(--border)", fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>
                      Est. {estimatedCost}cr/q
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={handleScan} disabled={scanning || selectedLLMs.length === 0 || isRunning || (credits?.balance ?? 0) <= 0} className={`btn btn-sm ${isRunning || scanning ? "btn-ghost" : "btn-primary"}`} style={{ fontSize: 11, padding: "3px 12px" }}>
              {isRunning ? "..." : scanning ? "..." : "Scan"}
            </button>
          </div>
        </div>
      </div>
      {scanError && <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 var(--page-px) 6px" }}><div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "5px 10px", fontSize: 11, color: "#991B1B", fontWeight: 600 }}>{scanError}</div></div>}
      {isRunning && <div className="scan-progress"><div className="scan-progress-fill" /></div>}
      <BuyCreditsModal open={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
    </header>
  );
}
