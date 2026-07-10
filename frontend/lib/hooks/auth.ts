import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import * as api from "../api";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: api.authGetMe,
    retry: false,
    staleTime: 30_000,
  });
}
