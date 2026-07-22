"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useBrands } from "@/lib/hooks";
import {
  Search, ChevronLeft, ChevronRight, LayoutDashboard, SearchCode,
  History, Swords, Plus, LogOut, User, ExternalLink,
} from "lucide-react";

const ICON_STROKE = 2.5;

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, param: "tab" },
  { key: "queries", label: "Queries", icon: SearchCode, param: "tab" },
  { key: "scans", label: "Scans", icon: History, param: "tab" },
  { key: "competitors", label: "Competitors", icon: Swords, param: "tab" },
] as const;

function getRecentBrands(): { id: string; name: string }[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("recent_brands") || "[]");
  } catch { return []; }
}

function addRecentBrand(id: string, name: string) {
  const recent = getRecentBrands().filter((b) => b.id !== id);
  recent.unshift({ id, name });
  localStorage.setItem("recent_brands", JSON.stringify(recent.slice(0, 5)));
}

/* ─── Mobile hamburger button (rendered in dashboard-mobile-header) ─── */
function HamburgerButton() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [mobileOpen]);

  return (
    <>
      <button
        className="header-hamburger"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {mobileOpen && (
        <div className="sidebar-mobile-overlay" onClick={() => setMobileOpen(false)}>
          <div className="sidebar-mobile-backdrop" />
          <aside className="sidebar-mobile-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", borderBottom: "2px solid var(--border)", minHeight: 48, flexShrink: 0 }}>
              <Link href="/" style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", textDecoration: "none", lineHeight: 1 }} onClick={() => setMobileOpen(false)}>
                llm<span style={{ background: "var(--primary)", padding: "0 3px", border: "1.5px solid var(--border)" }}>ranked</span>
              </Link>
            </div>
            <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}

