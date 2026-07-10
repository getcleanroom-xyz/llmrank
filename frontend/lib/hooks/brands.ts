import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import * as api from "../api";

export function useBrands(page: number = 1, search: string = "") {
  return useQuery({
    queryKey: queryKeys.brands(page, search),
    queryFn: () => api.getBrands(page, 50, search),
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, domain, competitors }: { name: string; domain: string; competitors?: string[] }) =>
      api.createBrand(name, domain, competitors ?? []),
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
