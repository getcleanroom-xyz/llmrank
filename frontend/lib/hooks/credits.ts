import { useQuery, useMutation } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import * as api from "../api";

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
