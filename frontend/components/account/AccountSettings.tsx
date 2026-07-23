"use client";

import { useReducer, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { AppHeader } from "@/components/AppHeader";
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

export function AccountSettings() {
  const { user } = useAuth();
  const router = useRouter();
  const [state, dispatch] = useReducer(accountReducer, initialState);
  const { addToast } = useToast();

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
    <div className="page" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppHeader
        breadcrumb={
          <span style={{ fontWeight: 600 }}>
            <Link href="/brands" style={{ color: "var(--text-secondary)", textDecoration: "none", fontWeight: 400 }}>
              Dashboard
            </Link>
            <span style={{ margin: "0 6px", color: "var(--text-muted)" }}>/</span>
            Account
          </span>
        }
      />

      <div style={{ flex: 1, maxWidth: 560, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        <div className="card" style={{ padding: "16px 20px", marginBottom: "var(--gap)" }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Account</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "var(--radius)",
              background: "var(--primary)", border: "2px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, fontWeight: 800,
            }}>
              {user.display_name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{user.display_name}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user.email}</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="section-label">Passkeys</div>
            <button
              onClick={handleAddPasskey}
              disabled={state.adding}
              className="btn btn-sm btn-primary"
            >
              {state.adding ? "Adding..." : "+ Add passkey"}
            </button>
          </div>

          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>
            Passkeys let you sign in with your fingerprint, Face ID, or security key — no password needed.
          </div>

          {state.loading ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "12px 0" }}>Loading...</div>
          ) : state.passkeys.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "12px 0" }}>
              No passkeys registered. Add one above for passwordless sign-in.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {state.passkeys.map((pk) => (
                <div
                  key={pk.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "var(--bg-dark)",
                    borderRadius: "var(--radius)",
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
                    style={{ color: "var(--red)", fontSize: 11 }}
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
    </div>
  );
}
