import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as convApi from "@/lib/api/conversations";

export function useConversations(brandId: string, page = 1) {
  return useQuery({
    queryKey: ["conversations", brandId, page],
    queryFn: () => convApi.listConversations(brandId, page),
    staleTime: 30_000,
  });
}

export function useConversationMessages(brandId: string, conversationId: string | null) {
  return useQuery({
    queryKey: ["conversationMessages", brandId, conversationId],
    queryFn: () => convApi.listMessages(brandId, conversationId!),
    enabled: !!conversationId,
    staleTime: 30_000,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ brandId, title }: { brandId: string; title?: string }) =>
      convApi.createConversation(brandId, title),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["conversations", variables.brandId] });
    },
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ brandId, conversationId, title }: { brandId: string; conversationId: string; title: string }) =>
      convApi.updateConversation(brandId, conversationId, title),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["conversations", variables.brandId] });
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ brandId, conversationId }: { brandId: string; conversationId: string }) =>
      convApi.deleteConversation(brandId, conversationId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["conversations", variables.brandId] });
    },
  });
}

export function useAddMessagesBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ brandId, conversationId, messages }: {
      brandId: string;
      conversationId: string;
      messages: { role: "user" | "assistant"; content: string }[];
    }) => convApi.addMessagesBatch(brandId, conversationId, messages),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["conversationMessages", variables.brandId, variables.conversationId] });
      qc.invalidateQueries({ queryKey: ["conversations", variables.brandId] });
    },
  });
}
