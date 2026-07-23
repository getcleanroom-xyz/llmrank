"use client";

import { useReducer, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useBrands, useCreateBrand, useDeleteBrand } from "@/lib/hooks";
import { BrandWizard } from "@/components/brands/BrandWizard";
import { useToast } from "@/components/ui/Toast";

const BRAND_CARD_COLORS = [
  { bg: "#FFF9DB", acc: "var(--primary)", rot: "-0.8deg" },
  { bg: "#DBEAFF", acc: "#3B82F6", rot: "0.6deg" },
  { bg: "#E6F9ED", acc: "#22C55E", rot: "-0.7deg" },
  { bg: "#F3E8FF", acc: "#A855F7", rot: "0.5deg" },
];

interface State {
  searchInput: string;
  showModal: boolean;
  deleteConfirm: string | null;
}

type Action =
  | { type: "searchInput"; value: string }
  | { type: "showModal"; value: boolean }
  | { type: "deleteConfirm"; value: string | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "searchInput":
      return { ...state, searchInput: action.value };
    case "showModal":
      return { ...state, showModal: action.value };
    case "deleteConfirm":
      return { ...state, deleteConfirm: action.value };
    default:
      return state;
  }
}

function BrandsPageInner() {
  const { user, openAuthModal } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const { data: brands = [], isLoading, error: loadError, refetch } = useBrands(page, search);
  const createBrand = useCreateBrand();
  const deleteBrand = useDeleteBrand();

  const [state, dispatch] = useReducer(reducer, {
    searchInput: search,
    showModal: false,
    deleteConfirm: null,
  });

  const { addToast } = useToast();

  const set = <K extends keyof State>(field: K, value: State[K]) =>
    dispatch({ type: field, value } as Action);

  const navigate = useCallback((p: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(p)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if (!("page" in p)) sp.delete("page");
    router.replace(`/brands${sp.toString() ? `?${sp.toString()}` : ""}`);
  }, [searchParams, router]);

  const handleSearch = () => navigate({ search: state.searchInput.trim(), page: "1" });

  const handleCreate = async (name: string, domain: string, competitors: string[]) => {
    try {
      await createBrand.mutateAsync({ name, domain, competitors });
      set("showModal", false);
      addToast(`${name} created`, "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to create brand", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBrand.mutateAsync(id);
      set("deleteConfirm", null);
      addToast("Brand deleted", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to delete brand", "error");
    }
  };

  const loading = isLoading;
  const error = loadError ? (loadError instanceof Error ? loadError.message : "Failed to load brands") : null;

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, maxWidth: 700, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>

        {user && (
          <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="input"
              value={state.searchInput}
              onChange={(e) => set("searchInput", e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="Search brands..."
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              onClick={handleSearch}
              className="btn btn-primary btn-sm"
              style={{ flexShrink: 0 }}
            >
              Search
            </button>
            {search && (
              <button
                onClick={() => { set("searchInput", ""); navigate({ search: "" }); }}
                className="btn btn-ghost btn-sm"
                style={{ flexShrink: 0 }}
              >
                Clear
              </button>
            )}
            <button
              onClick={() => set("showModal", true)}
              className="btn btn-primary btn-sm"
              style={{ flexShrink: 0 }}
            >
              + New
            </button>
          </div>
        )}

        {error && (
          <div className="card" style={{ background: "#FEE2E2", borderColor: "var(--red)", padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#991B1B", fontWeight: 600 }}>
            {error}
          </div>
        )}

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}
          </div>
        ) : !user ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 14, fontWeight: 600 }}>Sign in to manage your brands.</div>
            <button onClick={() => openAuthModal("login")} className="btn btn-primary">Sign in</button>
          </div>
        ) : brands.length === 0 && !search ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 14, fontWeight: 600 }}>You haven&apos;t added any brands yet.</div>
            <button onClick={() => set("showModal", true)} className="btn btn-primary">Add your first brand</button>
          </div>
        ) : brands.length === 0 && search ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 14, fontWeight: 600 }}>No brands match &quot;{search}&quot;</div>
            <button onClick={() => { set("searchInput", ""); navigate({ search: "" }); }} className="btn btn-ghost">Clear search</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 10 }}>
              {search ? `Results for "${search}"` : "Your brands"}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {brands.map((b, i) => {
                const c = BRAND_CARD_COLORS[i % BRAND_CARD_COLORS.length];
                return (
                <Link key={b.id} href={`/brands/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{
                  position: "relative",
                  background: c.bg,
                  border: "2px solid var(--border)",
                  borderRadius: "var(--radius)",
                  boxShadow: "2px 2px 0 #1A1A1A, 4px 4px 0 #1A1A1A, -1px 2px 0 #1A1A1A",
                  padding: "16px 16px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  transform: `rotate(${c.rot})`,
                  transition: "box-shadow 0.15s, transform 0.15s",
                  marginTop: 6,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "3px 3px 0 #1A1A1A, 5px 5px 0 #1A1A1A, -1px 3px 0 #1A1A1A"; e.currentTarget.style.transform = "rotate(0deg) translate(-1px, -1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "2px 2px 0 #1A1A1A, 4px 4px 0 #1A1A1A, -1px 2px 0 #1A1A1A"; e.currentTarget.style.transform = `rotate(${c.rot})`; }}
                >
                  {/* Pushpin */}
                  <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ position: "absolute", top: -9, left: 14, zIndex: 2 }}>
                    <ellipse cx="8" cy="4" rx="4" ry="4" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.2" />
                    <rect x="6.5" y="8" width="3" height="6" rx="0.5" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.2" />
                  </svg>

                  {/* Rough-edged avatar */}
                  <div style={{
                    width: 40, height: 40,
                    background: c.acc,
                    border: "2px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800, flexShrink: 0,
                    boxShadow: "2px 2px 0 #1A1A1A, -1px 2px 0 #1A1A1A",
                    fontFamily: "var(--font-hand), Caveat, cursive",
                  }}>
                    {b.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 20, fontWeight: 700, lineHeight: 1.1, marginBottom: 2 }}>
                      {b.name}
                    </div>
                    <svg width="60%" height="4" viewBox="0 0 60 4" preserveAspectRatio="none" style={{ display: "block", marginBottom: 4 }}>
                      <path d="M0 2 Q5 0 10 3 Q15 4 20 2 Q25 0 30 3 Q35 4 40 2 Q45 0 50 3 Q55 4 60 2" fill="none" stroke={c.acc} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{b.domain}</div>
                  </div>

                  <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                    {state.deleteConfirm === b.id ? (
                      <>
                        <button onClick={(e) => { e.preventDefault(); handleDelete(b.id); }} disabled={deleteBrand.isPending} className="btn btn-danger btn-sm">{deleteBrand.isPending ? "..." : "Yes"}</button>
                        <button onClick={(e) => { e.preventDefault(); set("deleteConfirm", null); }} className="btn btn-sm btn-ghost">No</button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); set("deleteConfirm", b.id); }} className="btn btn-sm btn-ghost" style={{ color: "var(--red)" }}>Del</button>
                      </>
                    )}
                  </div>
                </div>
                </Link>
              );})}
            </div>

            {brands.length >= 50 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
                <button
                  onClick={() => navigate({ page: String(page - 1) })}
                  disabled={page <= 1}
                  className="btn btn-sm btn-ghost"
                >
                  Prev
                </button>
                <button
                  onClick={() => navigate({ page: String(page + 1) })}
                  disabled={brands.length < 50}
                  className="btn btn-sm btn-ghost"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {state.showModal && (
        <BrandWizard open={state.showModal} onClose={() => set("showModal", false)} onCreated={handleCreate} creating={createBrand.isPending} />
      )}
    </div>
  );
}

export function BrandsPageClient() {
  return <BrandsPageInner />;
}
