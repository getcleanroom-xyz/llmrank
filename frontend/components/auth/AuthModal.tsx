"use client";

import { useReducer, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  authRegisterStart,
  authRegisterFinish,
  authLoginStart,
  authLoginFinish,
  authEmailRegister,
  authEmailLogin,
  authRecover,
  authRecoverFinish,
  authLogout,
} from "@/lib/api";

type AuthMethod = "passkey" | "email";
type AuthView = "auth" | "recover-request" | "recover-verify";
type AuthStep = "form" | "confirm";

interface AuthState {
  mode: "login" | "register";
  method: AuthMethod;
  view: AuthView;
  step: AuthStep;
  email: string;
  displayName: string;
  password: string;
  deviceName: string;
  recoverCode: string;
  recoverMessage: string;
  loading: boolean;
  error: string;
}

type AuthAction =
  | { type: "RESET"; mode: "login" | "register" }
  | { type: "SET_MODE"; mode: "login" | "register" }
  | { type: "SET_METHOD"; method: AuthMethod }
  | { type: "SET_VIEW"; view: AuthView }
  | { type: "SET_STEP"; step: AuthStep }
  | { type: "SET_FIELD"; field: string; value: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_RECOVER_MESSAGE"; message: string }
  | { type: "GO_BACK_TO_AUTH" };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "RESET":
      return { ...initialState, mode: action.mode };
    case "SET_MODE":
      return { ...state, mode: action.mode, step: "form", error: "" };
    case "SET_METHOD":
      return { ...state, method: action.method, step: "form", error: "" };
    case "SET_VIEW":
      return { ...state, view: action.view, error: "" };
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error, loading: false };
    case "SET_RECOVER_MESSAGE":
      return { ...state, recoverMessage: action.message };
    case "GO_BACK_TO_AUTH":
      return { ...state, view: "auth", error: "", loading: false };
    default:
      return state;
  }
}

const initialState: AuthState = {
  mode: "login",
  method: "passkey",
  view: "auth",
  step: "form",
  email: "",
  displayName: "",
  password: "",
  deviceName: "",
  recoverCode: "",
  recoverMessage: "",
  loading: false,
  error: "",
};

