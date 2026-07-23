"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { queryKeys } from "@/lib/query-keys";
import { Plus, Settings } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const LLM_OPTIONS = [
  { id: "chatgpt", label: "GPT-4o Mini", provider: "OpenAI", credits: 1 },
  { id: "gpt4o", label: "GPT-4o", provider: "OpenAI", credits: 2 },
  { id: "gemini", label: "Gemini 3 Flash", provider: "Google", credits: 1 },
  { id: "llama", label: "Llama 3.3 70B", provider: "Meta", credits: 1 },
  { id: "llama-small", label: "Llama 3.1 8B", provider: "Meta", credits: 1 },
  { id: "claude", label: "Claude Sonnet 4.5", provider: "Anthropic", credits: 3 },
  { id: "deepseek", label: "DeepSeek Chat", provider: "DeepSeek", credits: 1 },
  { id: "deepseek-r1", label: "DeepSeek R1", provider: "DeepSeek", credits: 1 },
  { id: "mistral", label: "Mistral Large", provider: "Mistral", credits: 2 },
  { id: "qwen", label: "Qwen 2.5 72B", provider: "Alibaba", credits: 1 },
];

const DEFAULTSelected = ["chatgpt", "llama"];

interface ScanProgressEvent {
  status: string;
  step: string;
  message: string;
  progress: number;
  visibility_score: number | null;
  mention_rate: number | null;
  error?: string;
}

async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (data: ScanProgressEvent) => void,
  signal: AbortSignal,
) {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal.aborted) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          onEvent(JSON.parse(jsonStr));
        } catch {
          // ignore parse errors
        }
      }
    }
  }
}

