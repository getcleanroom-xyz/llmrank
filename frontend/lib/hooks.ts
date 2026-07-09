import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import * as api from "./api";

// ─── Brands ──────────────────────────────────────────────────────────────────

export function useBrands(page: number = 1, search: string = "") {
  return useQuery({
    queryKey: queryKeys.brands(page, search),
    queryFn: () => api.getBrands(page, 50, search),
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, domain }: { name: string; domain: string }) =>
      api.createBrand(name, domain),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] }),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteBrand(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] }),
  });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function useDashboard(brandId: string) {
  return useQuery({
    queryKey: queryKeys.dashboard(brandId),
    queryFn: () => Promise.all([
      api.getDashboard(brandId),
      api.getQueries(brandId),
    ]),
    select: ([dashboard, queries]) => ({ dashboard, queries }),
  });
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useQueries(brandId: string) {
  return useQuery({
    queryKey: queryKeys.queries(brandId),
    queryFn: () => api.getQueries(brandId),
  });
}

export function useAddQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ brandId, query_text }: { brandId: string; query_text: string }) =>
      api.addQuery(brandId, query_text),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.queries(variables.brandId) });
      qc.invalidateQueries({ queryKey: ["queriesTable", variables.brandId] });
    },
  });
}

export function useDeleteQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ brandId, queryId }: { brandId: string; queryId: string }) =>
      api.deleteQuery(brandId, queryId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.queries(variables.brandId) });
      qc.invalidateQueries({ queryKey: ["queriesTable", variables.brandId] });
    },
  });
}

export function useQueriesTable(brandId: string, page: number = 1, perPage: number = 20, q: string = "") {
  return useQuery({
    queryKey: queryKeys.queriesTable(brandId, page, perPage, q),
    queryFn: () => api.getQueriesTable(brandId, page, perPage, q),
    placeholderData: (prev) => prev,
  });
}

export function useSuggestQueries() {
  return useMutation({
    mutationFn: ({ brandId, brand_name, domain, keywords }: {
      brandId: string;
      brand_name: string;
      domain: string;
      keywords: string[];
    }) => api.suggestQueries(brandId, brand_name, domain, keywords),
  });
}

// ─── Scans ───────────────────────────────────────────────────────────────────

export function useScans(brandId: string, page: number = 1, perPage: number = 20) {
  return useQuery({
    queryKey: queryKeys.scans(brandId, page, perPage),
    queryFn: () => api.getScans(brandId, page, perPage),
  });
}

export function useTriggerScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ brandId, llms }: { brandId: string; llms: string[] }) =>
      api.triggerScan(brandId, llms),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.scans(variables.brandId) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard(variables.brandId) });
    },
  });
}

// ─── Drilldown ───────────────────────────────────────────────────────────────

export function useQueryDrilldown(brandId: string, queryId: string) {
  return useQuery({
    queryKey: queryKeys.drilldown(brandId, queryId),
    queryFn: () => api.getQueryDrilldown(brandId, queryId),
  });
}

export function useLLMDrilldown(brandId: string, llmName: string) {
  return useQuery({
    queryKey: queryKeys.llmDrilldown(brandId, llmName),
    queryFn: () => api.getLLMDrilldown(brandId, llmName),
  });
}

export function useCompetitorDrilldown(brandId: string, competitorName: string) {
  return useQuery({
    queryKey: queryKeys.competitorDrilldown(brandId, competitorName),
    queryFn: () => api.getCompetitorDrilldown(brandId, competitorName),
  });
}

// ─── Credits ─────────────────────────────────────────────────────────────────

export function useCredits() {
  return useQuery({
    queryKey: queryKeys.credits,
    queryFn: api.getCredits,
    staleTime: 10_000,
  });
}

export function useCreditPackages() {
  return useQuery({
    queryKey: queryKeys.creditPackages,
    queryFn: api.getCreditPackages,
    staleTime: 60_000,
  });
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: ({ packageKey, currency, encryptedCard }: { packageKey: string; currency?: string; encryptedCard: Record<string, string> }) =>
      api.createCheckout(packageKey, currency, encryptedCard),
  });
}

export function useVerifyPayment() {
  return useMutation({
    mutationFn: (transactionId: string) => api.verifyPayment(transactionId),
  });
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: api.authGetMe,
    retry: false,
    staleTime: 30_000,
  });
}

// ─── Admin: Campaigns ────────────────────────────────────────────────────────

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

export function useAdminUploadCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      api.adminUploadCsv(id, file),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: queryKeys.campaign(variables.id) }),
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
