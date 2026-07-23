const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
const DEFAULT_TIMEOUT_MS = 30_000;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }

  get userMessage(): string {
    if (this.status === 401) return "Your session expired. Please log in again.";
    if (this.status === 403) return "You don't have permission to do that.";
    if (this.status === 404) return "The requested resource was not found.";
    if (this.status === 409) return "This already exists. Please try something else.";
    if (this.status === 429) return "Too many requests. Please wait a moment and try again.";
    if (this.status >= 500) return "Something went wrong on our end. Please try again later.";
    try {
      const parsed = JSON.parse(this.message.replace(/^API \d+: /, ""));
      if (parsed.detail) return parsed.detail;
    } catch {}
    return this.message;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const isFormData = init?.body instanceof FormData;
    const headers: Record<string, string> = isFormData
      ? {}
      : { "Content-Type": "application/json" };

    const res = await fetch(`${BASE_URL}${path}`, {
      credentials: "include",
      ...init,
      headers: { ...headers, ...init?.headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new ApiError(res.status, body);
    }
    if (res.status === 204) return undefined as unknown as T;
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
