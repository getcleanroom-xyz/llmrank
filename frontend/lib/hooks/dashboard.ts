import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import * as api from "../api";

export function useDashboard(brandId: string) {
  return useQuery({
    queryKey: queryKeys.dashboard(brandId),
    queryFn: async () => {
      const [dashResult, queriesResult] = await Promise.allSettled([
        api.getDashboard(brandId),
        api.getQueries(brandId),
      ]);
      return {
        dashboard: dashResult.status === "fulfilled" ? dashResult.value : null,
        queries: queriesResult.status === "fulfilled" ? queriesResult.value : [],
      };
    },
  });
}

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

export function useQueryDrilldown(brandId: string, queryId: string) {
  return useQuery({
    queryKey: queryKeys.drilldown(brandId, queryId),
    queryFn: () => api.getQueryDrilldown(brandId, queryId),
  });
}

export function useScanDetail(brandId: string, scanId: string) {
  return useQuery({
    queryKey: queryKeys.scanDetail(brandId, scanId),
    queryFn: () => api.getScanResults(brandId, scanId),
    enabled: !!brandId && !!scanId,
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
