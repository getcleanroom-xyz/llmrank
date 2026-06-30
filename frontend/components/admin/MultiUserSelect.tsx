"use client";

import { useState, useRef, useEffect } from "react";
import type { AdminUser } from "@/lib/api";

interface MultiUserSelectProps {
  users: AdminUser[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function MultiUserSelect({ users, selectedIds, onChange, disabled }: MultiUserSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedSet = new Set(selectedIds);
  const selectedUsers = users.filter((u) => selectedSet.has(u.id));

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q);
  });

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexWrap: "wrap",
          padding: "5px 8px",
          border: "1.5px solid var(--border)",
          borderRadius: "var(--radius)",
          background: "var(--surface)",
          cursor: disabled ? "not-allowed" : "pointer",
          minHeight: 32,
          opacity: disabled ? 0.5 : 1,
        }}
        onClick={() => { if (!disabled) setOpen(!open); }}
      >
        {selectedUsers.length === 0 && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {disabled ? "No users selected" : "Search and select users..."}
          </span>
        )}
        {selectedUsers.slice(0, 5).map((u) => (
          <span
            key={u.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              background: "var(--primary)",
              border: "1.5px solid var(--border)",
              borderRadius: "var(--radius)",
            }}
          >
            {u.display_name}
            {!disabled && (
              <span
                style={{ cursor: "pointer", fontSize: 12, lineHeight: 1 }}
                onClick={(e) => { e.stopPropagation(); toggle(u.id); }}
              >
                ✕
              </span>
            )}
          </span>
        ))}
        {selectedUsers.length > 5 && (
          <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>
            +{selectedUsers.length - 5}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.1s", flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {open && !disabled && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "var(--surface)",
            border: "1.5px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow)",
            maxHeight: 280,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              autoFocus
              style={{
                width: "100%",
                fontSize: 11,
                padding: "4px 6px",
                border: "1.5px solid var(--border)",
                borderRadius: "var(--radius)",
                outline: "none",
                background: "var(--surface)",
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div style={{ overflow: "auto", flex: 1 }}>
            <div style={{ padding: "2px 4px" }}>
              <button
                type="button"
                onClick={() => {
                  if (selectedIds.length === users.length) {
                    onChange([]);
                  } else {
                    onChange(users.map((u) => u.id));
                  }
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "5px 8px",
                  fontSize: 10,
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--blue)",
                  borderRadius: "var(--radius)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-dark)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >
                {selectedIds.length === users.length ? "Deselect all" : "Select all users"}
              </button>
            </div>
            {filtered.length === 0 && (
              <div style={{ padding: "12px 10px", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                No users found
              </div>
            )}
            {filtered.map((u) => {
              const checked = selectedSet.has(u.id);
              return (
                <label
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    cursor: "pointer",
                    fontSize: 12,
                    background: checked ? "var(--bg-dark)" : "transparent",
                    borderRadius: "var(--radius)",
                    margin: "1px 4px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(u.id)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 11 }}>{u.display_name}</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{u.email}</div>
                  </div>
                </label>
              );
            })}
          </div>
          <div style={{ padding: "6px 8px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>
            {selectedIds.length} user{selectedIds.length !== 1 ? "s" : ""} selected
          </div>
        </div>
      )}
    </div>
  );
}
