"use client";

import { useState } from "react";

export interface FilterState {
  dateRange: string; // "7d" | "30d" | "90d" | "all"
  scoreMin: string;
  scoreMax: string;
  search: string;
  status: string; // "all" | "active" | "inactive" | "scanned" | "unscanned"
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  showStatus?: boolean;
  showScore?: boolean;
  statusOptions?: { label: string; value: string }[];
}

const DATE_PRESETS = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "All", value: "all" },
];

const DEFAULT_STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Inactive", value: "inactive" },
];

export function FilterBar({
  filters,
  onChange,
  showStatus = true,
  showScore = true,
  statusOptions = DEFAULT_STATUS_OPTIONS,
}: FilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  const update = (partial: Partial<FilterState>) => {
    onChange({ ...filters, ...partial });
  };

  const hasFilters = filters.scoreMin || filters.scoreMax ||
    filters.status !== "all" || filters.dateRange !== "30d";

  return (
    <div
      style={{
        background: "#FFF9DB",
        border: "2px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "3px 3px 0 #1A1A1A",
        padding: "12px 14px",
        marginBottom: 16,
        transform: "rotate(-0.1deg)",
      }}
    >
      {/* Pushpin */}
      <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ position: "absolute", top: -9, right: 16, zIndex: 2 }}>
        <ellipse cx="8" cy="4" rx="4" ry="4" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.2" />
        <rect x="6.5" y="8" width="3" height="6" rx="0.5" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.2" />
      </svg>

      {/* Main row: Search + Date range */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180, position: "relative" }}>
          <input
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            placeholder="Search..."
            style={{
              width: "100%",
              background: "var(--surface)",
              border: "1.5px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "7px 12px 7px 30px",
              fontSize: 13,
              color: "var(--text)",
              outline: "none",
            }}
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        {/* Date range pills */}
        <div style={{ display: "flex", gap: 4 }}>
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => update({ dateRange: preset.value })}
              style={{
                padding: "5px 10px",
                fontSize: 11,
                fontWeight: 600,
                background: filters.dateRange === preset.value ? "var(--primary)" : "var(--surface)",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--radius)",
                cursor: "pointer",
                color: filters.dateRange === preset.value ? "#1A1A1A" : "var(--text-muted)",
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 600,
            background: hasFilters ? "var(--primary)" : "var(--surface)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--radius)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filters
          {hasFilters && (
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--red)", display: "inline-block",
            }} />
          )}
        </button>
      </div>

      {/* Expanded filters */}
      {expanded && (
        <div style={{
          display: "flex", gap: 12, marginTop: 10, paddingTop: 10,
          borderTop: "1.5px dashed var(--border)",
          flexWrap: "wrap", alignItems: "center",
        }}>
          {showScore && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Score:</span>
              <input
                type="number"
                value={filters.scoreMin}
                onChange={(e) => update({ scoreMin: e.target.value })}
                placeholder="min"
                style={{
                  width: 50, padding: "4px 6px", fontSize: 11,
                  background: "var(--surface)", border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius)", outline: "none",
                }}
              />
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>-</span>
              <input
                type="number"
                value={filters.scoreMax}
                onChange={(e) => update({ scoreMax: e.target.value })}
                placeholder="max"
                style={{
                  width: 50, padding: "4px 6px", fontSize: 11,
                  background: "var(--surface)", border: "1.5px solid var(--border)",
                  borderRadius: "var(--radius)", outline: "none",
                }}
              />
            </div>
          )}

          {showStatus && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Status:</span>
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => update({ status: opt.value })}
                  style={{
                    padding: "3px 8px", fontSize: 10, fontWeight: 600,
                    background: filters.status === opt.value ? "var(--primary)" : "var(--surface)",
                    border: "1px solid var(--border)", borderRadius: "var(--radius)",
                    cursor: "pointer",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {hasFilters && (
            <button
              onClick={() => onChange({
                dateRange: "30d", scoreMin: "", scoreMax: "",
                search: "", status: "all",
              })}
              style={{
                padding: "3px 8px", fontSize: 10, fontWeight: 600,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", cursor: "pointer",
                color: "var(--red)",
              }}
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
