"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useBrands, useCreateBrand, useDeleteBrand } from "@/lib/hooks";
import { AppHeader, PageHeader } from "@/components/AppHeader";

const BRAND_CARD_COLORS = [
  { bg: "#FFF9DB", acc: "var(--primary)", rot: "-0.8deg" },
  { bg: "#DBEAFF", acc: "#3B82F6", rot: "0.6deg" },
  { bg: "#E6F9ED", acc: "#22C55E", rot: "-0.7deg" },
  { bg: "#F3E8FF", acc: "#A855F7", rot: "0.5deg" },
];

function BrandsPageInner() {
  const { user, openAuthModal } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const { data: brands = [], isLoading, error: loadError, refetch } = useBrands(page, search);
  const createBrand = useCreateBrand();
  const deleteBrand = useDeleteBrand();

  const [success, setSuccess] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(search);

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [nameError, setNameError] = useState("");
  const [domainError, setDomainError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const navigate = useCallback((p: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(p)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if (!("page" in p)) sp.delete("page");
    router.replace(`/brands${sp.toString() ? `?${sp.toString()}` : ""}`);
  }, [searchParams, router]);

  const handleSearch = () => navigate({ search: searchInput.trim(), page: "1" });

  const validate = useCallback(() => {
    let valid = true;
    if (!name.trim()) { setNameError("Required"); valid = false; } else setNameError("");
    if (!domain.trim()) { setDomainError("Required"); valid = false; }
    else if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain.trim())) { setDomainError("Invalid domain"); valid = false; }
    else setDomainError("");
    return valid;
  }, [name, domain]);

  const handleCreate = async () => {
    if (!validate()) return;
    try {
      await createBrand.mutateAsync({ name: name.trim(), domain: domain.trim() });
      setName(""); setDomain(""); setShowModal(false);
      setSuccess(`${name.trim()} created`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setSuccess(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBrand.mutateAsync(id);
      setDeleteConfirm(null);
      setSuccess("Brand deleted");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setSuccess(null);
    }
  };

  const loading = isLoading;
  const error = loadError ? (loadError instanceof Error ? loadError.message : "Failed to load brands") : null;

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <AppHeader
        breadcrumb={
          <span style={{ fontSize: 13, fontWeight: 600 }}>brands</span>
        }
      />
      <PageHeader>
        {user && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}>+ New brand</button>
        )}
      </PageHeader>

      <div style={{ flex: 1, maxWidth: 700, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        <h1
          style={{
            fontFamily: "var(--font-hand), Caveat, cursive",
            fontSize: "clamp(32px, 5vw, 42px)",
            fontWeight: 700,
            margin: "0 0 4px",
            lineHeight: 1,
            transform: "rotate(-0.5deg)",
          }}
        >
          Your brands
        </h1>
        <svg width="140" height="8" viewBox="0 0 140 8" preserveAspectRatio="none" style={{ display: "block", marginBottom: 16 }}>
          <path d="M0 4 Q10 0 20 5 Q30 8 40 3 Q50 0 60 6 Q70 8 80 2 Q90 0 100 5 Q110 8 120 3 Q130 1 140 5" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
        </svg>

        {user && (
          <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
            <input
              className="input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
                onClick={() => { setSearchInput(""); navigate({ search: "" }); }}
                className="btn btn-ghost btn-sm"
                style={{ flexShrink: 0 }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="card" style={{ background: "#FEE2E2", borderColor: "var(--red)", padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#991B1B", fontWeight: 600 }}>
            {error}
          </div>
        )}
        {success && (
          <div className="card" style={{ background: "#DCFCE7", borderColor: "var(--green)", padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#166534", fontWeight: 600 }}>{success}</div>
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
            <button onClick={() => setShowModal(true)} className="btn btn-primary">Add your first brand</button>
          </div>
        ) : brands.length === 0 && search ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 14, fontWeight: 600 }}>No brands match &quot;{search}&quot;</div>
            <button onClick={() => { setSearchInput(""); navigate({ search: "" }); }} className="btn btn-ghost">Clear search</button>
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
                    {deleteConfirm === b.id ? (
                      <>
                        <button onClick={(e) => { e.preventDefault(); handleDelete(b.id); }} disabled={deleteBrand.isPending} className="btn btn-danger btn-sm">{deleteBrand.isPending ? "..." : "Yes"}</button>
                        <button onClick={(e) => { e.preventDefault(); setDeleteConfirm(null); }} className="btn btn-sm btn-ghost">No</button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteConfirm(b.id); }} className="btn btn-sm btn-ghost" style={{ color: "var(--red)" }}>Del</button>
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

      {showModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.4)", padding: "var(--page-px)",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="card" style={{ width: "100%", maxWidth: 420, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="section-label">New brand</div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, fontWeight: 700, color: "var(--text-muted)" }}>x</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div>
                <label htmlFor="modal-brand-name" style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Brand name</label>
                <input id="modal-brand-name" className="input" value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="e.g. Notion" autoComplete="off" />
                {nameError && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4, fontWeight: 600 }}>{nameError}</div>}
              </div>
              <div>
                <label htmlFor="modal-brand-domain" style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Domain</label>
                <input id="modal-brand-domain" className="input" value={domain} onChange={(e) => { setDomain(e.target.value); setDomainError(""); }} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="notion.so" autoComplete="off" />
                {domainError && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4, fontWeight: 600 }}>{domainError}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleCreate} disabled={createBrand.isPending} className="btn btn-primary" style={{ flex: 1 }}>{createBrand.isPending ? "Creating..." : "Create brand"}</button>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function BrandsPageClient() {
  return <BrandsPageInner />;
}
