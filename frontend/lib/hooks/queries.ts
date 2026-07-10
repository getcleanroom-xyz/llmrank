import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import * as api from "../api";

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

export function useSuggestQueriesFull() {
  return useMutation({
    mutationFn: ({ brandId, brand_name, domain, keywords }: { brandId: string; brand_name: string; domain: string; keywords?: string[] }) =>
      api.suggestQueriesFull(brandId, brand_name, domain, keywords ?? []),
  });
}

export function useProbeQueries() {
  return useMutation({
    mutationFn: (brandId: string) => api.probeQueries(brandId),
  });
}
