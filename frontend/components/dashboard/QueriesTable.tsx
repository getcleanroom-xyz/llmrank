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

  return (
    <div>
      {error && (
        <div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#991B1B", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600 }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#991B1B", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>x</button>
        </div>
      )}

      {/* Hero heading */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(24px, 3.5vw, 34px)", fontWeight: 700, margin: "0 0 2px", lineHeight: 1, transform: "rotate(-0.3deg)" }}>
          Queries
        </h1>
        <svg width="50%" height="6" viewBox="0 0 120 6" preserveAspectRatio="none" style={{ display: "block", marginBottom: 4 }}>
          <path d="M0 3 Q8 0 16 4 Q24 6 32 2 Q40 0 48 5 Q56 6 64 2 Q72 0 80 4 Q88 6 96 2 Q104 0 112 4 Q120 3 120 2" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
          {total} {total === 1 ? "query" : "queries"} monitored
        </span>
      </div>

      {/* Search + Add card */}
      <div style={{ position: "relative", background: "#FFF9DB", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "3px 3px 0 #1A1A1A", padding: "16px 18px 12px", marginBottom: 14, transform: "rotate(-0.2deg)" }}>
        <svg width="18" height="22" viewBox="0 0 18 22" fill="none" style={{ position: "absolute", top: -10, left: 16 }}>
          <ellipse cx="9" cy="4.5" rx="4.5" ry="4.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
          <rect x="7" y="9" width="4" height="7" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
        </svg>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              style={{ width: "100%", background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px 8px 32px", fontSize: 13, color: "var(--text)", outline: "none" }}
            />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd(input)}
            placeholder="Add a query..."
            style={{ flex: 1, minWidth: 140, background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 13, color: "var(--text)", outline: "none" }}
          />
          <button onClick={() => handleAdd(input)} disabled={addQuery.isPending || !input.trim()} className="btn btn-primary btn-sm">
            {addQuery.isPending ? "..." : "Add"}
          </button>
        </div>

        {/* AI suggestions */}
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setShowSuggest((s) => !s)} style={{ fontWeight: 600, background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 16 }}>
            {showSuggest ? "hide AI suggestions" : "+ AI suggestions"}
          </button>
          {showSuggest && (
            <>
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="keywords, comma, separated"
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

      {/* Query cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>Loading...</div>
        ) : items.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "32px 20px" }}>
            <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 22, color: "var(--text-muted)", marginBottom: 4 }}>
              {search ? "Nothing found" : "No queries yet"}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {search ? "Try a different search term." : "Add your first query above."}
            </p>
          </div>
        ) : (
          items.map((q, i) => (
            <div
              key={q.id}
              className="card"
              onClick={() => router.push(`/brands/${brandId}/queries/${q.id}`)}
              style={{
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                transform: `rotate(${i % 2 === 0 ? "-0.12deg" : "0.12deg"})`,
                borderLeft: q.result_count > 0 ? "4px solid var(--primary)" : "4px solid var(--bg-dark)",
                transition: "box-shadow 0.15s, transform 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-hover)"; e.currentTarget.style.transform = `rotate(0deg) translate(-1px, -1px)`; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow)"; e.currentTarget.style.transform = `rotate(${i % 2 === 0 ? "-0.12deg" : "0.12deg"})`; }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {q.query_text}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                    {q.result_count > 0 ? `${q.result_count} result${q.result_count !== 1 ? "s" : ""}` : "no results"}
                  </span>
                  {q.last_scan_at && (
                    <>
                      <span style={{ color: "var(--text-muted)", fontSize: 10 }}>&middot;</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                        last scan {timeAgo(q.last_scan_at)}
                      </span>
                    </>
                  )}
                  <span style={{ color: "var(--text-muted)", fontSize: 10 }}>&middot;</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                    added {timeAgo(q.created_at)}
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: q.id, text: q.query_text }); }}
                title="Delete"
                style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "transparent", border: "1.5px solid transparent", borderRadius: "var(--radius)", color: "var(--text-muted)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "#991B1B"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                x
              </button>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
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

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete query"
        confirmLabel="Delete"
        destructive
        loading={deleteQuery.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        Are you sure you want to delete the query <strong>&quot;{deleteTarget?.text}&quot;</strong>? This will also remove all scan results for this query. This action cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
