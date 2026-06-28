"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { getBrands, createBrand, deleteBrand } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/ui/Sidebar";
import type { Brand } from "@/types";

export default function BrandsPage() {
  const { user } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [creating, setCreating] = useState(false);
  const [nameError, setNameError] = useState("");
  const [domainError, setDomainError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setError(null);
      const data = await getBrands();
      if (!controller.signal.aborted) setBrands(data);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    getBrands()
      .then((data) => { if (!controller.signal.aborted) { setBrands(data); setLoading(false); } })
      .catch((err) => { if (!controller.signal.aborted) { setError(err instanceof Error ? err.message : "Failed to load"); setLoading(false); } });
    return () => controller.abort();
  }, []);

  useEffect(() => { if (showNew) setTimeout(() => nameInputRef.current?.focus(), 50); }, [showNew]);

  useEffect(() => { if (!success) return; const t = setTimeout(() => setSuccess(null), 3000); return () => clearTimeout(t); }, [success]);

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
      setName(""); setDomain(""); setShowNew(false);
      setSuccess(`${name.trim()} created`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteBrand(id);
      setPendingDelete(null);
      setSuccess("Deleted");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page" style={{ display: "flex" }}>
      <Sidebar />
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)", padding: "0 var(--page-px)" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Link href="/" style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", textDecoration: "none" }}>
                llm<span style={{ background: "var(--primary)", padding: "0 4px", border: "2px solid var(--border)" }}>rank</span>
              </Link>
              <span style={{ color: "var(--text-muted)", fontSize: 12, fontWeight: 600 }}>/ brands</span>
            </div>
            {user && !showNew && (
              <button onClick={() => setShowNew(true)} className="btn btn-primary btn-sm">+ New brand</button>
            )}
          </div>
        </header>

        <div style={{ flex: 1, maxWidth: 600, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
          {error && (
            <div className="card" style={{ background: "#FEE2E2", borderColor: "var(--red)", padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#991B1B", fontWeight: 600 }}>{error}</span>
              <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#991B1B" }}>x</button>
            </div>
          )}
          {success && (
            <div className="card" style={{ background: "#DCFCE7", borderColor: "var(--green)", padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#166534", fontWeight: 600 }}>{success}</div>
          )}

          {showNew && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                <div>
                  <label htmlFor="brand-name" style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Brand name</label>
                  <input ref={nameInputRef} id="brand-name" className="input" value={name} onChange={(e) => { setName(e.target.value); setNameError(""); }} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="e.g. Notion" />
                  {nameError && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4, fontWeight: 600 }}>{nameError}</div>}
                </div>
                <div>
                  <label htmlFor="brand-domain" style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Domain</label>
                  <input id="brand-domain" className="input" value={domain} onChange={(e) => { setDomain(e.target.value); setDomainError(""); }} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="notion.so" />
                  {domainError && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4, fontWeight: 600 }}>{domainError}</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleCreate} disabled={creating} className="btn btn-primary">{creating ? "Creating..." : "Create"}</button>
                <button onClick={() => { setShowNew(false); setName(""); setDomain(""); }} className="btn btn-ghost">Cancel</button>
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 52 }} />)}
            </div>
          ) : brands.length === 0 && !showNew ? (
            <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 14, fontWeight: 600 }}>You haven&apos;t added any brands yet.</div>
              <button onClick={() => setShowNew(true)} className="btn btn-primary">Add your first brand</button>
            </div>
          ) : brands.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {brands.map((b) => (
                <div key={b.id} className="card" style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: "var(--radius)", background: "var(--primary)", border: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0, boxShadow: "var(--shadow-sm)" }}>
                    {b.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{b.domain}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    {pendingDelete === b.id ? (
                      <>
                        <button onClick={() => handleDelete(b.id)} disabled={deleting} className="btn btn-danger btn-sm">{deleting ? "..." : "Yes"}</button>
                        <button onClick={() => setPendingDelete(null)} className="btn btn-sm btn-ghost">No</button>
                      </>
                    ) : (
                      <>
                        <Link href={`/brands/${b.id}`} className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>Open</Link>
                        <button onClick={() => setPendingDelete(b.id)} className="btn btn-sm btn-ghost" style={{ color: "var(--red)" }}>Del</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
