import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import * as api from "../api";

export function useAdminCampaigns() {
  return useQuery({
    queryKey: queryKeys.campaigns,
    queryFn: api.adminListCampaigns,
  });
}

export function useAdminCampaign(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.campaign(id ?? ""),
    queryFn: () => api.adminGetCampaign(id!),
    enabled: !!id,
  });
}

export function useAdminCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.adminCreateCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.campaigns }),
  });
}

export function useAdminUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.adminUpdateCampaign(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.campaigns }),
  });
}

export function useAdminDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.adminDeleteCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.campaigns }),
  });
}

export function useAdminScheduleCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.adminScheduleCampaign(id, data as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.campaigns }),
  });
}

export function useAdminCancelCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.adminCancelCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.campaigns }),
  });
}

export function useAdminPreviewCampaign() {
  return useMutation({
    mutationFn: (id: string) => api.adminPreviewCampaign(id),
  });
}

export function useAdminBuildAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.adminBuildAudience(id),
    onSuccess: (_data, id) => qc.invalidateQueries({ queryKey: queryKeys.campaign(id) }),
  });
}

export function useAdminUsers(search?: string) {
  return useQuery({
    queryKey: queryKeys.adminUsers(search),
    queryFn: () => api.adminListUsers(search),
    enabled: search !== undefined,
  });
}

export function useAdminStats() {
  return useQuery({
    queryKey: queryKeys.adminStats,
    queryFn: api.adminGetStats,
  });
}

export function useAdminCloneCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.adminCloneCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.campaigns }),
  });
}

// ─── Blog ──────────────────────────────────────────────────────────────────

export function useAdminBlogPosts() {
  return useQuery({
    queryKey: ["adminBlogPosts"],
    queryFn: api.adminListBlogPosts,
  });
}

export function useAdminBlogCalendar() {
  return useQuery({
    queryKey: ["adminBlogCalendar"],
    queryFn: api.adminListCalendar,
  });
}

export function useAdminGenerateBlog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.adminGenerateBlog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminBlogPosts"] });
      qc.invalidateQueries({ queryKey: ["adminBlogCalendar"] });
    },
  });
}
