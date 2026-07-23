"use client";

import { useReducer } from "react";

interface BrandWizardProps {
  open: boolean;
  onClose: () => void;
  onCreated: (name: string, domain: string, competitors: string[]) => void;
  creating?: boolean;
}

interface State {
  step: number;
  name: string;
  domain: string;
  nameErr: string;
  domainErr: string;
  competitors: string[];
  compInput: string;
}

type Action =
  | { type: "SET_STEP"; value: number }
  | { type: "SET_NAME"; value: string }
  | { type: "SET_DOMAIN"; value: string }
  | { type: "SET_NAME_ERR"; value: string }
  | { type: "SET_DOMAIN_ERR"; value: string }
  | { type: "SET_COMPETITORS"; value: string[] }
  | { type: "SET_COMPINPUT"; value: string }
  | { type: "ADD_COMPETITOR"; competitor: string; name: string }
  | { type: "REMOVE_COMPETITOR"; competitor: string }
  | { type: "RESET_ERRORS" };

const initialState: State = {
  step: 1,
  name: "",
  domain: "",
  nameErr: "",
  domainErr: "",
  competitors: [],
  compInput: "",
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.value };
    case "SET_NAME":
      return { ...state, name: action.value };
    case "SET_DOMAIN":
      return { ...state, domain: action.value };
    case "SET_NAME_ERR":
      return { ...state, nameErr: action.value };
    case "SET_DOMAIN_ERR":
      return { ...state, domainErr: action.value };
    case "SET_COMPETITORS":
      return { ...state, competitors: action.value };
    case "SET_COMPINPUT":
      return { ...state, compInput: action.value };
    case "ADD_COMPETITOR": {
      const trimmed = action.competitor.trim();
      if (trimmed && !state.competitors.includes(trimmed) && trimmed.toLowerCase() !== action.name.trim().toLowerCase()) {
        return { ...state, competitors: [...state.competitors, trimmed], compInput: "" };
      }
      return { ...state, compInput: "" };
    }
    case "REMOVE_COMPETITOR":
      return { ...state, competitors: state.competitors.filter((x) => x !== action.competitor) };
    case "RESET_ERRORS":
      return { ...state, nameErr: "", domainErr: "" };
  }
}

export function BrandWizard({ open, onClose, onCreated, creating }: BrandWizardProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const set = (field: keyof State) => (value: State[keyof State]) =>
    dispatch({ type: `SET_${field.toUpperCase()}` as Action["type"], value } as Action);

  if (!open) return null;

  const handleNext = () => {
    let valid = true;
    if (!state.name.trim()) { dispatch({ type: "SET_NAME_ERR", value: "Required" }); valid = false; }
    if (!state.domain.trim()) { dispatch({ type: "SET_DOMAIN_ERR", value: "Required" }); valid = false; }
    else if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(state.domain.trim())) { dispatch({ type: "SET_DOMAIN_ERR", value: "Invalid" }); valid = false; }
    if (valid) dispatch({ type: "SET_STEP", value: 2 });
  };

  const addComp = (c: string) => dispatch({ type: "ADD_COMPETITOR", competitor: c, name: state.name });

  const removeComp = (c: string) => dispatch({ type: "REMOVE_COMPETITOR", competitor: c });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} onClick={onClose} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} />
      <div className="card" style={{ position: "relative", width: "100%", maxWidth: 440, margin: "0 16px", padding: 24, zIndex: 10 }}>

        {state.step === 1 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div className="section-label">New brand</div>
              <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">x</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Brand name</label>
                <input className="input" value={state.name} onChange={(e) => { set("name")(e.target.value); dispatch({ type: "SET_NAME_ERR", value: "" }); }} onKeyDown={(e) => e.key === "Enter" && handleNext()} placeholder="e.g. OpenAI" autoComplete="off" />
                {state.nameErr && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4, fontWeight: 600 }}>{state.nameErr}</div>}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Domain</label>
                <input className="input" value={state.domain} onChange={(e) => { set("domain")(e.target.value); dispatch({ type: "SET_DOMAIN_ERR", value: "" }); }} onKeyDown={(e) => e.key === "Enter" && handleNext()} placeholder="openai.com" autoComplete="off" />
                {state.domainErr && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 4, fontWeight: 600 }}>{state.domainErr}</div>}
              </div>
            </div>
            <button onClick={handleNext} className="btn btn-primary" style={{ width: "100%" }}>Next</button>
          </>
        )}

        {state.step === 2 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Who competes with {state.name}?</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>This helps generate better queries</div>
              </div>
              <button onClick={() => dispatch({ type: "SET_STEP", value: 1 })} className="btn btn-ghost btn-sm">Back</button>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <input className="input" value={state.compInput} onChange={(e) => set("compInput")(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComp(state.compInput)} placeholder="Type a competitor name..." style={{ flex: 1, fontSize: 13 }} />
              <button onClick={() => addComp(state.compInput)} className="btn btn-sm">Add</button>
            </div>

            {state.competitors.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 14 }}>
                {state.competitors.map((c) => (
                  <span key={c} className="pill" style={{ fontSize: 11, gap: 4, background: "#FEE2E2", borderColor: "#991B1B", color: "#991B1B" }}>
                    {c}
                    <span onClick={() => removeComp(c)} style={{ cursor: "pointer", fontWeight: 700, marginLeft: 2 }}>x</span>
                  </span>
                ))}
              </div>
            )}

            <button onClick={() => onCreated(state.name.trim(), state.domain.trim(), state.competitors)} disabled={creating} className="btn btn-primary" style={{ width: "100%" }}>
              {creating ? "Creating..." : `Create ${state.name || "brand"}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
