"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueriesTable, useAddQuery, useDeleteQuery, useSuggestQueries } from "@/lib/hooks";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const CARD_COLORS = [
  { bg: "#FFF9DB", acc: "var(--primary)", rot: "-0.3deg" },
  { bg: "#DBEAFF", acc: "#3B82F6", rot: "0.4deg" },
  { bg: "#E6F9ED", acc: "#22C55E", rot: "-0.35deg" },
  { bg: "#F3E8FF", acc: "#A855F7", rot: "0.3deg" },
  { bg: "#FFE8DB", acc: "#F97316", rot: "-0.25deg" },
];

export function QueriesTable({
  brandId,
  brandName,
  domain,
}: {
  brandId: string;
  brandName: string;
  domain: string;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(search, 300);
  const { data, isLoading } = useQueriesTable(brandId, page, 20, debouncedSearch);
  const addQuery = useAddQuery();
  const deleteQuery = useDeleteQuery();
  const suggestQueries = useSuggestQueries();

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const handleAdd = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setError(null);
    try {
      await addQuery.mutateAsync({ brandId, query_text: text.trim() });
      setInput("");
      setSuggestions((prev) => prev.filter((s) => s !== text));
      setPage(1);
      setSearch("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add query");
    }
  }, [brandId, addQuery]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await deleteQuery.mutateAsync({ brandId, queryId: deleteTarget.id });
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete query");
    }
  }, [brandId, deleteQuery, deleteTarget]);

  const handleSuggest = useCallback(async () => {
    setError(null);
    try {
      const kws = keywords.split(",").map((k) => k.trim()).filter(Boolean);
      const existing = new Set(data?.items.map((q) => q.query_text.toLowerCase()) ?? []);
      const res = await suggestQueries.mutateAsync({ brandId, brand_name: brandName, domain, keywords: kws });
      setSuggestions(res.suggested_queries.filter((s) => !existing.has(s.toLowerCase())));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate suggestions");
    }
  }, [brandId, brandName, domain, keywords, suggestQueries, data]);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const scanned = items.filter((q) => q.result_count > 0).length;
  const lastAt = items.find((q) => q.last_scan_at)?.last_scan_at ?? null;

  return (
    <div>
      {error && (
        <div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#991B1B", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600 }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#991B1B", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>x</button>
        </div>
      )}

      {/* Hero row: heading + stat pills */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(24px, 3.5vw, 34px)", fontWeight: 700, margin: "0 0 2px", lineHeight: 1, transform: "rotate(-0.3deg)" }}>
            Queries
          </h1>
          <svg width="160" height="6" viewBox="0 0 160 6" preserveAspectRatio="none" style={{ display: "block" }}>
            <path d="M0 3 Q10 0 20 5 Q30 8 40 3 Q50 0 60 6 Q70 8 80 2 Q90 0 100 5 Q110 8 120 3 Q130 0 140 5 Q150 8 160 3" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { val: total, label: "total", bg: "#FFF9DB", acc: "var(--primary)" },
            { val: scanned, label: "scanned", bg: "#E6F9ED", acc: "#22C55E" },
            { val: lastAt ? timeAgo(lastAt) : "never", label: "last scan", bg: "#DBEAFF", acc: "#3B82F6" },
          ].map((s, i) => (
            <div key={s.label} style={{ background: s.bg, border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-sm)", padding: "8px 14px", transform: `rotate(${i % 2 === 0 ? "-0.2deg" : "0.2deg"})`, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.acc, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search + Add — spread across columns */}
      <div style={{ position: "relative", background: "#FFF9DB", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "3px 3px 0 #1A1A1A", padding: "16px 18px 12px", marginBottom: 16, transform: "rotate(-0.15deg)" }}>
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none" style={{ position: "absolute", top: -10, right: 20 }}>
          <ellipse cx="9" cy="4.5" rx="4.5" ry="4.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
          <rect x="7" y="9" width="4" height="7" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
        </svg>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search queries..."
              style={{ width: "100%", background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px 8px 32px", fontSize: 13, color: "var(--text)", outline: "none" }} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd(input)} placeholder="Add a query..."
            style={{ flex: 1, minWidth: 160, background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 13, color: "var(--text)", outline: "none" }} />
          <button onClick={() => handleAdd(input)} disabled={addQuery.isPending || !input.trim()} className="btn btn-primary btn-sm">
            {addQuery.isPending ? "..." : "Add"}
          </button>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setShowSuggest((s) => !s)} style={{ fontWeight: 600, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 16 }}>
            {showSuggest ? "hide AI suggestions" : "+ AI suggestions"}
          </button>
          {showSuggest && (
            <>
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="keywords, comma separated"
                style={{ flex: 1, minWidth: 120, background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "5px 8px", fontSize: 12, color: "var(--text)", outline: "none" }} />
              <button onClick={handleSuggest} disabled={suggestQueries.isPending} className="btn btn-sm">{suggestQueries.isPending ? "..." : "Generate"}</button>
            </>
          )}
        </div>

        {suggestions.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: "2px dashed var(--border)" }}>
            {suggestions.map((s) => (
              <button key={s} onClick={() => handleAdd(s)} disabled={addQuery.isPending}
                style={{ fontSize: 12, fontWeight: 600, padding: "5px 12px", background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", transform: "rotate(0.5deg)", boxShadow: "var(--shadow-sm)", fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", color: "var(--text-secondary)" }}>
                "{s}" <span style={{ marginLeft: 4, color: "#22C55E", fontWeight: 700 }}>+</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Query cards grid */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>Loading queries...</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 24, color: "var(--text-muted)", marginBottom: 4 }}>
            {search ? "Nothing found" : "No queries yet"}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {search ? "Try a different search term." : "Add your first query above."}
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--gap)", marginBottom: 16 }}>
            {items.map((q, i) => {
              const c = CARD_COLORS[i % CARD_COLORS.length];
              return (
                <div
                  key={q.id}
                  className="card sketchy"
                  onClick={() => router.push(`/brands/${brandId}/queries/${q.id}`)}
                  style={{
                    background: c.bg,
                    padding: "14px 16px",
                    cursor: "pointer",
                    transform: `rotate(${c.rot})`,
                    transition: "box-shadow 0.15s, transform 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-hover)"; e.currentTarget.style.transform = "rotate(0deg) translate(-1px, -1px)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow)"; e.currentTarget.style.transform = `rotate(${c.rot})`; }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {q.query_text}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {q.result_count > 0 ? (
                        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>
                          {q.result_count} result{q.result_count !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>unscanned</span>
                      )}
                      {q.last_scan_at && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>scanned {timeAgo(q.last_scan_at)}</span>}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: q.id, text: q.query_text }); }}
                      title="Delete"
                      style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "transparent", border: "1.5px solid transparent", borderRadius: "var(--radius)", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, lineHeight: 1 }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "#991B1B"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
                    >
                      x
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {pages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="btn btn-sm btn-ghost" style={{ opacity: page <= 1 ? 0.3 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}>Prev</button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                let n: number;
                if (pages <= 7) n = i + 1;
                else if (page <= 4) n = i + 1;
                else if (page >= pages - 3) n = pages - 6 + i;
                else n = page - 3 + i;
                return (
                  <button key={n} onClick={() => setPage(n)} className="btn btn-sm"
                    style={{ minWidth: 32, fontWeight: n === page ? 800 : 500, background: n === page ? "var(--primary)" : "var(--bg-dark)", color: n === page ? "#0A0A0B" : "var(--text)" }}>
                    {n}
                  </button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}
                className="btn btn-sm btn-ghost" style={{ opacity: page >= pages ? 0.3 : 1, cursor: page >= pages ? "not-allowed" : "pointer" }}>Next</button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete query"
        confirmLabel="Delete"
        destructive
        loading={deleteQuery.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        Delete <strong>&quot;{deleteTarget?.text}&quot;</strong>? This will also remove all scan results for this query. This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