/* ─── Sidebar content (shared between desktop & mobile) ─── */
function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { brandId } = useParams<{ brandId: string }>();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { data: searchResults } = useBrands(1, searchQuery);
  const [recentBrands, setRecentBrands] = useState<{ id: string; name: string }[]>(() => getRecentBrands());

  const currentBrand = (searchResults ?? []).find((b) => b.id === brandId);
  useEffect(() => {
    if (currentBrand) addRecentBrand(currentBrand.id, currentBrand.name);
  }, [currentBrand]);

  const activeTab = searchParams.get("tab") || "overview";

  const recent = useMemo(() => {
    const others = recentBrands.filter((b) => b.id !== brandId).slice(0, 2);
    const active = recentBrands.find((b) => b.id === brandId);
    return active ? [active, ...others] : recentBrands.slice(0, 3);
  }, [recentBrands, brandId]);

  const searchItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return (searchResults ?? []).slice(0, 8);
  }, [searchResults, searchQuery]);

  useEffect(() => {
    if (!searchOpen) return;
    const close = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setSearchOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [searchOpen]);

  const brandHref = (id: string) => `/brands/${id}?tab=${activeTab}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", overflow: "hidden" }}>
      {/* Brand search dropdown */}
      {!collapsed && (
        <div ref={searchRef} style={{ padding: "8px 10px", borderBottom: "1.5px solid var(--border)", position: "relative" }}>
          <div
            style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-dark)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "5px 8px", cursor: "text" }}
            onClick={() => setSearchOpen(true)}
          >
            <Search size={14} strokeWidth={ICON_STROKE} color="var(--text-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search brands..."
              style={{ flex: 1, border: "none", background: "none", outline: "none", fontSize: 12, fontWeight: 600, color: "var(--text)", fontFamily: "inherit", minWidth: 0 }}
            />
          </div>
          {searchOpen && searchItems.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 10, right: 10, background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", zIndex: 100, maxHeight: 200, overflowY: "auto" }}>
              {searchItems.map((b) => (
                <Link
                  key={b.id}
                  href={brandHref(b.id)}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", textDecoration: "none", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, borderBottom: "1px solid var(--bg-dark)" }}
                  onClick={() => { addRecentBrand(b.id, b.name); setRecentBrands(getRecentBrands()); setSearchOpen(false); setSearchQuery(""); onNavigate?.(); }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: "var(--radius)", background: "var(--primary)", border: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Brand list */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", overscrollBehavior: "contain" }}>
        {/* Recent */}
        {recent.length > 0 && (
          <div style={{ padding: "6px 10px" }}>
            {!collapsed && <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, paddingLeft: 4 }}>Recent</div>}
            {recent.map((b) => {
              const isActive = b.id === brandId;
              return (
                <Link
                  key={b.id}
                  href={brandHref(b.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: "var(--radius)",
                    textDecoration: "none", fontSize: 12, fontWeight: isActive ? 700 : 600, transition: "background 0.1s",
                    background: isActive ? "var(--primary)" : "transparent",
                    color: isActive ? "var(--black)" : "var(--text-secondary)",
                    border: isActive ? "1.5px solid var(--border)" : "1.5px solid transparent",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-dark)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  title={b.name}
                  onClick={onNavigate}
                >
                  <div style={{ width: 22, height: 22, borderRadius: "var(--radius)", background: isActive ? "var(--surface)" : "var(--primary)", border: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>}
                </Link>
              );
            })}
          </div>
        )}

        {recent.length === 0 && !collapsed && (
          <div style={{ padding: "12px 10px", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
            Search for a brand above
          </div>
        )}
      </div>

      {/* Section nav */}
      {brandId && (
        <div style={{ borderTop: "2px solid var(--border)", padding: "6px 10px" }}>
          {!collapsed && <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, paddingLeft: 4 }}>Sections</div>}
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                href={`/brands/${brandId}?tab=${item.key}`}
                style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: "var(--radius)",
                  textDecoration: "none", fontSize: 12, fontWeight: isActive ? 700 : 600, transition: "background 0.1s",
                  background: isActive ? "var(--bg-dark)" : "transparent",
                  color: isActive ? "var(--text)" : "var(--text-secondary)",
                  borderLeft: isActive ? "3px solid var(--primary)" : "3px solid transparent",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg-dark)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                title={item.label}
                onClick={onNavigate}
              >
                <Icon size={16} strokeWidth={ICON_STROKE} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>
      )}

      {/* Quick action */}
      {brandId && !collapsed && (
        <div style={{ padding: "4px 10px", borderTop: "1.5px solid var(--border)" }}>
          <Link
            href={`/brands/${brandId}?tab=queries`}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: "var(--radius)", textDecoration: "none", background: "var(--primary)", color: "var(--black)", fontSize: 12, fontWeight: 700, border: "1.5px solid var(--border)", justifyContent: "center" }}
            onClick={onNavigate}
          >
            <Plus size={14} strokeWidth={ICON_STROKE} />
            <span>New scan</span>
          </Link>
        </div>
      )}

      {/* User section */}
      <div style={{ borderTop: "2px solid var(--border)", padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px" }}>
          <div style={{ width: 28, height: 28, borderRadius: "var(--radius)", background: "var(--primary)", border: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
            {user?.display_name?.charAt(0).toUpperCase() || "?"}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.display_name}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{user?.email}</div>
            </div>
          )}
          {!collapsed && (
            <button onClick={logout} className="btn btn-ghost" style={{ padding: 4, minWidth: 24, minHeight: 24 }} title="Sign out">
              <LogOut size={14} strokeWidth={ICON_STROKE} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Desktop sidebar ─── */
function DesktopSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const w = collapsed ? 56 : 220;

  return (
    <aside
      className="dashboard-sidebar"
      style={{
        width: w, flexShrink: 0, background: "var(--surface)", borderRight: "2px solid var(--border)",
        transition: "width 0.2s ease", overflow: "hidden",
        height: "100vh", position: "sticky", top: 0, zIndex: 40,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", height: "100%", width: w, transition: "width 0.2s ease", overflow: "hidden" }}>
        {/* Logo + collapse toggle */}
        <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid var(--border)", minHeight: 48 }}>
          {!collapsed && (
            <Link href="/" style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", textDecoration: "none", lineHeight: 1 }}>
              llm<span style={{ background: "var(--primary)", padding: "0 3px", border: "1.5px solid var(--border)" }}>ranked</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="btn btn-ghost"
            style={{ padding: 4, minWidth: 28, minHeight: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={16} strokeWidth={ICON_STROKE} /> : <ChevronLeft size={16} strokeWidth={ICON_STROKE} />}
          </button>
        </div>
        <SidebarContent collapsed={collapsed} />
      </div>
    </aside>
  );
}

/* ─── Public API ─── */
function SidebarRoot() {
  return <DesktopSidebar />;
}

SidebarRoot.Hamburger = HamburgerButton;

export { SidebarRoot as Sidebar };