export function AuthModal() {
  const { user, setUser, closeAuthModal, authModalOpen, authModalMode } = useAuth();
  const [state, dispatch] = useReducer(authReducer, { ...initialState, mode: authModalMode });

  useEffect(() => {
    dispatch({ type: "RESET", mode: authModalMode });
  }, [authModalMode]);

  if (!authModalOpen) return null;

  const set = (field: string, value: string) => dispatch({ type: "SET_FIELD", field, value });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: "" });

    if (state.method === "passkey") {
      if (state.step === "form") {
        dispatch({ type: "SET_STEP", step: "confirm" });
        return;
      }
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const { challenge, rp_id, user_id } = await authRegisterStart(state.email, state.displayName);
        const device = state.deviceName || getDeviceName();
        const credential = await createPasskeyCredential(challenge, rp_id, user_id, state.email, state.displayName);
        const result = await authRegisterFinish(credential, device);
        setUser(result.user);
        closeAuthModal();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Registration failed";
        dispatch({
          type: "SET_ERROR",
          error: msg.includes("cancelled")
            ? "Setup cancelled. No worries — you can try again whenever you're ready."
            : msg,
        });
        dispatch({ type: "SET_STEP", step: "form" });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    } else {
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const result = await authEmailRegister(state.email, state.displayName, state.password);
        setUser(result.user);
        closeAuthModal();
      } catch (err) {
        dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Registration failed" });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: "" });
    dispatch({ type: "SET_LOADING", loading: true });

    try {
      if (state.method === "passkey") {
        const { challenge, rp_id, allow_credentials } = await authLoginStart(state.email);
        const credential = await getPasskeyCredential(challenge, rp_id, allow_credentials);
        const result = await authLoginFinish(credential);
        setUser(result.user);
        closeAuthModal();
      } else {
        const result = await authEmailLogin(state.email, state.password);
        setUser(result.user);
        closeAuthModal();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      dispatch({
        type: "SET_ERROR",
        error: msg.includes("cancelled") ? "Sign-in cancelled. Try again when you're ready." : msg,
      });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  };

  const handleLogout = async () => {
    try {
      await authLogout();
    } catch {
      // Continue with local logout even if server call fails
    }
    setUser(null);
    closeAuthModal();
  };

  const handleRecoverRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: "" });
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const result = await authRecover(state.email);
      dispatch({ type: "SET_RECOVER_MESSAGE", message: result.message });
      dispatch({ type: "SET_VIEW", view: "recover-verify" });
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Failed to send recovery code" });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  };

  const handleRecoverFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", error: "" });
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const result = await authRecoverFinish(state.email, state.recoverCode, state.password, state.displayName || undefined);
      setUser(result.user);
      closeAuthModal();
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Recovery failed" });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} onClick={closeAuthModal} onKeyDown={(e) => { if (e.key === "Escape") closeAuthModal(); }} />

      <div className="card" style={{ position: "relative", width: "100%", maxWidth: 400, margin: "0 16px", padding: 24, zIndex: 10 }}>
        {user ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <button onClick={closeAuthModal} className="btn btn-ghost btn-sm" aria-label="Close" style={{ position: "absolute", top: 12, right: 12 }}>x</button>
            <div style={{ width: 48, height: 48, borderRadius: "var(--radius)", background: "var(--primary)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{user.display_name}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user.email}</div>
            </div>
            <button onClick={handleLogout} className="btn btn-ghost" style={{ width: "100%" }}>
              Sign out
            </button>
          </div>
        ) : state.view === "auth" ? (
          <>
            {/* Tab bar: Sign in / Create account */}
            <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
              <button
                onClick={() => dispatch({ type: "SET_MODE", mode: "login" })}
                className={`btn ${state.mode === "login" ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1 }}
              >
                Sign in
              </button>
              <button
                onClick={() => dispatch({ type: "SET_MODE", mode: "register" })}
                className={`btn ${state.mode === "register" ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1 }}
              >
                Create account
              </button>
            </div>

            {/* Method selector */}
            <div style={{ display: "flex", gap: 4, marginBottom: 14, background: "var(--bg-dark)", borderRadius: "var(--radius)", padding: 3 }}>
              <button
                onClick={() => dispatch({ type: "SET_METHOD", method: "passkey" })}
                style={{
                  flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 600, borderRadius: "calc(var(--radius) - 2px)",
                  border: "none", cursor: "pointer",
                  background: state.method === "passkey" ? "var(--surface)" : "transparent",
                  color: state.method === "passkey" ? "var(--text)" : "var(--text-muted)",
                  boxShadow: state.method === "passkey" ? "var(--shadow)" : "none",
                }}
              >
                Passkey
              </button>
              <button
                onClick={() => dispatch({ type: "SET_METHOD", method: "email" })}
                style={{
                  flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 600, borderRadius: "calc(var(--radius) - 2px)",
                  border: "none", cursor: "pointer",
                  background: state.method === "email" ? "var(--surface)" : "transparent",
                  color: state.method === "email" ? "var(--text)" : "var(--text-muted)",
                  boxShadow: state.method === "email" ? "var(--shadow)" : "none",
                }}
              >
                Email + password
              </button>
            </div>

            <form onSubmit={state.mode === "login" ? handleLogin : handleRegister}>
              {state.method === "passkey" && state.mode === "register" && state.step === "confirm" ? (
                <>
                  <div style={{ background: "#DBEAFF", border: "2px solid #3B82F6", borderRadius: "var(--radius)", padding: 14, marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF", marginBottom: 6 }}>What happens next</div>
                    <div style={{ fontSize: 12, color: "#1E3A5F", lineHeight: 1.5 }}>
                      Your browser will ask you to verify with your fingerprint, Face ID, or a security key.
                      This creates a passkey — a secure, password-free way to sign in.
                      You won&apos;t need to remember any password.
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
                    <strong>{state.email}</strong>
                    {state.displayName && <> &middot; {state.displayName}</>}
                  </div>

                  {state.error && (
                    <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 12, fontWeight: 600 }}>{state.error}</div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => dispatch({ type: "SET_STEP", step: "form" })} className="btn btn-ghost" style={{ flex: 1 }}>
                      Back
                    </button>
                    <button type="submit" disabled={state.loading} className="btn btn-primary" style={{ flex: 2 }}>
                      {state.loading ? "Creating passkey..." : "Verify with device"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Email</label>
                    <input
                      type="email"
                      value={state.email}
                      onChange={(e) => set("email", e.target.value)}
                      required
                      className="input"
                      placeholder="you@example.com"
                    />
                  </div>

                  {state.mode === "register" && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Your name</label>
                      <input
                        type="text"
                        value={state.displayName}
                        onChange={(e) => set("displayName", e.target.value)}
                        required
                        className="input"
                        placeholder="John"
                      />
                    </div>
                  )}

                  {state.method === "email" && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Password</label>
                      <input
                        type="password"
                        value={state.password}
                        onChange={(e) => set("password", e.target.value)}
                        required
                        minLength={8}
                        className="input"
                        placeholder="8+ characters"
                      />
                    </div>
                  )}

                  {state.method === "passkey" && state.mode === "register" && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Device label (optional)</label>
                      <input
                        type="text"
                        value={state.deviceName}
                        onChange={(e) => set("deviceName", e.target.value)}
                        className="input"
                        placeholder="e.g. Work MacBook"
                      />
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>Helps you identify this device later</div>
                    </div>
                  )}

                  {state.error && (
                    <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 12, fontWeight: 600 }}>{state.error}</div>
                  )}

                  <button type="submit" disabled={state.loading} className="btn btn-primary" style={{ width: "100%" }}>
                    {state.loading
                      ? "Loading..."
                      : state.mode === "login"
                        ? state.method === "passkey" ? "Sign in with passkey" : "Sign in"
                        : state.method === "passkey" ? "Continue" : "Create account"}
                  </button>
                </>
              )}
            </form>

            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, textAlign: "center" }}>
              {state.method === "passkey"
                ? state.mode === "login"
                  ? "Use your fingerprint, Face ID, or security key to sign in"
                  : "No password needed — your device keeps your account secure"
                : state.mode === "login"
                  ? "Sign in with your email and password"
                  : "Create a password-protected account (you can add a passkey later)"}
            </p>

            {state.mode === "login" && (
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <button
                  onClick={() => dispatch({ type: "SET_VIEW", view: "recover-request" })}
                  style={{ fontSize: 11, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}
                >
                  Locked out? Recover with email
                </button>
              </div>
            )}
          </>
        ) : state.view === "recover-request" ? (
          <form onSubmit={handleRecoverRequest}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Recover your account</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Enter the email you signed up with. We&apos;ll send you a code to set a new password.
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Email</label>
              <input
                type="email"
                value={state.email}
                onChange={(e) => set("email", e.target.value)}
                required
                className="input"
                placeholder="you@example.com"
                autoFocus
              />
            </div>

            {state.error && (
              <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 12, fontWeight: 600 }}>{state.error}</div>
            )}

            <button type="submit" disabled={state.loading} className="btn btn-primary" style={{ width: "100%" }}>
              {state.loading ? "Sending..." : "Send recovery code"}
            </button>

            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button
                type="button"
                onClick={() => dispatch({ type: "GO_BACK_TO_AUTH" })}
                style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Back to sign in
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRecoverFinish}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Set a new password</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {state.recoverMessage || `We sent a 6-digit code to ${state.email}. Enter it below along with your new password.`}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Recovery code</label>
              <input
                type="text"
                value={state.recoverCode}
                onChange={(e) => set("recoverCode", e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                className="input"
                placeholder="000000"
                maxLength={6}
                autoFocus
                style={{ letterSpacing: 4, fontSize: 18, textAlign: "center", fontWeight: 700 }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>New password</label>
              <input
                type="password"
                value={state.password}
                onChange={(e) => set("password", e.target.value)}
                required
                minLength={8}
                className="input"
                placeholder="8+ characters"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Your name</label>
              <input
                type="text"
                value={state.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                className="input"
                placeholder="Optional — display name"
              />
            </div>

            {state.error && (
              <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 12, fontWeight: 600 }}>{state.error}</div>
            )}

            <button type="submit" disabled={state.loading || state.recoverCode.length !== 6} className="btn btn-primary" style={{ width: "100%" }}>
              {state.loading ? "Recovering..." : "Set password & sign in"}
            </button>

            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_VIEW", view: "recover-request" })}
                style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── WebAuthn Helpers ─────────────────────────────────────────────────────────

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

async function createPasskeyCredential(
  challenge: string,
  rpId: string,
  userId: string,
  email: string,
  displayName: string
): Promise<Record<string, unknown>> {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: base64urlToBuffer(challenge),
      rp: { name: "LLMRanked", id: rpId },
      user: {
        id: new TextEncoder().encode(userId),
        name: email,
        displayName: displayName,
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

  return {
    id: credential.id,
    rawId: bufferToBase64url(pkCredential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(pkCredential.response.clientDataJSON),
      attestationObject: bufferToBase64url(pkCredential.response.attestationObject),
    },
    authenticatorAttachment: pkCredential.authenticatorAttachment,
    user_id: userId,
  };
}

async function getPasskeyCredential(
  challenge: string,
  rpId: string,
  allowCredentials?: string[]
): Promise<Record<string, unknown>> {
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: base64urlToBuffer(challenge),
    rpId: rpId,
    userVerification: "required",
    timeout: 60000,
  };

  if (allowCredentials && allowCredentials.length > 0) {
    publicKey.allowCredentials = allowCredentials.map((id) => ({
      id: base64urlToBuffer(id),
      type: "public-key",
    }));
  }

  const assertion = await navigator.credentials.get({ publicKey });

  if (!assertion) throw new Error("Passkey authentication cancelled");

  const pkAssertion = assertion as PublicKeyCredential & {
    rawId: ArrayBuffer;
    response: AuthenticatorAssertionResponse;
  };

  return {
    id: assertion.id,
    rawId: bufferToBase64url(pkAssertion.rawId),
    type: assertion.type,
    response: {
      clientDataJSON: bufferToBase64url(pkAssertion.response.clientDataJSON),
      authenticatorData: bufferToBase64url(pkAssertion.response.authenticatorData),
      signature: bufferToBase64url(pkAssertion.response.signature),
    },
  };
}