export function NewScanButton({
  brandId,
  lastScanLLMs,
  onScanStarted,
  collapsed = false,
}: {
  brandId: string;
  lastScanLLMs?: string[];
  onScanStarted?: () => void;
  collapsed?: boolean;
}) {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedLLMs, setSelectedLLMs] = useState<string[]>(
    lastScanLLMs && lastScanLLMs.length > 0 ? lastScanLLMs : DEFAULTSelected
  );
  const abortRef = useRef<AbortController | null>(null);
  const configRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { addToast, updateToast, removeToast } = useToast();

  // Sync selected LLMs when lastScanLLMs changes
  useEffect(() => {
    if (lastScanLLMs && lastScanLLMs.length > 0) {
      setSelectedLLMs(lastScanLLMs);
    }
  }, [lastScanLLMs]);

  // Close config on outside click
  useEffect(() => {
    if (!showConfig) return;
    const close = (e: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(e.target as Node)) setShowConfig(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showConfig]);

  const toggleLLM = (id: string) => {
    setSelectedLLMs((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  const totalCredits = selectedLLMs.reduce((sum, id) => {
    const opt = LLM_OPTIONS.find((o) => o.id === id);
    return sum + (opt?.credits ?? 1);
  }, 0);

  const handleScan = useCallback(async () => {
    if (scanning || selectedLLMs.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setScanning(true);
    setProgress(5);

    const toastId = addToast("Starting scan...", "progress", { progress: 5 });

    try {
      const res = await fetch(`${BASE_URL}/brands/${brandId}/scans`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llms: selectedLLMs }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "Scan failed to start" }));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }

      const scan = await res.json();
      const scanId = scan.id;

      onScanStarted?.();
      updateToast(toastId, { message: "Scanning...", progress: 10 });

      const sseRes = await fetch(`${BASE_URL}/brands/${brandId}/scans/${scanId}/stream`, {
        credentials: "include",
        signal: controller.signal,
      });

      if (!sseRes.ok) {
        throw new Error(`SSE connection failed: ${sseRes.status}`);
      }

      const reader = sseRes.body!.getReader();
      let completed = false;

      await readSSEStream(reader, (data) => {
        if (completed) return;

        if (data.error) {
          completed = true;
          controller.abort();
          setScanning(false);
          setProgress(0);
          updateToast(toastId, { message: `Error: ${data.error}`, type: "error", progress: undefined });
          setTimeout(() => removeToast(toastId), 4000);
          return;
        }

        const p = data.progress || 0;
        setProgress(p);
        updateToast(toastId, {
          message: data.message || "Scanning...",
          progress: p,
        });

        if (data.status === "completed") {
          completed = true;
          setProgress(100);
          updateToast(toastId, {
            message: `Done! Score: ${data.visibility_score}/100`,
            type: "success",
            progress: 100,
          });
          setTimeout(() => {
            removeToast(toastId);
            setScanning(false);
            setProgress(0);
          }, 3000);
          qc.invalidateQueries({ queryKey: queryKeys.dashboard(brandId) });
          qc.invalidateQueries({ queryKey: queryKeys.scans(brandId) });
        } else if (data.status === "failed") {
          completed = true;
          setScanning(false);
          setProgress(0);
          updateToast(toastId, {
            message: data.message || "Scan failed",
            type: "error",
            progress: undefined,
          });
          setTimeout(() => removeToast(toastId), 5000);
        }
      }, controller.signal);

      if (!completed) {
        qc.invalidateQueries({ queryKey: queryKeys.dashboard(brandId) });
        setScanning(false);
        setProgress(0);
        updateToast(toastId, { message: "Scan finished", type: "success", progress: 100 });
        setTimeout(() => removeToast(toastId), 3000);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setScanning(false);
      setProgress(0);
      const msg = err instanceof Error ? err.message : "Scan failed";
      const isInsufficient = msg.includes("402") || msg.toLowerCase().includes("insufficient");
      updateToast(toastId, {
        message: isInsufficient ? "Insufficient credits. Add credits to scan." : msg,
        type: "error",
        progress: undefined,
      });
      setTimeout(() => removeToast(toastId), 5000);
    }
  }, [brandId, selectedLLMs, scanning, onScanStarted, qc, addToast, updateToast, removeToast]);

  return (
    <div ref={configRef} style={{ position: "relative" }}>
      {/* Scan button */}
      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={handleScan}
          disabled={scanning || selectedLLMs.length === 0}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 8px",
            borderRadius: "var(--radius)",
            textDecoration: "none",
            background: scanning ? "var(--bg-dark)" : "var(--primary)",
            color: "var(--black)",
            fontSize: 12,
            fontWeight: 700,
            border: "1.5px solid var(--border)",
            justifyContent: "center",
            cursor: scanning || selectedLLMs.length === 0 ? "default" : "pointer",
            position: "relative",
            overflow: "hidden",
            transition: "background 0.2s",
            opacity: selectedLLMs.length === 0 ? 0.5 : 1,
          }}
        >
          {scanning && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "var(--primary)",
                opacity: 0.3,
                transformOrigin: "left",
                transform: `scaleX(${progress / 100})`,
                transition: "transform 0.4s ease",
              }}
            />
          )}
          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
            {scanning ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" stroke="var(--border)" strokeWidth="3" fill="none" />
                  <path d="M12 2 A10 10 0 0 1 22 12" stroke="var(--black)" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
                <span>{progress}%</span>
              </>
            ) : (
              <>
                <Plus size={14} strokeWidth={2.5} />
                <span>New scan</span>
              </>
            )}
          </div>
        </button>

        {/* Config toggle */}
        <button
          onClick={() => setShowConfig(!showConfig)}
          disabled={scanning}
          style={{
            width: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius)",
            background: showConfig ? "var(--bg-dark)" : "transparent",
            border: "1.5px solid var(--border)",
            cursor: scanning ? "default" : "pointer",
            flexShrink: 0,
            transition: "background 0.15s",
          }}
          title="Select models"
        >
          <Settings size={13} strokeWidth={2.5} color="var(--text-muted)" />
        </button>
      </div>

      {/* Model selection dropdown */}
      {showConfig && !scanning && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "4px 4px 0 #1A1A1A",
            zIndex: 100,
            padding: 10,
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, paddingLeft: 2 }}>
            Select models
          </div>
          {LLM_OPTIONS.map((llm) => {
            const isSelected = selectedLLMs.includes(llm.id);
            return (
              <label
                key={llm.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 6px",
                  borderRadius: 4,
                  cursor: "pointer",
                  background: isSelected ? "var(--bg-dark)" : "transparent",
                  transition: "background 0.1s",
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 400,
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--bg-dark)"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleLLM(llm.id)}
                  style={{ width: 12, height: 12, accentColor: "var(--primary)" }}
                />
                <span style={{ flex: 1 }}>{llm.label}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{llm.credits}cr</span>
              </label>
            );
          })}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{selectedLLMs.length} models</span>
            <span style={{ fontSize: 11, fontWeight: 700 }}>{totalCredits} cr/query</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
