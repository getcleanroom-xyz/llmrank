import { apiFetch } from "./client";

export interface Conversation {
  id: string;
  brand_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ConversationListResponse {
  items: Conversation[];
  total: number;
  page: number;
  per_page: number;
}

export const listConversations = (brandId: string, page = 1, perPage = 50) =>
  apiFetch<ConversationListResponse>(`/brands/${brandId}/conversations?page=${page}&per_page=${perPage}`);

export const createConversation = (brandId: string, title?: string) =>
  apiFetch<Conversation>(`/brands/${brandId}/conversations`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });

export const getConversation = (brandId: string, conversationId: string) =>
  apiFetch<Conversation>(`/brands/${brandId}/conversations/${conversationId}`);

export const updateConversation = (brandId: string, conversationId: string, title: string) =>
  apiFetch<Conversation>(`/brands/${brandId}/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });

export const deleteConversation = (brandId: string, conversationId: string) =>
  apiFetch<{ ok: boolean }>(`/brands/${brandId}/conversations/${conversationId}`, {
    method: "DELETE",
  });

export const listMessages = (brandId: string, conversationId: string) =>
  apiFetch<ChatMessage[]>(`/brands/${brandId}/conversations/${conversationId}/messages`);

export const addMessage = (brandId: string, conversationId: string, role: "user" | "assistant", content: string) =>
  apiFetch<ChatMessage>(`/brands/${brandId}/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ role, content }),
  });

export const addMessagesBatch = (brandId: string, conversationId: string, messages: { role: "user" | "assistant"; content: string }[]) =>
  apiFetch<{ ok: boolean; count: number }>(`/brands/${brandId}/conversations/${conversationId}/messages/batch`, {
    method: "POST",
    body: JSON.stringify(messages),
  });
