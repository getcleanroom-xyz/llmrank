"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
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

export function Sidebar() {
  const { brandId } = useParams<{ brandId: string }>();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { data: brandsData } = useBrands(1, "");
  const brands = brandsData ?? [];

  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [recentBrands, setRecentBrands] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => { setRecentBrands(getRecentBrands()); }, []);

  // Track current brand in recent
  const currentBrand = brands.find((b) => b.id === brandId);
  useEffect(() => {
    if (currentBrand) addRecentBrand(currentBrand.id, currentBrand.name);
  }, [currentBrand]);

  // Determine active tab from URL
  const activeTab = useMemo(() => {
    const params = new URLSearchParams(pathname.includes("?") ? pathname.split("?")[1] : "");
    return params.get("tab") || "overview";
  }, [pathname]);

  const filteredBrands = useMemo(() => {
    if (!search) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));
  }, [brands, search]);

  const recentFiltered = useMemo(() => {
    if (!search) return recentBrands.filter((b) => b.id !== brandId);
    return [];
  }, [recentBrands, brandId, search]);

  const showSearch = brands.length >= 3;
  const w = collapsed ? 56 : 220;

  const SidebarContent = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: w, transition: "width 0.2s ease", overflow: "hidden" }}>
      {/* Logo */}
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

      {/* Brand search — only when 3+ brands */}
      {showSearch && !collapsed && (
        <div style={{ padding: "8px 10px", borderBottom: "1.5px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-dark)", border: "1.5px solid var(--border)", borderRadius: "var(--radius)", padding: "5px 8px" }}>
            <Search size={14} strokeWidth={ICON_STROKE} color="var(--text-muted)" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brands..."
              style={{ flex: 1, border: "none", background: "none", outline: "none", fontSize: 12, fontWeight: 600, color: "var(--text)", fontFamily: "inherit", minWidth: 0 }}
            />
          </div>
        </div>
      )}

      {/* Brand list */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {/* Recent brands */}
        {recentFiltered.length > 0 && (
          <div style={{ padding: "6px 10px" }}>
            {!collapsed && <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, paddingLeft: 4 }}>Recent</div>}
            {recentFiltered.slice(0, collapsed ? 2 : 3).map((b) => (
              <Link
                key={b.id}
                href={`/brands/${b.id}`}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: "var(--radius)", textDecoration: "none", color: "var(--text-secondary)", fontSize: 12, fontWeight: 600, transition: "background 0.1s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-dark)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                title={b.name}
              >
                <div style={{ width: 22, height: 22, borderRadius: "var(--radius)", background: "var(--primary)", border: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                  {b.name.charAt(0).toUpperCase()}
                </div>
                {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>}
              </Link>
            ))}
          </div>
        )}

        {/* All brands */}
        {filteredBrands.length > 0 && (
          <div style={{ padding: "6px 10px" }}>
            {!collapsed && <div style={{ fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, paddingLeft: 4 }}>Brands</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {filteredBrands.map((b) => {
                const isActive = b.id === brandId;
                return (
                  <Link
                    key={b.id}
                    href={`/brands/${b.id}`}
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
                  >
                    <div style={{ width: 22, height: 22, borderRadius: "var(--radius)", background: isActive ? "var(--surface)" : "var(--bg-dark)", border: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                      {b.name.charAt(0).toUpperCase()}
                    </div>
                    {!collapsed && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {brands.length === 0 && !collapsed && (
          <div style={{ padding: "12px 10px", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
            No brands yet
          </div>
        )}

        {/* All brands link */}
        {brands.length > 0 && (
          <div style={{ padding: "4px 10px" }}>
            <Link
              href="/brands"
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: "var(--radius)", textDecoration: "none", color: "var(--primary)", fontSize: 12, fontWeight: 700 }}
              title="All brands"
            >
              <ExternalLink size={14} strokeWidth={ICON_STROKE} />
              {!collapsed && <span>All brands</span>}
            </Link>
          </div>
        )}
      </div>

      {/* Section nav (only when a brand is selected) */}
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

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="header-hamburger"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
        style={{ display: "none" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Desktop sidebar */}
      <aside
        style={{
          width: w, flexShrink: 0, background: "var(--surface)", borderRight: "2px solid var(--border)",
          transition: "width 0.2s ease", overflow: "hidden", display: "flex", flexDirection: "column",
          height: "100vh", position: "sticky", top: 0, zIndex: 40,
        }}
        className="dashboard-sidebar"
      >
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} onClick={() => setMobileOpen(false)} />
          <aside style={{ width: 260, background: "var(--surface)", borderRight: "2px solid var(--border)", position: "relative", zIndex: 101, display: "flex", flexDirection: "column" }}>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
