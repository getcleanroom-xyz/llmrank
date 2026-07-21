import type { DashboardData, MonitoredQuery } from "@/types";
import { ApiError } from "./client";
import type { AuthUser } from "./auth";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const DEFAULT_TIMEOUT_MS = 30_000;

export async function serverFetch<T>(path: string, cookieHeader: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new ApiError(res.status, body);
    }
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(408, `Request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getServerSession(cookieHeader: string): Promise<AuthUser | null> {
  try {
    return await serverFetch<AuthUser>("/auth/me", cookieHeader);
  } catch {
    return null;
  }
}

export async function getServerDashboard(brandId: string, cookieHeader: string): Promise<DashboardData | null> {
  try {
    return await serverFetch<DashboardData>(`/brands/${brandId}/dashboard`, cookieHeader);
  } catch {
    return null;
  }
}

export async function getServerQueries(brandId: string, cookieHeader: string): Promise<MonitoredQuery[]> {
  try {
    return await serverFetch<MonitoredQuery[]>(`/brands/${brandId}/queries`, cookieHeader);
  } catch {
    return [];
  }
}
