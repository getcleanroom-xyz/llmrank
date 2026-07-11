import { apiFetch } from "./client";

export interface RecommendationResponse {
  response: string;
  success: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const sendRecommendation = (brandId: string, message: string, history?: ChatMessage[]) =>
  apiFetch<RecommendationResponse>(`/brands/${brandId}/recommend`, {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });

export const streamRecommendation = async function* (
  brandId: string,
  message: string,
  history?: ChatMessage[],
): AsyncGenerator<string, void, unknown> {
  const resp = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/brands/${brandId}/recommend/stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message, history }),
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }

  const reader = resp.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        if (parsed.token) yield parsed.token;
        if (parsed.error) throw new Error(parsed.error);
      } catch {
        // skip malformed chunks
      }
    }
  }
};
