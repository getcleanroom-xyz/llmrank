"use client";

import { useState, useEffect } from "react";
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

export function AuthModal() {
  const { user, setUser, closeAuthModal, authModalOpen, authModalMode } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(authModalMode);
  const [method, setMethod] = useState<AuthMethod>("passkey");
  const [view, setView] = useState<AuthView>("auth");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [recoverCode, setRecoverCode] = useState("");
  const [recoverMessage, setRecoverMessage] = useState("");

  useEffect(() => {
    setMode(authModalMode);
    setEmail("");
    setDisplayName("");
    setPassword("");
    setDeviceName("");
    setError("");
    setStep("form");
    setMethod("passkey");
    setView("auth");
    setRecoverCode("");
    setRecoverMessage("");
  }, [authModalMode]);

  if (!authModalOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (method === "passkey") {
      if (step === "form") {
        setStep("confirm");
        return;
      }
      setLoading(true);
      try {
        const { challenge, rp_id, user_id } = await authRegisterStart(email, displayName);
        const device = deviceName || getDeviceName();
        const credential = await createPasskeyCredential(challenge, rp_id, user_id, email, displayName);
        const result = await authRegisterFinish(credential, device);
        setUser(result.user);
        closeAuthModal();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Registration failed";
        if (msg.includes("cancelled")) {
          setError("Setup cancelled. No worries — you can try again whenever you're ready.");
        } else {
          setError(msg);
        }
        setStep("form");
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        const result = await authEmailRegister(email, displayName, password);
        setUser(result.user);
        closeAuthModal();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Registration failed");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (method === "passkey") {
        const { challenge, rp_id, allow_credentials } = await authLoginStart(email);
        const credential = await getPasskeyCredential(challenge, rp_id, allow_credentials);
        const result = await authLoginFinish(credential);
        setUser(result.user);
        closeAuthModal();
      } else {
        const result = await authEmailLogin(email, password);
        setUser(result.user);
        closeAuthModal();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      if (msg.includes("cancelled")) {
        setError("Sign-in cancelled. Try again when you're ready.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
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
    setError("");
    setLoading(true);
    try {
      const result = await authRecover(email);
      setRecoverMessage(result.message);
      setView("recover-verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send recovery code");
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authRecoverFinish(email, recoverCode, password, displayName || undefined);
      setUser(result.user);
      closeAuthModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery failed");
    } finally {
      setLoading(false);
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
        ) : (
          <>
            {/* Tab bar: Sign in / Create account */}
            <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
              <button
                onClick={() => { setMode("login"); setStep("form"); setError(""); }}
                className={`btn ${mode === "login" ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1 }}
              >
                Sign in
              </button>
              <button
                onClick={() => { setMode("register"); setStep("form"); setError(""); }}
                className={`btn ${mode === "register" ? "btn-primary" : "btn-ghost"}`}
                style={{ flex: 1 }}
              >
                Create account
              </button>
            </div>

            {/* Method selector */}
            <div style={{ display: "flex", gap: 4, marginBottom: 14, background: "var(--bg-dark)", borderRadius: "var(--radius)", padding: 3 }}>
              <button
                onClick={() => { setMethod("passkey"); setError(""); setStep("form"); }}
                style={{
                  flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 600, borderRadius: "calc(var(--radius) - 2px)",
                  border: "none", cursor: "pointer",
                  background: method === "passkey" ? "var(--surface)" : "transparent",
                  color: method === "passkey" ? "var(--text)" : "var(--text-muted)",
                  boxShadow: method === "passkey" ? "var(--shadow)" : "none",
                }}
              >
                Passkey
              </button>
              <button
                onClick={() => { setMethod("email"); setError(""); setStep("form"); }}
                style={{
                  flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 600, borderRadius: "calc(var(--radius) - 2px)",
                  border: "none", cursor: "pointer",
                  background: method === "email" ? "var(--surface)" : "transparent",
                  color: method === "email" ? "var(--text)" : "var(--text-muted)",
                  boxShadow: method === "email" ? "var(--shadow)" : "none",
                }}
              >
                Email + password
              </button>
            </div>

            <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
              {/* Passkey confirm step */}
              {method === "passkey" && mode === "register" && step === "confirm" ? (
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
                    <strong>{email}</strong>
                    {displayName && <> &middot; {displayName}</>}
                  </div>

                  {error && (
                    <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 12, fontWeight: 600 }}>{error}</div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => { setStep("form"); setError(""); }} className="btn btn-ghost" style={{ flex: 1 }}>
                      Back
                    </button>
                    <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 2 }}>
                      {loading ? "Creating passkey..." : "Verify with device"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Email field */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="input"
                      placeholder="you@example.com"
                    />
                  </div>

                  {/* Register-only fields */}
                  {mode === "register" && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Your name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                        className="input"
                        placeholder="John"
                      />
                    </div>
                  )}

                  {/* Password field (email method only) */}
                  {method === "email" && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className="input"
                        placeholder="8+ characters"
                      />
                    </div>
                  )}

                  {/* Device label (passkey register only) */}
                  {method === "passkey" && mode === "register" && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Device label (optional)</label>
                      <input
                        type="text"
                        value={deviceName}
                        onChange={(e) => setDeviceName(e.target.value)}
                        className="input"
                        placeholder="e.g. Work MacBook"
                      />
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>Helps you identify this device later</div>
                    </div>
                  )}

                  {error && (
                    <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 12, fontWeight: 600 }}>{error}</div>
                  )}

                  <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%" }}>
                    {loading
                      ? "Loading..."
                      : mode === "login"
                        ? method === "passkey" ? "Sign in with passkey" : "Sign in"
                        : method === "passkey" ? "Continue" : "Create account"}
                  </button>
                </>
              )}
            </form>

            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, textAlign: "center" }}>
              {method === "passkey"
                ? mode === "login"
                  ? "Use your fingerprint, Face ID, or security key to sign in"
                  : "No password needed — your device keeps your account secure"
                : mode === "login"
                  ? "Sign in with your email and password"
                  : "Create a password-protected account (you can add a passkey later)"}
            </p>

            {mode === "login" && (
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <button
                  onClick={() => { setView("recover-request"); setError(""); }}
                  style={{ fontSize: 11, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}
                >
                  Locked out? Recover with email
                </button>
              </div>
            )}
          </>
        )}

        {/* ─── Recovery: Request Code ──────────────────────────────────── */}
        {view === "recover-request" && (
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                placeholder="you@example.com"
                autoFocus
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 12, fontWeight: 600 }}>{error}</div>
            )}

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%" }}>
              {loading ? "Sending..." : "Send recovery code"}
            </button>

            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button
                type="button"
                onClick={() => { setView("auth"); setError(""); }}
                style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {/* ─── Recovery: Verify Code & Set Password ────────────────────── */}
        {view === "recover-verify" && (
          <form onSubmit={handleRecoverFinish}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>Set a new password</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {recoverMessage || `We sent a 6-digit code to ${email}. Enter it below along with your new password.`}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Recovery code</label>
              <input
                type="text"
                value={recoverCode}
                onChange={(e) => setRecoverCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input"
                placeholder="Optional — display name"
              />
            </div>

            {error && (
              <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 12, fontWeight: 600 }}>{error}</div>
            )}

            <button type="submit" disabled={loading || recoverCode.length !== 6} className="btn btn-primary" style={{ width: "100%" }}>
              {loading ? "Recovering..." : "Set password & sign in"}
            </button>

            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button
                type="button"
                onClick={() => { setView("recover-request"); setError(""); }}
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
      rp: {
        name: "LLMRanked",
        id: rpId,
      },
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
