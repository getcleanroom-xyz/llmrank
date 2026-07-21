"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTriggerScan } from "@/lib/hooks";
import type { Brand, Scan } from "@/types";
import type { CreditBalance } from "@/lib/api";

export const LLM_OPTIONS = [
  { id: "chatgpt", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "gpt4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "gemini", label: "Gemini 3 Flash", provider: "Google" },
  { id: "llama", label: "Llama 3.3 70B", provider: "Meta" },
  { id: "llama-small", label: "Llama 3.1 8B", provider: "Meta" },
  { id: "claude", label: "Claude Sonnet 4.5", provider: "Anthropic" },
  { id: "deepseek", label: "DeepSeek Chat", provider: "DeepSeek" },
  { id: "deepseek-r1", label: "DeepSeek R1", provider: "DeepSeek" },
  { id: "mistral", label: "Mistral Large", provider: "Mistral" },
  { id: "qwen", label: "Qwen 2.5 72B", provider: "Alibaba" },
];

export function ScanControls({ brandId, latestScan, credits, onScanError, lastScanLLMs, onScanStarted }: { brandId: string; latestScan: Scan | null; credits: CreditBalance | undefined; onScanError?: (msg: string | null) => void; lastScanLLMs?: string[]; onScanStarted?: () => void }) {
  const triggerScan = useTriggerScan();
  const router = useRouter();
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedLLMs, setSelectedLLMs] = useState(lastScanLLMs && lastScanLLMs.length > 0 ? lastScanLLMs : ["chatgpt", "llama"]);
  const [showConfig, setShowConfig] = useState(false);
  const configRef = useRef<HTMLDivElement>(null);

  // Sync selected LLMs when last scan changes
  const prevLLMsKey = useMemo(() => (lastScanLLMs ?? []).join(","), [lastScanLLMs]);
  useEffect(() => {
    if (lastScanLLMs && lastScanLLMs.length > 0) {
      setSelectedLLMs(lastScanLLMs);
    }
  }, [prevLLMsKey]);

  const isRunning = latestScan?.status === "pending" || latestScan?.status === "running";

  useEffect(() => {
    if (!showConfig) return;
    const close = (e: MouseEvent) => { if (configRef.current && !configRef.current.contains(e.target as Node)) setShowConfig(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setShowConfig(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [showConfig]);

  const handleScan = async () => {
    if (triggerScan.isPending || selectedLLMs.length === 0 || isRunning) return;
    setScanError(null);
    onScanError?.(null);
    setShowConfig(false);
    try {
      await triggerScan.mutateAsync({ brandId, llms: selectedLLMs });
      onScanStarted?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scan failed";
      if (msg.includes("402") || msg.includes("Insufficient credits")) {
        setScanError("Insufficient credits.");
        onScanError?.("Insufficient credits.");
      } else {
        setScanError(msg);
        onScanError?.(msg);
      }
    }
  };

  const estimatedCost = selectedLLMs.reduce((sum, id) => {
    const costPerQuery = credits?.cost_per_scan?.[id] ?? 0;
    return sum + costPerQuery;
  }, 0);

  return (
    <>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "3px 6px", lineHeight: "20px" }} onClick={() => router.refresh()}>
          Refresh
        </button>
        <div style={{ position: "relative" }} ref={configRef}>
          <button onClick={() => setShowConfig((s) => !s)} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: "3px 8px", lineHeight: "20px" }}>
            {selectedLLMs.length} model{selectedLLMs.length !== 1 ? "s" : ""}
          </button>
          {showConfig && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "var(--surface)", border: "2px solid var(--border)", borderRadius: "var(--radius)", padding: 10, minWidth: 220, zIndex: 100, boxShadow: "var(--shadow)" }}>
              <div className="section-label" style={{ marginBottom: 6 }}>Models</div>
              {LLM_OPTIONS.map((llm) => {
                const cost = credits?.cost_per_scan?.[llm.id] ?? 0;
                return (
                  <label key={llm.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
                    <input type="checkbox" checked={selectedLLMs.includes(llm.id)} onChange={() => setSelectedLLMs((p) => p.includes(llm.id) ? p.filter((l) => l !== llm.id) : [...p, llm.id])} style={{ accentColor: "var(--primary)", width: 14, height: 14 }} />
                    <span style={{ flex: 1 }}>{llm.label || llm.id}</span>
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
        <button onClick={handleScan} disabled={triggerScan.isPending || selectedLLMs.length === 0 || isRunning || credits === undefined || (credits?.balance ?? 0) <= 0} className={`btn btn-sm ${isRunning || triggerScan.isPending ? "btn-ghost" : "btn-primary"}`} style={{ fontSize: 11, padding: "3px 12px", lineHeight: "20px" }}>
          Scan
        </button>
      </div>
    </>
  );
}
