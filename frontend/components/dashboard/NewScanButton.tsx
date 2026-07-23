"use client";

import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { queryKeys } from "@/lib/query-keys";
import { Plus } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const DEFAULT_LLMS = ["chatgpt", "llama"];

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
  const abortRef = useRef<AbortController | null>(null);
  const qc = useQueryClient();
  const { addToast, updateToast, removeToast } = useToast();

  const handleScan = useCallback(async () => {
    if (scanning) return;

    const llms = lastScanLLMs && lastScanLLMs.length > 0 ? lastScanLLMs : DEFAULT_LLMS;
    const controller = new AbortController();
    abortRef.current = controller;

    setScanning(true);
    setProgress(5);

    const toastId = addToast("Starting scan...", "progress", { progress: 5 });

    try {
      // 1. Trigger the scan
      const res = await fetch(`${BASE_URL}/brands/${brandId}/scans`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ llms }),
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

      // 2. Connect to SSE stream via fetch (supports credentials)
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

      // If stream ended without completion (e.g. server closed), do a final check
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
  }, [brandId, lastScanLLMs, scanning, onScanStarted, qc, addToast, updateToast, removeToast]);

  return (
    <button
      onClick={handleScan}
      disabled={scanning}
      style={{
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
        cursor: scanning ? "default" : "pointer",
        position: "relative",
        overflow: "hidden",
        width: "100%",
        transition: "background 0.2s",
      }}
    >
      {/* Progress bar background */}
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

      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "center" }}>
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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </button>
  );
}
