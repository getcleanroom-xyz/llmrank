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
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "Scan failed to start" }));
        throw new Error(body.detail || `HTTP ${res.status}`);
      }

      const scan = await res.json();
      const scanId = scan.id;

      onScanStarted?.();
      updateToast(toastId, { message: "Scan started! Connecting to progress...", progress: 10 });

      // 2. Connect to SSE stream
      const eventSource = new EventSource(
        `${BASE_URL}/brands/${brandId}/scans/${scanId}/stream`
      );

      abortRef.current = new AbortController();

      eventSource.onmessage = (event) => {
        try {
          const data: ScanProgressEvent = JSON.parse(event.data);

          if (data.error) {
            eventSource.close();
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

          // Step notifications
          if (data.step === "scanning" && p === 15) {
            addToast("Querying AI models...", "info");
          }

          if (data.status === "completed") {
            eventSource.close();
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

            // Refresh dashboard data
            qc.invalidateQueries({ queryKey: queryKeys.dashboard(brandId) });
            qc.invalidateQueries({ queryKey: queryKeys.scans(brandId) });
          } else if (data.status === "failed") {
            eventSource.close();
            setScanning(false);
            setProgress(0);
            updateToast(toastId, {
              message: data.message || "Scan failed",
              type: "error",
              progress: undefined,
            });
            setTimeout(() => removeToast(toastId), 5000);
          }
        } catch {
          // Parse error, ignore
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        // If we haven't completed, poll for status as fallback
        if (scanning) {
          setScanning(false);
          setProgress(0);
          updateToast(toastId, { message: "Connection lost. Checking results...", type: "info", progress: undefined });
          qc.invalidateQueries({ queryKey: queryKeys.dashboard(brandId) });
          setTimeout(() => removeToast(toastId), 3000);
        }
      };
    } catch (err) {
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

  const strokeDashoffset = scanning ? 100 - progress : 100;

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
            {/* Spinning loader */}
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
