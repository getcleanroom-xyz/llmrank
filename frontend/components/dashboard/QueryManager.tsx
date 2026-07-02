"use client";

import { useState } from "react";
import { useQueries, useAddQuery, useDeleteQuery, useSuggestQueries } from "@/lib/hooks";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

export function QueryManager({
  brandId,
  brandName,
  domain,
}: {
  brandId: string;
  brandName: string;
  domain: string;
}) {
  const { data: queries = [] } = useQueries(brandId);
  const addQuery = useAddQuery();
  const deleteQuery = useDeleteQuery();
  const suggestQueries = useSuggestQueries();

  const [input, setInput] = useState("");
  const [keywords, setKeywords] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; text: string } | null>(null);

  const handleAdd = async (text: string) => {
    if (!text.trim()) return;
    setError(null);
    try {
      await addQuery.mutateAsync({ brandId, query_text: text.trim() });
      setInput("");
      setSuggestions((prev) => prev.filter((s) => s !== text));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add query");
    }
  };

  const handleAddSuggestion = async (text: string) => {
    setError(null);
    try {
      await addQuery.mutateAsync({ brandId, query_text: text.trim() });
      setSuggestions((prev) => prev.filter((s) => s !== text));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add query");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await deleteQuery.mutateAsync({ brandId, queryId: deleteTarget.id });
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete query");
    }
  };

  const handleSuggest = async () => {
    setLoadingSuggestions(true);
    setError(null);
    try {
      const kws = keywords.split(",").map((k) => k.trim()).filter(Boolean);
      const res = await suggestQueries.mutateAsync({ brandId, brand_name: brandName, domain, keywords: kws });
      const existing = new Set(queries.map((q: any) => q.query_text.toLowerCase()));
      setSuggestions(res.suggested_queries.filter((s) => !existing.has(s.toLowerCase())));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <div>
      {/* Error banner */}
      {error && (
        <div
          style={{
            background: "rgba(240, 112, 112, 0.1)",
            border: "0.5px solid var(--red)",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 12,
            fontSize: 12,
            color: "var(--red-text)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: "none", border: "none", color: "var(--red-text)", cursor: "pointer", fontSize: 14 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Existing queries */}
      <div style={{ marginBottom: 16 }}>
        {queries.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "8px 0" }}>
            No queries yet. Add one below or let AI suggest some.
          </div>
        )}
        {queries.map((q) => (
          <div
            key={q.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 0",
              borderBottom: "0.5px solid var(--border)",
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 13,
                color: "var(--text-secondary)",
                fontStyle: "italic",
              }}
            >
              {/* eslint-disable react/no-unescaped-entities */}
              "{q.query_text}"
              {/* eslint-enable react/no-unescaped-entities */}
            </span>
            <button
              onClick={() => setDeleteTarget({ id: q.id, text: q.query_text })}
              style={{
                fontSize: 11,
                padding: "3px 8px",
                background: "transparent",
                border: "0.5px solid var(--border-strong)",
                borderRadius: 6,
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Add manually */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd(input)}
          placeholder="Add a query to monitor…"
          style={{
            flex: 1,
            background: "var(--bg-surface)",
            border: "0.5px solid var(--border-strong)",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 13,
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <button
          onClick={() => handleAdd(input)}
          disabled={addQuery.isPending || !input.trim()}
          style={{
            fontSize: 12,
            padding: "8px 16px",
            background: "var(--gold)",
            border: "none",
            borderRadius: 8,
            color: "#0A0A0B",
            fontWeight: 500,
            cursor: addQuery.isPending ? "not-allowed" : "pointer",
            opacity: addQuery.isPending ? 0.6 : 1,
          }}
        >
          Add
        </button>
      </div>

      {/* AI suggestions */}
      <button
        onClick={() => setShowSuggest((s) => !s)}
        style={{
          fontSize: 12,
          padding: "6px 12px",
          background: "transparent",
          border: "0.5px solid var(--border-gold)",
          borderRadius: 8,
          color: "var(--text-gold)",
          cursor: "pointer",
          marginBottom: showSuggest ? 10 : 0,
        }}
      >
        ✦ Suggest queries with AI
      </button>

      {showSuggest && (
        <div>
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Optional keywords (comma-separated)…"
            style={{
              width: "100%",
              background: "var(--bg-surface)",
              border: "0.5px solid var(--border-strong)",
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: 12,
              color: "var(--text-primary)",
              outline: "none",
              marginBottom: 8,
            }}
          />
          <button
            onClick={handleSuggest}
            disabled={loadingSuggestions}
            style={{
              fontSize: 12,
              padding: "6px 16px",
              background: "var(--bg-elevated)",
              border: "0.5px solid var(--border-strong)",
              borderRadius: 8,
              color: loadingSuggestions ? "var(--text-muted)" : "var(--text-primary)",
              cursor: loadingSuggestions ? "not-allowed" : "pointer",
              marginBottom: 10,
            }}
          >
            {loadingSuggestions ? "Generating…" : "Generate suggestions"}
          </button>

          {suggestions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {suggestions.map((s) => (
                <div
                  key={s}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--bg-surface)",
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  <span style={{ flex: 1, fontSize: 12, color: "var(--text-secondary)", fontStyle: "italic" }}>
                    {/* eslint-disable react/no-unescaped-entities */}
                    "{s}"
                    {/* eslint-enable react/no-unescaped-entities */}
                  </span>
                  <button
                    onClick={() => handleAddSuggestion(s)}
                    disabled={addQuery.isPending}
                    style={{
                      fontSize: 11,
                      padding: "3px 10px",
                      background: "var(--green-bg)",
                      border: "0.5px solid var(--green)",
                      borderRadius: 6,
                      color: "var(--green-text)",
                      cursor: addQuery.isPending ? "not-allowed" : "pointer",
                      opacity: addQuery.isPending ? 0.6 : 1,
                    }}
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          )}
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
