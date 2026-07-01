"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { AdminUser } from "@/lib/api";

interface MultiUserSelectProps {
  users: AdminUser[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  manualEmails: string[];
  onManualEmailsChange: (emails: string[]) => void;
  disabled?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function MultiUserSelect({
  users,
  selectedIds,
  onChange,
  manualEmails,
  onManualEmailsChange,
  disabled,
}: MultiUserSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const manualSet = useMemo(() => new Set(manualEmails), [manualEmails]);
  const selectedUsers = useMemo(() => users.filter((u) => selectedSet.has(u.id)), [users, selectedSet]);

  const userEmailSet = useMemo(() => new Set(users.map((u) => u.email.toLowerCase())), [users]);

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter((u) => u.email.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q));
  }, [users, search]);

  const isEmailSearch = EMAIL_RE.test(search.trim());
  const emailAlreadyInUsers = isEmailSearch && userEmailSet.has(search.trim().toLowerCase());
  const emailAlreadyManual = isEmailSearch && manualSet.has(search.trim().toLowerCase());
  const showAddEmail = isEmailSearch && !emailAlreadyInUsers && !emailAlreadyManual;

  const addManualEmail = () => {
    const email = search.trim();
    if (!EMAIL_RE.test(email)) return;
    if (manualSet.has(email)) return;
    if (selectedSet.size === 0 && manualEmails.length === 0) {
      onChange([]);
    }
    onManualEmailsChange([...manualEmails, email]);
    setSearch("");
  };

  const removeManualEmail = (email: string) => {
    onManualEmailsChange(manualEmails.filter((e) => e !== email));
  };

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const allTags = [
    ...selectedUsers.map((u) => ({ type: "user" as const, id: u.id, label: u.display_name, sub: u.email })),
    ...manualEmails.map((e) => ({ type: "manual" as const, id: e, label: e, sub: undefined })),
  ];
  const totalSelected = selectedIds.length + manualEmails.length;

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
        {totalSelected === 0 && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {disabled ? "None selected" : "Search users or type an email..."}
          </span>
        )}
        {allTags.slice(0, 5).map((t) => (
          <span
            key={t.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              fontSize: 10,
              fontWeight: 600,
              padding: "2px 6px",
              background: t.type === "manual" ? "var(--surface)" : "var(--primary)",
              border: t.type === "manual" ? "1.5px dashed var(--border)" : "1.5px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--text)",
            }}
          >
            {t.type === "manual" && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <polyline points="22,4 12,13 2,4" />
              </svg>
            )}
            {t.label}
            {!disabled && (
              <span
                style={{ cursor: "pointer", fontSize: 12, lineHeight: 1, marginLeft: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (t.type === "user") toggle(t.id);
                  else removeManualEmail(t.id);
                }}
              >
                ✕
              </span>
            )}
          </span>
        ))}
        {allTags.length > 5 && (
          <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>
            +{allTags.length - 5}
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
            maxHeight: 320,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 4 }}>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && showAddEmail) {
                    e.preventDefault();
                    addManualEmail();
                  }
                }}
                placeholder="Search users or type an email + Enter..."
                style={{
                  flex: 1,
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
          </div>

          <div style={{ overflow: "auto", flex: 1 }}>
            {showAddEmail && (
              <div style={{ padding: "2px 4px", borderBottom: "1px solid var(--bg-dark)" }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    addManualEmail();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    background: "var(--bg-dark)",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text)",
                    borderRadius: "var(--radius)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-dark)"; }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13 }}>+</span>
                  Add <strong>{search.trim()}</strong> as external recipient
                </button>
              </div>
            )}

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
                  color: "var(--text)",
                  borderRadius: "var(--radius)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-dark)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >
                {selectedIds.length === users.length ? "Deselect all" : "Select all users"}
              </button>
            </div>

            {filtered.length === 0 && !showAddEmail && (
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
            {totalSelected > 0
              ? `${totalSelected} recipient${totalSelected !== 1 ? "s" : ""} (${selectedIds.length} user${selectedIds.length !== 1 ? "s" : ""}${manualEmails.length > 0 ? `, ${manualEmails.length} external` : ""})`
              : "No recipients selected"}
          </div>
        </div>
      )}
    </div>
  );
}
