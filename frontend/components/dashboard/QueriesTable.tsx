"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  useQueriesTable, useAddQuery, useDeleteQuery,
  useSuggestQueries, useQueryTrend, useBulkUpdateQueries,
} from "@/lib/hooks";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Sparkline } from "@/components/ui/Sparkline";
import { FilterBar, type FilterState } from "./FilterBar";
import { timeAgo } from "@/lib/utils";

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
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
  const isMobile = useIsMobile();
  const [page, setPage] = useState(1);
  const [input, setInput] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; text: string } | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    dateRange: "30d",
    scoreMin: "",
    scoreMax: "",
    search: "",
    status: "all",
  });

  const debouncedSearch = useDebounce(filters.search, 300);
  const { data, isLoading } = useQueriesTable(brandId, page, 20, debouncedSearch);
  const { data: trendData } = useQueryTrend(brandId, filters.dateRange === "all" ? 365 : parseInt(filters.dateRange) || 30);
  const addQuery = useAddQuery();
  const deleteQuery = useDeleteQuery();
  const suggestQueries = useSuggestQueries();
  const bulkUpdate = useBulkUpdateQueries();

  const handleAdd = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setError(null);
    try {
      await addQuery.mutateAsync({ brandId, query_text: text.trim() });
      setInput("");
      setSuggestions((prev) => prev.filter((s) => s !== text));
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add prompt");
    }
  }, [brandId, addQuery]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await deleteQuery.mutateAsync({ brandId, queryId: deleteTarget.id });
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete prompt");
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

  const toggleSelect = useCallback((id: string, shiftKey: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClicked) {
        const items = data?.items ?? [];
        const startIdx = items.findIndex((q) => q.id === lastClicked);
        const endIdx = items.findIndex((q) => q.id === id);
        if (startIdx !== -1 && endIdx !== -1) {
          const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          for (let i = from; i <= to; i++) next.add(items[i].id);
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    setLastClicked(id);
  }, [lastClicked, data]);

  const toggleSelectAll = useCallback(() => {
    const items = data?.items ?? [];
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((q) => q.id)));
  }, [data, selected.size]);

  const handleBulkAction = useCallback(async (action: "activate" | "deactivate" | "delete") => {
    if (selected.size === 0) return;
    setError(null);
    try {
      await bulkUpdate.mutateAsync({ brandId, action, queryIds: Array.from(selected) });
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : `Failed to ${action} prompts`);
    }
  }, [brandId, selected, bulkUpdate]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const scanned = useMemo(() => items.filter((q) => q.result_count > 0).length, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((q) => {
      if (filters.status === "active" && !q.is_active) return false;
      if (filters.status === "inactive" && q.is_active) return false;
      if (filters.status === "scanned" && q.result_count === 0) return false;
      if (filters.status === "unscanned" && q.result_count > 0) return false;
      if (filters.scoreMin && (q.query_score ?? 0) < parseInt(filters.scoreMin)) return false;
      if (filters.scoreMax && (q.query_score ?? 0) > parseInt(filters.scoreMax)) return false;
      return true;
    });
  }, [items, filters]);

  const allSelected = filteredItems.length > 0 && filteredItems.every((q) => selected.has(q.id));

  return (
    <div>
      {error && (
        <div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#991B1B", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600 }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#991B1B", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>x</button>
        </div>
      )}

      {/* Hero row */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(24px, 3.5vw, 34px)", fontWeight: 700, margin: "0 0 2px", lineHeight: 1, transform: "rotate(-0.3deg)" }}>
            Prompts
          </h1>
          <svg width="160" height="6" viewBox="0 0 160 6" preserveAspectRatio="none" style={{ display: "block" }}>
            <path d="M0 3 Q10 0 20 5 Q30 8 40 3 Q50 0 60 6 Q70 8 80 2 Q90 0 100 5 Q110 8 120 3 Q130 0 140 5 Q150 8 160 3" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { val: total, label: "total", bg: "#FFF9DB", acc: "var(--primary)" },
            { val: scanned, label: "scanned", bg: "#E6F9ED", acc: "#22C55E" },
          ].map((s, i) => (
            <div key={s.label} style={{ background: s.bg, border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-sm)", padding: "8px 14px", transform: `rotate(${i % 2 === 0 ? "-0.2deg" : "0.2deg"})`, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.acc, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Add prompt input */}
      <div style={{ position: "relative", background: "#FFF9DB", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "3px 3px 0 #1A1A1A", padding: "12px 14px", marginBottom: 12, transform: "rotate(-0.1deg)" }}>
        <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ position: "absolute", top: -9, right: 14, zIndex: 2 }}>
          <ellipse cx="8" cy="4" rx="4" ry="4" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.2" />
          <rect x="6.5" y="8" width="3" height="6" rx="0.5" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.2" />
        </svg>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd(input)}
            placeholder="Add a prompt..."
            style={{
              flex: 1, minWidth: 0,
              background: "var(--surface)", border: "1.5px solid var(--border)",
              borderRadius: "var(--radius)", padding: "8px 12px",
              fontSize: 13, color: "var(--text)", outline: "none",
            }}
          />
          <button
            onClick={() => handleAdd(input)}
            disabled={addQuery.isPending || !input.trim()}
            className="btn btn-primary btn-sm"
          >
            {addQuery.isPending ? "..." : "Add"}
          </button>
        </div>

        <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => setShowSuggest((s) => !s)}
            style={{
              fontWeight: 600, background: "none", border: "none", cursor: "pointer",
              color: "var(--text-secondary)", fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 16,
            }}
          >
            {showSuggest ? "hide AI suggestions" : "+ AI suggestions"}
          </button>
          {showSuggest && (
            <>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="keywords, comma separated"
                style={{
                  flex: 1, minWidth: 120,
                  background: "var(--surface)", border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius)", padding: "5px 8px",
                  fontSize: 12, color: "var(--text)", outline: "none",
                }}
              />
              <button onClick={handleSuggest} disabled={suggestQueries.isPending} className="btn btn-sm">
                {suggestQueries.isPending ? "..." : "Generate"}
              </button>
            </>
          )}
        </div>

        {suggestions.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, paddingTop: 8, borderTop: "2px dashed var(--border)" }}>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleAdd(s)}
                disabled={addQuery.isPending}
                style={{
                  fontSize: 12, fontWeight: 600, padding: "5px 12px",
                  background: "var(--surface)", border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius)", cursor: "pointer",
                  transform: "rotate(0.5deg)", boxShadow: "var(--shadow-sm)",
                  fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic",
                  color: "var(--text-secondary)",
                }}
              >
                &quot;{s}&quot; <span style={{ marginLeft: 4, color: "#22C55E", fontWeight: 700 }}>+</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        showStatus={true}
        showScore={true}
        statusOptions={[
          { label: "All", value: "all" },
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
          { label: "Scanned", value: "scanned" },
          { label: "Unscanned", value: "unscanned" },
        ]}
      />

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="prompts-bulk-bar" style={{
          padding: "8px 12px", marginBottom: 12,
          background: "#DBEAFF", border: "2px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "2px 2px 0 #1A1A1A",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#1E40AF" }}>
            {selected.size} selected
          </span>
          <div className="bulk-actions-row" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => handleBulkAction("activate")} disabled={bulkUpdate.isPending} className="btn btn-sm" style={{ fontSize: 11 }}>Activate</button>
            <button onClick={() => handleBulkAction("deactivate")} disabled={bulkUpdate.isPending} className="btn btn-sm" style={{ fontSize: 11 }}>Deactivate</button>
            <button onClick={() => setBulkDeleteConfirm(true)} disabled={bulkUpdate.isPending} className="btn btn-sm btn-danger" style={{ fontSize: 11 }}>Delete</button>
          </div>
          <button onClick={() => setSelected(new Set())} className="btn btn-sm btn-ghost" style={{ fontSize: 11, marginLeft: isMobile ? 0 : "auto" }}>Clear selection</button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13, fontWeight: 600 }}>Loading prompts...</div>
      ) : filteredItems.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 24, color: "var(--text-muted)", marginBottom: 4 }}>
            {filters.search || filters.status !== "all" ? "Nothing found" : "No prompts yet"}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {filters.search || filters.status !== "all" ? "Try adjusting your filters." : "Add your first prompt above."}
          </p>
        </div>
      ) : (
        <div style={{
          background: "var(--surface)",
          border: "2px solid var(--border)",
          borderRadius: "var(--radius)",
          overflow: "hidden",
        }}>
          {/* Desktop table header */}
          <div className="prompts-table-grid" style={{
            padding: "8px 12px",
            background: "var(--bg-dark)",
            borderBottom: "2px solid var(--border)",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} style={{ cursor: "pointer" }} />
            </div>
            <div>Prompt</div>
            <div style={{ textAlign: "center" }}>Score</div>
            <div style={{ textAlign: "center" }}>Trend</div>
            <div style={{ textAlign: "center" }}>Status</div>
            <div style={{ textAlign: "center" }}>Last Scanned</div>
            <div style={{ textAlign: "center" }}>Actions</div>
          </div>

          {/* Rows */}
          {filteredItems.map((q, i) => {
            const trendPoints = trendData?.[q.id] ?? [];
            const trendScores = trendPoints.map((t) => t.score);
            const isSelected = selected.has(q.id);

            return (
              <div
                key={q.id}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest("input[type='checkbox']")) return;
                  if ((e.target as HTMLElement).closest("button")) return;
                  router.push(`/brands/${brandId}/queries/${q.id}`);
                }}
                className="prompts-row-grid"
                style={{
                  padding: isMobile ? "12px" : "10px 12px",
                  borderBottom: i < filteredItems.length - 1 ? "1px solid var(--bg-dark)" : "none",
                  background: isSelected ? "#FFF9DB" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--bg)"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                {/* Checkbox */}
                <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: isMobile ? "flex-start" : "center" }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(q.id, e.shiftKey); }}
                    style={{ cursor: "pointer" }}
                  />
                </div>

                {/* Prompt text */}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, lineHeight: 1.3,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap",
                  }}>
                    {q.query_text}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    {q.query_type ?? "general"}
                  </div>
                  {/* Mobile meta */}
                  <div className="prompts-mobile-meta" style={{ marginTop: 6 }}>
                    {q.query_score != null && <span style={{ fontWeight: 700 }}>Score: {q.query_score}</span>}
                    <span>{q.is_active ? "active" : "inactive"}</span>
                    <span>{q.last_scan_at ? timeAgo(q.last_scan_at) : "never scanned"}</span>
                  </div>
                </div>

                {/* Score (desktop only) */}
                <div className="prompts-col-score">
                  {q.query_score != null ? (
                    <span style={{ fontSize: 14, fontWeight: 800, color: q.query_score >= 4 ? "#166534" : q.query_score >= 3 ? "var(--text)" : "#991B1B" }}>
                      {q.query_score}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>-</span>
                  )}
                </div>

                {/* Trend (desktop only) */}
                <div className="prompts-col-trend">
                  <Sparkline data={trendScores} width={80} height={24} />
                </div>

                {/* Status (desktop only) */}
                <div className="prompts-col-status">
                  <span className={`pill ${q.is_active ? "pill-pos" : "pill-neu"}`} style={{ fontSize: 10, padding: "2px 8px" }}>
                    {q.is_active ? "active" : "inactive"}
                  </span>
                </div>

                {/* Last scanned (desktop only) */}
                <div className="prompts-col-scanned" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {q.last_scan_at ? timeAgo(q.last_scan_at) : "never"}
                </div>

                {/* Actions */}
                <div className="prompts-col-actions" style={{ justifyContent: isMobile ? "flex-end" : "center" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: q.id, text: q.query_text }); }}
                    title="Delete"
                    style={{
                      width: 24, height: 24,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "transparent", border: "1px solid transparent",
                      borderRadius: "var(--radius)", color: "var(--text-muted)",
                      cursor: "pointer", fontSize: 12,
                    }}
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
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 }}>
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
        title="Delete prompt"
        confirmLabel="Delete"
        destructive
        loading={deleteQuery.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      >
        Delete <strong>&quot;{deleteTarget?.text}&quot;</strong>? This will also remove all scan results for this prompt. This cannot be undone.
      </ConfirmDialog>

      <ConfirmDialog
        open={bulkDeleteConfirm}
        title="Delete prompts"
        confirmLabel="Delete"
        destructive
        loading={bulkUpdate.isPending}
        onConfirm={() => { setBulkDeleteConfirm(false); handleBulkAction("delete"); }}
        onCancel={() => setBulkDeleteConfirm(false)}
      >
        Delete <strong>{selected.size} prompts</strong>? This will also remove all scan results for these prompts. This cannot be undone.
      </ConfirmDialog>
    </div>
  );
}
