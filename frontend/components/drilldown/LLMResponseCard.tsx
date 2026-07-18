"use client";

import { useState, useRef, useEffect } from "react";
import type { QueryResult } from "@/types";
import { LLMTag, SentimentPill, PositionPill } from "@/components/ui";
import Markdown from "react-markdown";

const COLLAPSED_HEIGHT = 180;

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

function uniqueEntities(hits: { entity?: string | null; text: string }[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const h of hits) {
    const name = h.entity ? h.entity.toLowerCase() : "";
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push(h.entity!);
    }
  }
  return result;
}

function ErrorResponse({ text }: { text: string }) {
  const match = text.match(/\[Error: (.+?)\]/);
  const msg = match ? match[1] : text.replace(/^\[|]$/g, "");
  const isRateLimit = msg.includes("429") || msg.includes("rate limit");
  return (
    <div style={{ padding: "12px 14px", background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#991B1B", marginBottom: 2 }}>{isRateLimit ? "Rate limited" : "Request failed"}</div>
      <div style={{ fontSize: 11, color: "#991B1B", wordBreak: "break-word" }}>
        {isRateLimit ? "Free tier limit reached. Try again later or use a different model." : msg.length > 100 ? msg.slice(0, 100) + "..." : msg}
      </div>
    </div>
  );
}

function FullResponseSheet({ result, onClose }: { result: QueryResult; onClose: () => void }) {
  const isMobile = useIsMobile();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", handleEscape); document.body.style.overflow = ""; };
  }, [onClose]);

  const handleTouchStart = (e: React.TouchEvent) => { dragStart.current = e.touches[0].clientY; };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStart.current === null) return;
    const diff = e.touches[0].clientY - dragStart.current;
    if (diff > 0) setDragY(diff);
  };
  const handleTouchEnd = () => {
    if (dragY > 100) onClose();
    setDragY(0);
    dragStart.current = null;
  };

  if (isMobile) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100 }} onClick={onClose}>
        <div ref={sheetRef} onClick={(e) => e.stopPropagation()} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--surface)", borderTop: "2px solid var(--border)", borderRadius: "12px 12px 0 0", maxHeight: "90vh", display: "flex", flexDirection: "column", transform: `translateY(${dragY}px)`, transition: dragY === 0 ? "transform 0.2s ease" : "none" }}>
          <div style={{ padding: "10px 0 6px", display: "flex", justifyContent: "center" }}><div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)" }} /></div>
          <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: "2px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><LLMTag name={result.llm_name} /><PositionPill position={result.mentioned ? result.position : null} /><SentimentPill sentiment={result.sentiment} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {result.score !== null && <span style={{ fontSize: 16, fontWeight: 800 }}>{result.score}</span>}
              <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, boxShadow: "var(--shadow-sm)" }}>x</button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "14px 16px" }}><div className="md-content"><Markdown>{result.raw_response}</Markdown></div></div>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", width: "100%", maxWidth: 720, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 16px", borderBottom: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "var(--bg-dark)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><LLMTag name={result.llm_name} /><PositionPill position={result.mentioned ? result.position : null} /><SentimentPill sentiment={result.sentiment} /></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {result.score !== null && <span style={{ fontSize: 16, fontWeight: 800, color: result.score >= 70 ? "#166534" : result.score >= 40 ? "var(--text)" : "#991B1B" }}>{result.score}</span>}
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "var(--radius)", border: "1.5px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, boxShadow: "var(--shadow-sm)" }}>x</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}><div className="md-content"><Markdown>{result.raw_response}</Markdown></div></div>
      </div>
    </div>
  );
}

export function LLMResponseCard({ result }: { result: QueryResult }) {
  const [showFull, setShowFull] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isWinner = result.mentioned && (result.position ?? 99) <= 2;
  const isNotMentioned = !result.mentioned;
  const annotations = result.annotated_response ?? [];
  const brandHits = annotations.filter((a) => a.type === "brand");
  const competitorHits = annotations.filter((a) => a.type === "competitor");
  const qualifierHits = annotations.filter((a) => a.type === "qualifier");
  const isError = (result.raw_response ?? "").startsWith("[Error");

  const uniqueBrands = uniqueEntities(brandHits);
  const uniqueCompetitors = uniqueEntities(competitorHits);

  useEffect(() => {
    if (contentRef.current) setNeedsExpand(contentRef.current.scrollHeight > COLLAPSED_HEIGHT + 20);
  }, [result.raw_response]);

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: "hidden", borderColor: isWinner ? "var(--green)" : isNotMentioned ? "#ccc" : undefined, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: "2px solid var(--border)", background: isWinner ? "#F0FDF4" : "var(--bg-dark)", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <LLMTag name={result.llm_name} />
            <PositionPill position={result.mentioned ? result.position : null} />
            <SentimentPill sentiment={result.sentiment} />
          </div>
          {result.score !== null && <div style={{ fontSize: 18, fontWeight: 800, color: result.score >= 70 ? "#166534" : result.score >= 40 ? "var(--text)" : "#991B1B" }}>{result.score}</div>}
        </div>

        {/* Response preview — fixed height, no overlap */}
        <div style={{ flex: "0 0 auto" }}>
          <div ref={contentRef} className="md-content" style={{ padding: "14px 16px", maxHeight: `${COLLAPSED_HEIGHT}px`, overflow: "hidden" }}>
            {isError ? <ErrorResponse text={result.raw_response} /> : <Markdown>{result.raw_response || "No response recorded."}</Markdown>}
          </div>
        </div>

        {/* Expand button — sits BETWEEN preview and footer, not overlapping */}
        {needsExpand && (
          <div style={{ borderTop: "1.5px solid var(--border)", textAlign: "center", padding: "6px 0" }}>
            <button onClick={() => setShowFull(true)} style={{ fontSize: 11, fontWeight: 700, padding: "4px 14px", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
              Show full response
            </button>
          </div>
        )}

        {/* Annotation summary */}
        {(uniqueBrands.length > 0 || uniqueCompetitors.length > 0 || qualifierHits.length > 0) && (
          <div style={{ padding: "8px 14px", borderTop: "1.5px solid var(--border)", background: "var(--bg-dark)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start", fontSize: 11, fontWeight: 600, lineHeight: 1.5 }}>
            {uniqueBrands.length > 0 && (
              <span style={{ color: "#166534" }}>Brand: {uniqueBrands.join(", ")}</span>
            )}
            {uniqueCompetitors.length > 0 && (
              <span style={{ color: "#991B1B" }}>Competitors: {uniqueCompetitors.join(", ")}</span>
            )}
            {qualifierHits.length > 0 && (
              <span style={{ color: "#92400E" }}>{qualifierHits.length} caveat{qualifierHits.length !== 1 ? "s" : ""}</span>
            )}
          </div>
        )}

        {/* Competitor positions */}
        {result.competitors_mentioned.length > 0 && (
          <div style={{ padding: "8px 14px", borderTop: "1.5px solid var(--border)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase" }}>Also ranked</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {result.competitors_mentioned.slice(0, 5).map((c) => <span key={c.name} className="pill pill-neu" style={{ fontSize: 10 }}>{c.position != null ? `#${c.position} ` : ""}{c.name}</span>)}
            </div>
          </div>
        )}
      </div>

      {showFull && <FullResponseSheet result={result} onClose={() => setShowFull(false)} />}
    </>
  );
}
