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
    <main className="min-h-screen bg-[#08090A]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#08090A]/80 backdrop-blur-xl border-b border-[#1A1A1A]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-tight text-white">
            llm<span className="text-[#FFD600]">rank</span>
          </Link>
          <div className="flex items-center gap-4">
            {user && (
              <Link
                href="/brands"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
            )}
            <AuthButton />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFD600]/10 border border-[#FFD600]/20 rounded-full text-[#FFD600] text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-[#FFD600] rounded-full animate-pulse" />
            AI SEO visibility tracking
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
            How dey see your brand
            <br />
            <span className="text-[#FFD600]">for inside ChatGPT?</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            You know say people dey ask ChatGPT, Gemini, Claude about your product every day?
            But you no know wetin dem dey hear. LLMRank show you exactly how AI models dey rank your brand — and how to rank better.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={user ? "/brands" : "#"}
              onClick={(e) => {
                if (!user) {
                  e.preventDefault();
                  document.querySelector<HTMLButtonElement>("[data-auth-trigger]")?.click();
                }
              }}
              className="px-8 py-4 bg-[#FFD600] text-black font-bold text-lg rounded-xl hover:bg-[#FFC000] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Start tracking for free
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 bg-[#141414] border-2 border-[#222] text-white font-bold text-lg rounded-xl hover:border-[#FFD600]/50 transition-all"
            >
              See how it works
            </a>
          </div>

          {/* Hidden auth trigger */}
          <button data-auth-trigger className="hidden" />
        </div>
      </section>

      {/* Social proof */}
      <section className="py-12 border-y border-[#1A1A1A]">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-center text-sm text-gray-500 mb-8">
            Trusted by brands who know say AI visibility na the new SEO
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-gray-600 text-sm font-medium">
            <span>ChatGPT</span>
            <span>Gemini</span>
            <span>Claude</span>
            <span>Llama</span>
            <span>DeepSeek</span>
            <span>Mistral</span>
            <span>Qwen</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-4">
            How e dey work?
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
            Three steps. No wahala. You go see wetin AI models dey tell people about your brand.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Add your brand",
                desc: "Just put your brand name and domain. That's all. We go handle the rest.",
                color: "#FFD600",
              },
              {
                step: "02",
                title: "We fire the queries",
                desc: "We go ask ChatGPT, Gemini, Claude and others the questions your customers dey ask. All at the same time.",
                color: "#22C55E",
              },
              {
                step: "03",
                title: "See your ranking",
                desc: "You go see exactly how each AI model dey rank you. Who dey mention you? Where you dey appear? Wetin dem dey say about you?",
                color: "#3B82F6",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="p-8 bg-[#0D0D0D] border border-[#1A1A1A] rounded-2xl hover:border-[#333] transition-colors group"
              >
                <div
                  className="text-5xl font-black mb-4 opacity-20 group-hover:opacity-40 transition-opacity"
                  style={{ color: item.color }}
                >
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                <p className="text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-[#0A0A0A]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-white text-center mb-4">
            Wetin you go see inside?
          </h2>
          <p className="text-gray-400 text-center mb-16 max-w-xl mx-auto">
            Everything you need to know about your AI visibility. No missing details.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "Visibility Score",
                desc: "One number wey tell you how visible you be across all AI models. From 0 to 100.",
                icon: "01",
              },
              {
                title: "LLM Breakdown",
                desc: "See how each AI model dey see you separately. ChatGPT fit rate you high, but Claude fit ignore you.",
                icon: "02",
              },
              {
                title: "Competitor Share",
                desc: "See who dey steal your spotlight. Which competitors AI models dey recommend instead of you.",
                icon: "03",
              },
              {
                title: "Per-Query Drilldown",
                desc: "Click any question see the exact response each AI give. With annotations showing where you appear.",
                icon: "04",
              },
              {
                title: "AI Suggestions",
                desc: "We go suggest the right questions to track based on your industry and competitors.",
                icon: "05",
              },
              {
                title: "Actionable Insights",
                desc: "No just data — we go tell you wetin to do. Specific advice based on your actual gaps.",
                icon: "06",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="p-6 bg-[#141414] border border-[#222] rounded-xl hover:border-[#FFD600]/30 transition-colors"
              >
                <div className="text-xs font-bold text-[#FFD600] mb-3">{feature.icon}</div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">
            Make AI dey talk about you
            <br />
            <span className="text-[#FFD600]">the way you wan hear</span>
          </h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
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
            className="inline-block px-10 py-5 bg-[#FFD600] text-black font-bold text-xl rounded-xl hover:bg-[#FFC000] transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Start tracking now
          </Link>
        </div>
      </section>

      {/* Dashboard preview for logged in users */}
      {user && (
        <section className="py-20 px-6 border-t border-[#1A1A1A]">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white">Your brands</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {brands.length} brand{brands.length !== 1 ? "s" : ""} wey you dey track
                </p>
              </div>
              {!showNew && (
                <button
                  onClick={() => setShowNew(true)}
                  className="px-4 py-2 bg-[#FFD600] text-black font-bold text-sm rounded-lg hover:bg-[#FFC000] transition-colors"
                >
                  + Add brand
                </button>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-6 flex justify-between items-center">
                <span className="text-red-400 text-sm">{error}</span>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">x</button>
              </div>
            )}
            {success && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl mb-6 text-green-400 text-sm">
                {success}
              </div>
            )}

            {showNew && (
              <div className="p-6 bg-[#141414] border border-[#222] rounded-xl mb-6">
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 font-medium">Brand name</label>
                    <input
                      ref={nameInputRef}
                      value={name}
                      onChange={(e) => { setName(e.target.value); setNameError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                      className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#333] rounded-lg text-white focus:border-[#FFD600] focus:outline-none"
                      placeholder="e.g. Notion"
                    />
                    {nameError && <p className="text-xs text-red-400 mt-1">{nameError}</p>}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1 font-medium">Domain</label>
                    <input
                      value={domain}
                      onChange={(e) => { setDomain(e.target.value); setDomainError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                      className="w-full px-4 py-3 bg-[#0A0A0A] border border-[#333] rounded-lg text-white focus:border-[#FFD600] focus:outline-none"
                      placeholder="notion.so"
                    />
                    {domainError && <p className="text-xs text-red-400 mt-1">{domainError}</p>}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCreate}
                    disabled={creating}
                    className="px-5 py-2.5 bg-[#FFD600] text-black font-bold text-sm rounded-lg hover:bg-[#FFC000] transition-colors disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                  <button
                    onClick={() => { setShowNew(false); setName(""); setDomain(""); }}
                    className="px-5 py-2.5 bg-[#1A1A1A] text-gray-400 text-sm rounded-lg hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-[#141414] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : brands.length === 0 && !showNew ? (
              <div className="text-center py-16 bg-[#141414] border border-[#222] rounded-xl">
                <p className="text-gray-400 mb-4">You never add any brand yet</p>
                <button
                  onClick={() => setShowNew(true)}
                  className="px-6 py-3 bg-[#FFD600] text-black font-bold rounded-lg hover:bg-[#FFC000] transition-colors"
                >
                  Add your first brand
                </button>
              </div>
            ) : brands.length > 0 ? (
              <div className="space-y-3">
                {brands.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 bg-[#141414] border border-[#222] rounded-xl flex items-center gap-4 hover:border-[#333] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#FFD600] flex items-center justify-center text-sm font-bold text-black shrink-0">
                      {b.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">{b.name}</div>
                      <div className="text-xs text-gray-500">{b.domain}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {pendingDelete === b.id ? (
                        <>
                          <button
                            onClick={() => handleDelete(b.id)}
                            disabled={deleting}
                            className="px-3 py-1.5 bg-red-500/10 text-red-400 text-xs font-bold rounded-lg hover:bg-red-500/20 transition-colors"
                          >
                            {deleting ? "..." : "Yes, delete"}
                          </button>
                          <button
                            onClick={() => setPendingDelete(null)}
                            className="px-3 py-1.5 text-gray-500 text-xs hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            href={`/brands/${b.id}`}
                            className="px-4 py-1.5 bg-[#FFD600] text-black text-xs font-bold rounded-lg hover:bg-[#FFC000] transition-colors"
                          >
                            Open
                          </Link>
                          <button
                            onClick={() => setPendingDelete(b.id)}
                            className="px-3 py-1.5 text-gray-600 text-xs hover:text-red-400 transition-colors"
                          >
                            Del
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[#1A1A1A]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500 font-medium">
            llm<span className="text-[#FFD600]">rank</span> — AI SEO visibility tracking
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <a href="https://www.buymeacoffee.com/llmrank" target="_blank" rel="noopener noreferrer" className="hover:text-[#FFD600] transition-colors">
              Support us
            </a>
            <a href="/docs" className="hover:text-white transition-colors">
              API Docs
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
