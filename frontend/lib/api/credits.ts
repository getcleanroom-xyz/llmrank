import { apiFetch } from "./client";

export interface CreditBalance {
  balance: number;
  total_purchased: number;
  total_used: number;
  cost_per_scan: Record<string, number>;
}

export interface CreditTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  balance_after: number;
  created_at: string;
}

export const getCredits = () => apiFetch<CreditBalance>("/credits");
export const getCreditHistory = () => apiFetch<CreditTransaction[]>("/credits/history");
