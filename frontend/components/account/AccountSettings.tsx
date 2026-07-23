"use client";

import { useReducer, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useCredits } from "@/lib/hooks";
import { useToast } from "@/components/ui/Toast";
import { BuyCreditsModal } from "@/components/BuyCreditsModal";
import {
  authListPasskeys,
  authDeletePasskey,
  authAddPasskeyStart,
  authAddPasskeyFinish,
} from "@/lib/api";

interface Passkey {
  id: string;
  device_name: string;
  created_at: string;
  last_used_at: string;
}

interface AccountState {
  passkeys: Passkey[];
  loading: boolean;
  adding: boolean;
  deleting: string | null;
}

type AccountAction =
  | { type: "SET_PASSKEYS"; passkeys: Passkey[] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ADDING"; adding: boolean }
  | { type: "SET_DELETING"; deleting: string | null };

const initialState: AccountState = {
  passkeys: [],
  loading: true,
  adding: false,
  deleting: null,
};

function accountReducer(state: AccountState, action: AccountAction): AccountState {
  switch (action.type) {
    case "SET_PASSKEYS":
      return { ...state, passkeys: action.passkeys };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ADDING":
      return { ...state, adding: action.adding };
    case "SET_DELETING":
      return { ...state, deleting: action.deleting };
    default:
      return state;
  }
}

function getDeviceName(): string {
  const ua = navigator.userAgent;
  if (ua.includes("Mac")) return "Mac";
  if (ua.includes("Windows")) return "Windows PC";
  if (ua.includes("Linux")) return "Linux PC";
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("Android")) return "Android";
  return "Unknown device";
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function PushPin({ color = "#EF4444" }: { color?: string }) {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" style={{ position: "absolute", top: -10, left: 16, zIndex: 2 }}>
      <ellipse cx="9" cy="4.5" rx="4.5" ry="4.5" fill={color} stroke="#1A1A1A" strokeWidth="1.5" />
      <rect x="7" y="9" width="4" height="7" rx="1" fill={color === "#EF4444" ? "#DC2626" : color} stroke="#1A1A1A" strokeWidth="1.5" />
    </svg>
  );
}

