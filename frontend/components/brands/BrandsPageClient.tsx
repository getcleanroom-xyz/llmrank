"use client";

import { Suspense, useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBrands, createBrand, deleteBrand } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import type { Brand } from "@/types";

const PAGE_SIZE = 10;

function BrandsPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(search);

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [creating, setCreating] = useState(false);
  const [nameError, setNameError] = useState("");
  const [domainError, setDomainError] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const navigate = useCallback((p: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(p)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    if (!("page" in p)) sp.delete("page");
    router.replace(`/brands${sp.toString() ? `?${sp.toString()}` : ""}`);
  }, [searchParams, router]);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const c = new AbortController();
    abortRef.current = c;
    try {
      setError(null);
      const data = await getBrands();
      if (!c.signal.aborted) setBrands(data);
    } catch (err) {
      if (!c.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load brands");
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  useEffect(() => { setSearchInput(search); }, [search]);

  useEffect(() => {
    if (showModal) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [showModal]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const filtered = useMemo(() => {
    if (!search) return brands;
    const q = search.toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(q) || b.domain.toLowerCase().includes(q));
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
    setCreating(true);
    try {
      await createBrand(name.trim(), domain.trim());
      setName(""); setDomain(""); setShowModal(false);
      setSuccess(`${name.trim()} created`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create brand");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteBrand(id);
      setDeleteConfirm(null);
      setSuccess("Brand deleted");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete brand");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <AppHeader
        before={<><span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>/</span><span style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}>brands</span></>}
        after={user ? <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: "3px 8px", lineHeight: "20px" }}>+ New brand</button> : undefined}
      />

      <div style={{ flex: 1, maxWidth: 700, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {user && (
          <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
            <input
              ref={searchInputRef}
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
          <div className="card" style={{ background: "#FEE2E2", borderColor: "var(--red)", padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#991B1B", fontWeight: 600 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#991B1B" }}>x</button>
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
            <button data-auth-trigger className="btn btn-primary">Sign in</button>
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
              {paginated.map((b) => (
                <div key={b.id} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
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
                        <button onClick={() => handleDelete(b.id)} disabled={deleting} className="btn btn-danger btn-sm">{deleting ? "..." : "Yes"}</button>
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
                <input ref={nameInputRef} id="modal-brand-name" className="input" value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="e.g. Notion" autoComplete="off" />
                {nameError && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4, fontWeight: 600 }}>{nameError}</div>}
              </div>
              <div>
                <label htmlFor="modal-brand-domain" style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Domain</label>
                <input id="modal-brand-domain" className="input" value={domain} onChange={(e) => { setDomain(e.target.value); setDomainError(""); }} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="notion.so" autoComplete="off" />
                {domainError && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4, fontWeight: 600 }}>{domainError}</div>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleCreate} disabled={creating} className="btn btn-primary" style={{ flex: 1 }}>{creating ? "Creating..." : "Create brand"}</button>
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
