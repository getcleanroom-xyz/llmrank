import { apiFetch } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  is_admin?: boolean;
}

export const authRegisterStart = (email: string, display_name: string) =>
  apiFetch<{ challenge: string; rp_id: string; user_id: string }>("/auth/register/start", {
    method: "POST",
    body: JSON.stringify({ email, display_name }),
  });

export const authRegisterFinish = (credential: Record<string, unknown>, device_name: string) =>
  apiFetch<{ status: string; user: AuthUser }>("/auth/register/finish", {
    method: "POST",
    body: JSON.stringify({ credential, device_name }),
  });

export const authLoginStart = (email: string) =>
  apiFetch<{ challenge: string; rp_id: string; allow_credentials: string[] }>("/auth/login/start", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const authLoginFinish = (credential: Record<string, unknown>) =>
  apiFetch<{ status: string; user: AuthUser }>("/auth/login/finish", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });

export const authGetMe = () => apiFetch<AuthUser>("/auth/me");

export const authLogout = () =>
  apiFetch<{ status: string }>("/auth/logout", { method: "POST" });

// ─── Email + Password Auth ────────────────────────────────────────────────────

export const authEmailRegister = (email: string, display_name: string, password: string) =>
  apiFetch<{ status: string; user: AuthUser }>("/auth/register/email", {
    method: "POST",
    body: JSON.stringify({ email, display_name, password }),
  });

export const authEmailLogin = (email: string, password: string) =>
  apiFetch<{ status: string; user: AuthUser }>("/auth/login/email", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

// ─── Account Recovery ─────────────────────────────────────────────────────────

export const authRecover = (email: string) =>
  apiFetch<{ status: string; message: string }>("/auth/recover", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

export const authRecoverFinish = (email: string, code: string, password: string, display_name?: string) =>
  apiFetch<{ status: string; user: AuthUser }>("/auth/recover/finish", {
    method: "POST",
    body: JSON.stringify({ email, code, password, display_name }),
  });

// ─── Add Passkey (for logged-in users) ────────────────────────────────────────

export const authAddPasskeyStart = (device_name: string) =>
  apiFetch<{ challenge: string; rp_id: string; user_id: string }>("/auth/passkeys/start", {
    method: "POST",
    body: JSON.stringify({ device_name }),
  });

export const authAddPasskeyFinish = (credential: Record<string, unknown>, device_name: string) =>
  apiFetch<{ status: string; message: string }>("/auth/passkeys/finish", {
    method: "POST",
    body: JSON.stringify({ credential, device_name }),
  });

export const authListPasskeys = () =>
  apiFetch<{ id: string; device_name: string; created_at: string; last_used_at: string }[]>("/auth/passkeys");

export const authDeletePasskey = (passkey_id: string) =>
  apiFetch<{ status: string }>(`/auth/passkeys/${passkey_id}`, { method: "DELETE" });
