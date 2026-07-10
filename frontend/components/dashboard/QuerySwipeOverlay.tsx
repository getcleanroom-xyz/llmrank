"use client";

import { useState, useEffect, useCallback } from "react";
import type { ScoredQuery } from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
  brand_category: "Brand", workflow: "Workflow", competitor: "Competitor", adjacent: "Adjacent",
};
const TYPE_COLORS: Record<string, string> = {
  brand_category: "#22C55E", workflow: "#3B82F6", competitor: "#A855F7", adjacent: "#F97316",
};
const TYPE_BG: Record<string, string> = {
  brand_category: "#E6F9ED", workflow: "#DBEAFF", competitor: "#F3E8FF", adjacent: "#FFE8DB",
};

export function QuerySwipeOverlay({
  open, queries, onClose, onConfirm,
}: {
  open: boolean;
  queries: ScoredQuery[];
  onClose: () => void;
  onConfirm: (selected: ScoredQuery[]) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragX, setDragX] = useState(0);
  const [gridMode, setGridMode] = useState(false);

  useEffect(() => {
    if (open) { setIndex(0); setSelected(new Set()); setDragX(0); }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleSkip();
      if (e.key === "ArrowRight") handleAdd();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [index, selected, queries]);

  const handleAdd = useCallback(() => {
    if (index < queries.length) {
      setSelected(new Set(selected).add(index));
      setIndex(index + 1);
      setDragX(0);
    }
  }, [index, selected, queries]);

  const handleSkip = useCallback(() => {
    if (index < queries.length) {
      setIndex(index + 1);
      setDragX(0);
    }
  }, [index, queries]);

  const handleTouchMove = (e: React.TouchEvent) => { setDragX(e.touches[0].clientX - (window.innerWidth / 2)); };
  const handleTouchEnd = () => {
    if (dragX > 60) handleAdd();
    else if (dragX < -60) handleSkip();
    setDragX(0);
  };

  const toggleQuery = (i: number) => {
    const next = new Set(selected);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelected(next);
  };

  if (!open) return null;
  if (!queries.length) return <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div className="card" style={{ padding: 24, textAlign: "center" }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No query suggestions available.</div>
      <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>Close</button>
    </div>
  </div>;
  const current = queries[index];
  const isDone = index >= queries.length;
  const selCount = selected.size;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
        {!gridMode && <button onClick={() => setGridMode(true)} className="btn btn-ghost btn-sm" style={{ color: "#fff" }}>Grid</button>}
        <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ color: "#fff" }}>Close</button>
      </div>

      {gridMode ? (
        <div className="card" style={{ maxWidth: 700, width: "95%", maxHeight: "80vh", overflow: "auto", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="section-label">Select queries ({selCount})</div>
            <button onClick={() => setGridMode(false)} className="btn btn-ghost btn-sm">Swipe</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {queries.map((q, i) => (
              <div key={i} onClick={() => toggleQuery(i)} style={{ padding: "10px 14px", border: selected.has(i) ? "2px solid var(--primary)" : "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", background: selected.has(i) ? "#FFF9DB" : "var(--surface)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${selected.has(i) ? "var(--primary)" : "var(--text-muted)"}`, background: selected.has(i) ? "var(--primary)" : "transparent", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{q.query_text}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                    <span className="pill" style={{ fontSize: 9, background: TYPE_BG[q.query_type] || "var(--bg-dark)", borderColor: TYPE_COLORS[q.query_type] || "var(--border)", color: TYPE_COLORS[q.query_type] }}>{TYPE_LABELS[q.query_type] || q.query_type}</span>
                    <span style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 14, fontWeight: 700, color: q.score >= 4 ? "#22C55E" : q.score >= 3 ? "#F59E0B" : "#EF4444" }}>{q.score}/5</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { onConfirm(queries.filter((_, i) => selected.has(i))); onClose(); }} className="btn btn-primary" style={{ width: "100%" }}>Add {selCount} selected</button>
        </div>
      ) : isDone ? (
        <div className="card" style={{ maxWidth: 380, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>You selected {selCount} quer{selCount !== 1 ? "ies" : "y"}</div>
          {selCount > 0 && (
            <button onClick={() => { onConfirm(queries.filter((_, i) => selected.has(i))); onClose(); }} className="btn btn-primary" style={{ marginBottom: 8 }}>Add {selCount} selected</button>
          )}
          <button onClick={onClose} className="btn btn-ghost btn-sm">Done</button>
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface)", border: "2px solid var(--border)", borderRadius: "var(--radius)",
            boxShadow: "4px 4px 0 #1A1A1A", maxWidth: 420, width: "90%", padding: 24,
            transform: `translateX(${dragX}px) rotate(${dragX * 0.02}deg)`,
            transition: dragX === 0 ? "transform 0.2s ease" : "none",
          }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <span className="pill" style={{ fontSize: 10, background: TYPE_BG[current.query_type] || "var(--bg-dark)", borderColor: TYPE_COLORS[current.query_type] || "var(--border)", color: TYPE_COLORS[current.query_type] }}>{TYPE_LABELS[current.query_type] || current.query_type}</span>
            <span style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 18, fontWeight: 700, color: current.score >= 4 ? "#22C55E" : current.score >= 3 ? "#F59E0B" : "#EF4444" }}>{current.score}/5</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, marginBottom: 16, minHeight: 60 }}>{current.query_text}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={handleSkip} className="btn" style={{ flex: 1, marginRight: 8, borderColor: "#EF4444", color: "#991B1B" }}>Skip</button>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{index + 1}/{queries.length}</span>
            <button onClick={handleAdd} className="btn btn-primary" style={{ flex: 1, marginLeft: 8 }}>Add</button>
          </div>
          <div className="bar-track" style={{ marginTop: 10, height: 3 }}>
            <div className="bar-fill" style={{ width: `${((index + 1) / queries.length) * 100}%`, background: "var(--primary)", borderRadius: 0 }} />
          </div>
        </div>
      )}
    </div>
  );
}
