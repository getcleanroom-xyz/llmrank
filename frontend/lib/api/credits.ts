import { apiFetch } from "./client";

export interface CreditBalance {
  balance: number;
  total_purchased: number;
  total_used: number;
  cost_per_scan: Record<string, number>;
}

export const getCredits = () => apiFetch<CreditBalance>("/credits");