function Scribble({ color = "var(--primary)", width = "60px", style }: { color?: string; width?: string; style?: React.CSSProperties }) {
  return (
    <svg width={width} height="6" viewBox="0 0 60 6" preserveAspectRatio="none" style={{ display: "block", ...style }}>
      <path d="M0 3 Q5 0 10 4 Q15 6 20 2 Q25 0 30 4 Q35 6 40 2 Q45 0 50 3 Q55 5 60 2" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function AccountSettings() {
  const { user } = useAuth();
  const router = useRouter();
  const [state, dispatch] = useReducer(accountReducer, initialState);
  const { addToast } = useToast();
  const { data: credits } = useCredits();
  const [showBuyCredits, setShowBuyCredits] = useState(false);

  const loadPasskeys = async () => {
    try {
      dispatch({ type: "SET_LOADING", loading: true });
      const data = await authListPasskeys();
      dispatch({ type: "SET_PASSKEYS", passkeys: data });
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to load passkeys", "error");
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  };

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    loadPasskeys();
  }, [user, router]);

  const handleAddPasskey = async () => {
    dispatch({ type: "SET_ADDING", adding: true });
    try {
      const device_name = getDeviceName();
      const { challenge, rp_id, user_id } = await authAddPasskeyStart(device_name);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: base64urlToBuffer(challenge),
          rp: { name: "LLMRanked", id: rp_id },
          user: {
            id: new TextEncoder().encode(user_id),
            name: user!.email,
            displayName: user!.display_name,
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "required",
          },
          timeout: 60000,
        },
      });

      if (!credential) throw new Error("Passkey creation cancelled");

      const pkCredential = credential as PublicKeyCredential & {
        rawId: ArrayBuffer;
        response: AuthenticatorAttestationResponse;
        authenticatorAttachment: string;
      };

      const cred = {
        id: credential.id,
        rawId: bufferToBase64url(pkCredential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64url(pkCredential.response.clientDataJSON),
          attestationObject: bufferToBase64url(pkCredential.response.attestationObject),
        },
        authenticatorAttachment: pkCredential.authenticatorAttachment,
        user_id: user_id,
      };

      await authAddPasskeyFinish(cred, device_name);
      addToast(`Passkey "${device_name}" added successfully`, "success");
      await loadPasskeys();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add passkey";
      addToast(msg.includes("cancelled") ? "Setup cancelled." : msg, "error");
    } finally {
      dispatch({ type: "SET_ADDING", adding: false });
    }
  };

  const handleDeletePasskey = async (id: string) => {
    dispatch({ type: "SET_DELETING", deleting: id });
    try {
      await authDeletePasskey(id);
      addToast("Passkey removed", "success");
      await loadPasskeys();
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to delete passkey", "error");
    } finally {
      dispatch({ type: "SET_DELETING", deleting: null });
    }
  };

  if (!user) return null;

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      {/* Decorative squiggles */}
      <svg width="100" height="35" viewBox="0 0 100 35" fill="none" style={{ position: "absolute", top: 60, right: 40, opacity: 0.12, pointerEvents: "none" }}>
        <path d="M0 18 Q12 4 25 20 Q38 32 50 14 Q62 2 75 18 Q88 30 100 12" stroke="#3B82F6" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
      <svg width="70" height="25" viewBox="0 0 70 25" fill="none" style={{ position: "absolute", top: 140, left: 30, opacity: 0.1, pointerEvents: "none" }}>
        <path d="M0 12 Q8 3 16 14 Q24 22 32 10 Q40 2 48 13 Q56 20 70 8" stroke="#22C55E" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>

      <div style={{ flex: 1, maxWidth: 560, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {/* Back link */}
        <Link href="/brands" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 20, border: "1.5px solid var(--border)", padding: "4px 10px", borderRadius: "var(--radius)", background: "var(--surface)" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Dashboard
        </Link>

        {/* Account header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: "clamp(28px, 5vw, 36px)", fontWeight: 700, margin: "0 0 4px", lineHeight: 1, transform: "rotate(-0.4deg)" }}>
            Account
          </h1>
          <Scribble color="var(--primary)" width="80px" />
        </div>

        {/* Credits card */}
        <div style={{ position: "relative", background: "#FFF9DB", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "4px 4px 0 #1A1A1A", padding: "20px 22px", marginBottom: 20, transform: "rotate(-0.3deg)" }}>
          <PushPin />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Credits</div>
              <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, color: "var(--text)" }}>
                {credits?.balance?.toLocaleString() ?? "0"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, fontFamily: "var(--font-serif), Georgia, serif" }}>
                credits available &middot; 1 credit = $0.001
              </div>
            </div>
            <button onClick={() => setShowBuyCredits(true)} className="btn btn-primary" style={{ fontSize: 13, padding: "8px 18px" }}>
              Buy credits
            </button>
          </div>
          <Scribble color="var(--primary)" width="40px" style={{ position: "absolute", bottom: 10, right: 20, opacity: 0.4 }} />
        </div>

        {/* Profile card */}
        <div style={{ position: "relative", background: "#DBEAFF", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "4px 4px 0 #1A1A1A", padding: "20px 22px", marginBottom: 20, transform: "rotate(0.2deg)" }}>
          <PushPin color="#3B82F6" />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
            <div style={{
              width: 52, height: 52, borderRadius: "var(--radius)",
              background: "var(--primary)", border: "2px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 800, boxShadow: "2px 2px 0 #1A1A1A",
            }}>
              {user.display_name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{user.display_name}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-serif), Georgia, serif" }}>{user.email}</div>
            </div>
          </div>
        </div>

        {/* Passkeys card */}
        <div style={{ position: "relative", background: "#E6F9ED", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "4px 4px 0 #1A1A1A", padding: "20px 22px", transform: "rotate(-0.2deg)" }}>
          <PushPin color="#22C55E" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Passkeys</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font-serif), Georgia, serif" }}>
                Sign in with fingerprint, Face ID, or security key
              </div>
            </div>
            <button
              onClick={handleAddPasskey}
              disabled={state.adding}
              className="btn btn-sm btn-primary"
            >
              {state.adding ? "Adding..." : "+ Add"}
            </button>
          </div>

          {state.loading ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0" }}>Loading...</div>
          ) : state.passkeys.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "12px 0", borderTop: "1px dashed #C8C4BC", marginTop: 8 }}>
              No passkeys registered yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px dashed #C8C4BC", marginTop: 10, paddingTop: 10 }}>
              {state.passkeys.map((pk) => (
                <div
                  key={pk.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.5)",
                    border: "1.5px solid var(--border)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{pk.device_name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Added {new Date(pk.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {pk.last_used_at && ` · Last used ${new Date(pk.last_used_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePasskey(pk.id)}
                    disabled={state.deleting === pk.id || state.passkeys.length <= 1}
                    className="btn btn-sm btn-ghost"
                    style={{ color: "var(--red)", fontSize: 12 }}
                    title={state.passkeys.length <= 1 ? "Can't delete your last passkey" : "Remove passkey"}
                  >
                    {state.deleting === pk.id ? "..." : "Remove"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BuyCreditsModal open={showBuyCredits} onClose={() => setShowBuyCredits(false)} />
    </div>
  );
}
