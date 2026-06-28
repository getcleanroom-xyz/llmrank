"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { getBrands, createBrand, deleteBrand } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AuthButton } from "@/components/auth/AuthButton";
import type { Brand } from "@/types";

export default function HomePage() {
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
      .then((data) => {
        if (!controller.signal.aborted) {
          setBrands(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (showNew) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [showNew]);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(t);
  }, [success]);

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
    <main className="page" style={{ display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <nav style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)", padding: "0 var(--page-px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 48, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", textDecoration: "none" }}>
            llm<span style={{ background: "var(--primary)", padding: "0 4px", border: "2px solid var(--border)" }}>rank</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user && (
              <Link href="/brands" className="btn btn-ghost btn-sm">Dashboard</Link>
            )}
            <AuthButton />
          </div>
        </div>
      </nav>

      <div style={{ flex: 1, maxWidth: 720, margin: "0 auto", padding: "0 var(--page-px)", width: "100%" }}>

        {/* Hero */}
        <header style={{ paddingTop: "clamp(40px, 10vh, 80px)", paddingBottom: 32 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>AI SEO Visibility Tracking</div>
          <h1 style={{ fontSize: "clamp(28px, 6vw, 48px)", fontWeight: 800, color: "var(--text)", margin: "0 0 12px", lineHeight: 1.1, letterSpacing: "-0.03em" }}>
            How dey see your brand
            <br />
            for inside <span style={{ background: "var(--primary)", padding: "0 4px", border: "2px solid var(--border)", display: "inline-block" }}>ChatGPT?</span>
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: "0 0 20px", lineHeight: 1.6, maxWidth: 540 }}>
            You know say people dey ask ChatGPT, Gemini, Claude about your product every day?
            But you no know wetin dem dey hear. LLMRank show you exactly how AI models dey rank your brand — and how to rank better.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link
              href={user ? "/brands" : "#"}
              onClick={(e) => {
                if (!user) {
                  e.preventDefault();
                  document.querySelector<HTMLButtonElement>("[data-auth-trigger]")?.click();
                }
              }}
              className="btn btn-primary"
            >
              Start tracking for free
            </Link>
            <a href="#how-it-works" className="btn btn-ghost">See how it works</a>
          </div>
          <button data-auth-trigger className="hidden" />
        </header>

        {/* Supported models */}
        <section style={{ paddingBottom: 24, borderBottom: "2px solid var(--border)", marginBottom: 24 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Supported LLMs</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["ChatGPT", "Gemini", "Claude", "Llama", "DeepSeek", "Mistral", "Qwen"].map((llm) => (
              <span key={llm} className="pill pill-neu">{llm}</span>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" style={{ paddingBottom: 32 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>How e dey work?</div>
          <div className="grid-3">
            {[
              { step: "1", title: "Add your brand", desc: "Put your brand name and domain. That's all." },
              { step: "2", title: "We fire the queries", desc: "Ask ChatGPT, Gemini, Claude and others the questions your customers dey ask." },
              { step: "3", title: "See your ranking", desc: "See exactly how each AI model dey rank you. Who dey mention you? Where you dey appear?" },
            ].map((item) => (
              <div key={item.step} className="card">
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--primary)", marginBottom: 8 }}>{item.step}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section style={{ paddingBottom: 32 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>Wetin you go see inside?</div>
          <div className="grid-2">
            {[
              { title: "Visibility Score", desc: "One number wey tell you how visible you be across all AI models." },
              { title: "LLM Breakdown", desc: "See how each AI model dey see you separately." },
              { title: "Competitor Share", desc: "See who dey steal your spotlight." },
              { title: "Per-Query Drilldown", desc: "Click any question see the exact response each AI give." },
              { title: "AI Suggestions", desc: "We go suggest the right questions to track." },
              { title: "Actionable Insights", desc: "We go tell you wetin to do based on your actual gaps." },
            ].map((feature) => (
              <div key={feature.title} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{feature.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>{feature.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ paddingBottom: 40, textAlign: "center" }}>
          <div className="card" style={{ padding: "32px 24px" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Make AI dey talk about you
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 16, maxWidth: 400, margin: "0 auto 16px" }}>
              Join the people wey don dey track their AI visibility. Free to start. No credit card. No wahala.
            </p>
            <Link
              href={user ? "/brands" : "#"}
              onClick={(e) => {
                if (!user) {
                  e.preventDefault();
                  document.querySelector<HTMLButtonElement>("[data-auth-trigger]")?.click();
                }
              }}
              className="btn btn-primary"
            >
              Start tracking now
            </Link>
          </div>
        </section>

        {/* Dashboard preview for logged in users */}
        {user && (
          <section style={{ paddingBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="section-label">Your brands</div>
              {!showNew && (
                <button onClick={() => setShowNew(true)} className="btn btn-primary btn-sm">+ Add</button>
              )}
            </div>

            {error && (
              <div className="card" style={{ background: "#FEE2E2", borderColor: "var(--red)", padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#991B1B", fontWeight: 600 }}>{error}</span>
                <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#991B1B" }}>x</button>
              </div>
            )}
            {success && (
              <div className="card" style={{ background: "#DCFCE7", borderColor: "var(--green)", padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#166534", fontWeight: 600 }}>
                {success}
              </div>
            )}

            {showNew && (
              <div className="card" style={{ marginBottom: 12 }}>
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
                  <button onClick={handleCreate} disabled={creating} className="btn btn-primary">
                    {creating ? "Creating..." : "Create"}
                  </button>
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
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 14, fontWeight: 600 }}>No brands yet</div>
                <button onClick={() => setShowNew(true)} className="btn btn-primary">Add your first brand</button>
              </div>
            ) : brands.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
          </section>
        )}
      </div>

      <footer style={{ padding: "16px var(--page-px)", borderTop: "2px solid var(--border)", marginTop: "auto", fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textAlign: "center" }}>
        llm<span style={{ color: "var(--primary)" }}>rank</span> — AI SEO visibility tracking
      </footer>
    </main>
  );
}
