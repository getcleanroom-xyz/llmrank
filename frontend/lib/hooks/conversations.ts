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


