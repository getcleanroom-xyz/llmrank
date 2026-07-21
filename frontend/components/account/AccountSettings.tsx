"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
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
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    loadPasskeys();
  }, [user, router]);

  const loadPasskeys = async () => {
    try {
      setLoading(true);
      const data = await authListPasskeys();
      setPasskeys(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load passkeys");
    } finally {
      setLoading(false);
    }
  };

  const handleAddPasskey = async () => {
    setError("");
    setSuccess("");
    setAdding(true);
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
      setSuccess(`Passkey "${device_name}" added successfully`);
      await loadPasskeys();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add passkey";
      if (msg.includes("cancelled")) {
        setError("Setup cancelled.");
      } else {
        setError(msg);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    setError("");
    setSuccess("");
    setDeleting(id);
    try {
      await authDeletePasskey(id);
      setSuccess("Passkey removed");
      await loadPasskeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete passkey");
    } finally {
      setDeleting(null);
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
        {/* Account info */}
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

        {/* Passkeys */}
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="section-label">Passkeys</div>
            <button
              onClick={handleAddPasskey}
              disabled={adding}
              className="btn btn-sm btn-primary"
            >
              {adding ? "Adding..." : "+ Add passkey"}
            </button>
          </div>

          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>
            Passkeys let you sign in with your fingerprint, Face ID, or security key — no password needed.
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 10, fontWeight: 600 }}>{error}</div>
          )}
          {success && (
            <div style={{ fontSize: 12, color: "var(--green)", marginBottom: 10, fontWeight: 600 }}>{success}</div>
          )}

          {loading ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "12px 0" }}>Loading...</div>
          ) : passkeys.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "12px 0" }}>
              No passkeys registered. Add one above for passwordless sign-in.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {passkeys.map((pk) => (
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
                    disabled={deleting === pk.id || passkeys.length <= 1}
                    className="btn btn-sm btn-ghost"
                    style={{ color: "var(--red)", fontSize: 11 }}
                    title={passkeys.length <= 1 ? "Can't delete your last passkey" : "Remove passkey"}
                  >
                    {deleting === pk.id ? "..." : "Remove"}
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
