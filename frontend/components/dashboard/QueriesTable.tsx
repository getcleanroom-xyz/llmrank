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
  const { data, isLoading, isPlaceholderData } = useQueriesTable(brandId, page, 20, debouncedSearch);
  const addQuery = useAddQuery();
  const deleteQuery = useDeleteQuery();
  const suggestQueries = useSuggestQueries();

  // reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  const handleAdd = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setError(null);
    try {
      await addQuery.mutateAsync({ brandId, query_text: text.trim() });
      setInput("");
      setSuggestions((prev) => prev.filter((s) => s !== text));
      // go to first page to see the new query
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
      {/* Error banner */}
      {error && (
        <div style={{
          background: "rgba(240, 112, 112, 0.1)",
          border: "1.5px solid var(--red)",
          borderRadius: "var(--radius)",
          padding: "8px 12px",
          marginBottom: 12,
          fontSize: 12,
          color: "#991B1B",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: 600,
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#991B1B", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Search + Add row */}
      <div className="card" style={{ marginBottom: 12, overflow: "visible" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 160, position: "relative" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search queries…"
              style={{
                width: "100%",
                background: "var(--bg-surface)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "8px 12px 8px 32px",
                fontSize: 13,
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
            <svg
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="var(--text-muted)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd(input)}
            placeholder="Add a query…"
            style={{
              flex: 1,
              minWidth: 140,
              background: "var(--bg-surface)",
              border: "1.5px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "8px 12px",
              fontSize: 13,
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            onClick={() => handleAdd(input)}
            disabled={addQuery.isPending || !input.trim()}
            className="btn btn-primary btn-sm"
          >
            {addQuery.isPending ? "Adding…" : "Add"}
          </button>
        </div>

        {/* AI suggestions toggle + keywords */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => setShowSuggest((s) => !s)}
            className={showSuggest ? "btn btn-sm" : "btn btn-ghost btn-sm"}
          >
            {showSuggest ? "▾ AI Suggestions" : "▸ AI Suggestions"}
          </button>
          {showSuggest && (
            <>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Keywords (comma-separated)"
                style={{
                  flex: 1,
                  minWidth: 140,
                  background: "var(--bg-surface)",
                  border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                onClick={handleSuggest}
                disabled={suggestQueries.isPending}
                className="btn btn-sm"
              >
                {suggestQueries.isPending ? "Generating…" : "Generate"}
              </button>
            </>
          )}
        </div>

        {/* AI suggestion results */}
        {suggestions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10, paddingTop: 10, borderTop: "1.5px solid var(--border)" }}>
            {suggestions.map((s) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  background: "var(--bg-dark)",
                  borderRadius: "var(--radius)",
                }}
              >
                <span style={{ flex: 1, fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>"{s}"</span>
                <button
                  onClick={() => handleAdd(s)}
                  disabled={addQuery.isPending}
                  className="btn btn-sm"
                  style={{ fontSize: 11, padding: "2px 10px" }}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Header row — hidden on small screens */}
        <div className="queries-table-header" style={{
          display: "none",
          padding: "10px 14px",
          borderBottom: "1.5px solid var(--border)",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
        }}>
          <div style={{ flex: 3 }}>Query</div>
          <div style={{ flex: 1, textAlign: "center" }}>Status</div>
          <div style={{ flex: 1, textAlign: "center" }}>Results</div>
          <div style={{ flex: 1, textAlign: "center" }}>Last scan</div>
          <div style={{ flex: 1, textAlign: "center" }}>Created</div>
          <div style={{ width: 50 }} />
        </div>

        {isLoading ? (
          <div style={{ padding: "20px 14px", textAlign: "center", color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>Loading queries…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: "24px 14px", textAlign: "center" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
              {search ? "No queries match your search" : "No queries yet"}
            </div>
            {!search && (
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Add a query above or use AI suggestions to get started
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Desktop rows */}
            <div className="queries-table-rows" style={{ display: "flex", flexDirection: "column" }}>
              {items.map((q, idx) => (
                <div
                  key={q.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/brands/${brandId}/queries/${q.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter") router.push(`/brands/${brandId}/queries/${q.id}`); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom: idx < items.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-dark)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  {/* Mobile: stacked layout */}
                  <div className="queries-table-mobile" style={{ display: "none", flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, wordBreak: "break-word" }}>{q.query_text}</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className={`pill ${q.is_active ? "pill-pos" : "pill-neu"}`} style={{ fontSize: 9 }}>{q.is_active ? "active" : "inactive"}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>{q.result_count} results</span>
                      {q.last_scan_at && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>scanned {timeAgo(q.last_scan_at)}</span>}
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>added {timeAgo(q.created_at)}</span>
                    </div>
                  </div>

                  {/* Desktop: grid layout */}
                  <div className="queries-table-desktop" style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <div style={{ flex: 3, minWidth: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.query_text}</div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <span className={`pill ${q.is_active ? "pill-pos" : "pill-neu"}`} style={{ fontSize: 9 }}>{q.is_active ? "active" : "inactive"}</span>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", fontSize: 13, fontWeight: 600, color: q.result_count > 0 ? "var(--text)" : "var(--text-muted)" }}>{q.result_count}</div>
                    <div style={{ flex: 1, textAlign: "center", fontSize: 12, color: q.last_scan_at ? "var(--text-secondary)" : "var(--text-muted)" }}>
                      {q.last_scan_at ? timeAgo(q.last_scan_at) : "\u2013"}
                    </div>
                    <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>
                      {timeAgo(q.created_at)}
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: q.id, text: q.query_text }); }}
                    title="Delete query"
                    style={{
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      background: "transparent",
                      border: "1.5px solid transparent",
                      borderRadius: "var(--radius)",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: 14,
                      lineHeight: 1,
                      transition: "all 0.1s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "#991B1B"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "10px 14px",
                borderTop: "1.5px solid var(--border)",
              }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn btn-sm btn-ghost"
                  style={{ opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? "not-allowed" : "pointer", border: "1.5px solid var(--border)" }}
                >
                  ‹ Prev
                </button>

                {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                  // show first, last, and pages around current
                  let pageNum: number;
                  if (pages <= 7) {
                    pageNum = i + 1;
                  } else if (page <= 4) {
                    pageNum = i + 1;
                  } else if (page >= pages - 3) {
                    pageNum = pages - 6 + i;
                  } else {
                    pageNum = page - 3 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className="btn btn-sm"
                      style={{
                        minWidth: 30,
                        fontWeight: pageNum === page ? 800 : 500,
                        background: pageNum === page ? "var(--primary)" : "var(--bg-dark)",
                        border: "1.5px solid var(--border)",
                        color: pageNum === page ? "#0A0A0B" : "var(--text)",
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="btn btn-sm btn-ghost"
                  style={{ opacity: page >= pages ? 0.4 : 1, cursor: page >= pages ? "not-allowed" : "pointer", border: "1.5px solid var(--border)" }}
                >
                  Next ›
                </button>

                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8, fontWeight: 600 }}>
                  {total} total
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete query"
        confirmLabel="Delete"
        destructive
        loading={deleteQuery.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        Are you sure you want to delete the query <strong>"{deleteTarget?.text}"</strong>? This will also remove all scan results for this query. This action cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
