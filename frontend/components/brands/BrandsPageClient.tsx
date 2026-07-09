"use client";

import { Suspense, useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useBrands, useCreateBrand, useDeleteBrand } from "@/lib/hooks";
import { AppHeader, PageHeader } from "@/components/AppHeader";

const PAGE_SIZE = 10;

function BrandsPageInner() {
  const { user, openAuthModal } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const { data: brands = [], isLoading, error: loadError, refetch } = useBrands();
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

  const filtered = useMemo(() => {
    if (!search) return brands;
    const q = search.toLowerCase();
    return brands.filter((b: any) => b.name.toLowerCase().includes(q) || b.domain.toLowerCase().includes(q));
  }, [brands, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  navigate({ search: searchInput.trim(), page: "1" });
                }
              }}
              placeholder="Search brands..."
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              onClick={() => navigate({ search: searchInput.trim(), page: "1" })}
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

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 56 }} />)}
          </div>
        ) : !user ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 14, fontWeight: 600 }}>Sign in to manage your brands.</div>
            <button onClick={() => openAuthModal("login")} className="btn btn-primary">Sign in</button>
          </div>
        ) : filtered.length === 0 && !search ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 14, fontWeight: 600 }}>You haven&apos;t added any brands yet.</div>
            <button onClick={() => setShowModal(true)} className="btn btn-primary">Add your first brand</button>
          </div>
        ) : filtered.length === 0 && search ? (
          <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 14, fontWeight: 600 }}>No brands match &quot;{search}&quot;</div>
            <button onClick={() => { setSearchInput(""); navigate({ search: "" }); }} className="btn btn-ghost">Clear search</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 10 }}>
              {filtered.length} brand{filtered.length !== 1 ? "s" : ""}{search && <> matching &quot;{search}&quot;</>}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {paginated.map((b, i) => (
                <div key={b.id} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, transform: `rotate(${i % 2 === 0 ? "-0.15deg" : "0.15deg"})` }}>
                  <div style={{ width: 36, height: 36, borderRadius: "var(--radius)", background: "var(--primary)", border: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, boxShadow: "var(--shadow-sm)" }}>
                    {b.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{b.domain}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    {deleteConfirm === b.id ? (
                      <>
                        <button onClick={() => handleDelete(b.id)} disabled={deleteBrand.isPending} className="btn btn-danger btn-sm">{deleteBrand.isPending ? "..." : "Yes"}</button>
                        <button onClick={() => setDeleteConfirm(null)} className="btn btn-sm btn-ghost">No</button>
                      </>
                    ) : (
                      <>
                        <Link href={`/brands/${b.id}`} className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>Open</Link>
                        <button onClick={() => setDeleteConfirm(b.id)} className="btn btn-sm btn-ghost" style={{ color: "var(--red)" }}>Del</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
                <button
                  onClick={() => navigate({ page: String(currentPage - 1) })}
                  disabled={currentPage <= 1}
                  className="btn btn-sm btn-ghost"
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => navigate({ page: String(p) })}
                    className={`btn btn-sm ${p === currentPage ? "btn-primary" : "btn-ghost"}`}
                    style={{ minWidth: 32 }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => navigate({ page: String(currentPage + 1) })}
                  disabled={currentPage >= totalPages}
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
  return (
    <Suspense fallback={<div className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--text-muted)", minHeight: "100vh" }}>Loading...</div>}>
      <BrandsPageInner />
    </Suspense>
  );
}
