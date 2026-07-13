"use client";

import { useState } from "react";

interface BrandWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string, domain: string, competitors: string[]) => void;
  creating?: boolean;
}

export function BrandWizard({ open, onClose, onCreated, creating }: BrandWizardProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [domainErr, setDomainErr] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [compInput, setCompInput] = useState("");

  if (!open) return null;

  const handleNext = () => {
    let valid = true;
    if (!name.trim()) { setNameErr("Required"); valid = false; } else setNameErr("");
    if (!domain.trim()) { setDomainErr("Required"); valid = false; }
    else if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain.trim())) { setDomainErr("Invalid"); valid = false; }
    else setDomainErr("");
    if (valid) setStep(2);
  };

  const addComp = (c: string) => {
    const trimmed = c.trim();
    if (trimmed && !competitors.includes(trimmed) && trimmed.toLowerCase() !== name.trim().toLowerCase()) {
      setCompetitors([...competitors, trimmed]);
    }
    setCompInput("");
  };

  const removeComp = (c: string) => setCompetitors(competitors.filter((x) => x !== c));

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} onClick={onClose} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} />
      <div className="card" style={{ position: "relative", width: "100%", maxWidth: 440, margin: "0 16px", padding: 24, zIndex: 10 }}>

        {step === 1 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div className="section-label">New brand</div>
              <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">x</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Brand name</label>
                <input className="input" value={name} onChange={(e) => { setName(e.target.value); setNameErr(""); }} onKeyDown={(e) => e.key === "Enter" && handleNext()} placeholder="e.g. OpenAI" autoComplete="off" />
                {nameErr && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4, fontWeight: 600 }}>{nameErr}</div>}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Domain</label>
                <input className="input" value={domain} onChange={(e) => { setDomain(e.target.value); setDomainErr(""); }} onKeyDown={(e) => e.key === "Enter" && handleNext()} placeholder="openai.com" autoComplete="off" />
                {domainErr && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4, fontWeight: 600 }}>{domainErr}</div>}
              </div>
            </div>
            <button onClick={handleNext} className="btn btn-primary" style={{ width: "100%" }}>Next</button>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Who competes with {name}?</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>This helps generate better queries</div>
              </div>
              <button onClick={() => setStep(1)} className="btn btn-ghost btn-sm">Back</button>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <input className="input" value={compInput} onChange={(e) => setCompInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComp(compInput)} placeholder="Type a competitor name..." style={{ flex: 1, fontSize: 13 }} />
              <button onClick={() => addComp(compInput)} className="btn btn-sm">Add</button>
            </div>

            {competitors.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
                {competitors.map((c) => (
                  <span key={c} className="pill" style={{ fontSize: 11, gap: 4, background: "#FEE2E2", borderColor: "#991B1B", color: "#991B1B" }}>
                    {c}
                    <span onClick={() => removeComp(c)} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 2 }}>x</span>
                  </span>
                ))}
              </div>
            )}

            <button onClick={() => onCreated(name.trim(), domain.trim(), competitors)} disabled={creating} className="btn btn-primary" style={{ width: "100%" }}>
              {creating ? "Creating..." : `Create ${name || "brand"}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
