"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  authRegisterStart,
  authRegisterFinish,
  authLoginStart,
  authLoginFinish,
  authLogout,
} from "@/lib/api";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { user, setUser } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Start registration
      const { challenge, rp_id, user_id } = await authRegisterStart(email, displayName);

      // Get device name
      const device = deviceName || getDeviceName();

      // Create passkey credential
      const credential = await createPasskeyCredential(challenge, rp_id, user_id, email, displayName);

      // Finish registration
      const result = await authRegisterFinish(credential, device);
      setUser(result.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Start login
      const { challenge, rp_id } = await authLoginStart(email);

      // Get passkey credential
      const credential = await getPasskeyCredential(challenge, rp_id);

      // Finish login
      const result = await authLoginFinish(credential);
      setUser(result.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await authLogout();
    setUser(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#141414] border-2 border-[#222] rounded-xl p-8 w-full max-w-md mx-4">
        {user ? (
          // Logged in state
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#FFD600] flex items-center justify-center text-2xl font-bold text-black">
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <h2 className="mt-4 text-xl font-bold text-white">{user.display_name}</h2>
              <p className="text-gray-400 text-sm">{user.email}</p>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-3 bg-[#1A1A1A] border-2 border-[#333] text-white rounded-lg hover:border-[#FFD600] transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          // Auth form
          <>
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setMode("login")}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  mode === "login"
                    ? "bg-[#FFD600] text-black"
                    : "bg-[#1A1A1A] text-gray-400 hover:text-white"
                }`}
              >
                Sign in
              </button>
              <button
                onClick={() => setMode("register")}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  mode === "register"
                    ? "bg-[#FFD600] text-black"
                    : "bg-[#1A1A1A] text-gray-400 hover:text-white"
                }`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#1A1A1A] border-2 border-[#333] rounded-lg text-white focus:border-[#FFD600] focus:outline-none"
                  placeholder="you@example.com"
                />
              </div>

              {mode === "register" && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Display name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-[#1A1A1A] border-2 border-[#333] rounded-lg text-white focus:border-[#FFD600] focus:outline-none"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Device name (optional)</label>
                    <input
                      type="text"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      className="w-full px-4 py-3 bg-[#1A1A1A] border-2 border-[#333] rounded-lg text-white focus:border-[#FFD600] focus:outline-none"
                      placeholder="My MacBook"
                    />
                  </div>
                </>
              )}

              {error && (
                <p className="text-red-400 text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#FFD600] text-black font-bold rounded-lg hover:bg-[#FFC000] transition-colors disabled:opacity-50"
              >
                {loading ? "Loading..." : mode === "login" ? "Sign in with passkey" : "Create account"}
              </button>
            </form>

            <p className="text-center text-xs text-gray-500 mt-4">
              {mode === "login"
                ? "Use your device's biometric or security key to sign in"
                : "We'll create a passkey on your device for secure, passwordless login"}
            </p>
          </>
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
        name: "LLMRank",
        id: rpId,
      },
      user: {
        id: new TextEncoder().encode(userId),
        name: email,
        displayName: displayName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 }, // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
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
    raw_id: bufferToBase64url(pkCredential.rawId),
    type: credential.type,
    response: {
      client_data_json: bufferToBase64url(pkCredential.response.clientDataJSON),
      attestation_object: bufferToBase64url(pkCredential.response.attestationObject),
    },
    authenticator_attachment: pkCredential.authenticatorAttachment,
    user_id: userId,
  };
}

async function getPasskeyCredential(
  challenge: string,
  rpId: string
): Promise<Record<string, unknown>> {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: base64urlToBuffer(challenge),
      rpId: rpId,
      userVerification: "required",
      timeout: 60000,
    },
  });

  if (!assertion) throw new Error("Passkey authentication cancelled");

  const pkAssertion = assertion as PublicKeyCredential & {
    rawId: ArrayBuffer;
    response: AuthenticatorAssertionResponse;
  };

  return {
    id: assertion.id,
    raw_id: bufferToBase64url(pkAssertion.rawId),
    type: assertion.type,
    response: {
      client_data_json: bufferToBase64url(pkAssertion.response.clientDataJSON),
      authenticator_data: bufferToBase64url(pkAssertion.response.authenticatorData),
      signature: bufferToBase64url(pkAssertion.response.signature),
    },
  };
}
