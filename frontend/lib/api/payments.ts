import { apiFetch } from "./client";

export interface CreditPackage {
  key: string;
  credits: number;
  amount_usd: number;
  label: string;
}

export interface CheckoutSession {
  charge_id: string;
  reference: string;
  checkout_url: string | null;
  amount: number;
  currency: string;
}

export const getCreditPackages = () => apiFetch<CreditPackage[]>("/payments/packages");
export const getEncryptionKey = () => apiFetch<{ key: string }>("/payments/encryption-key");

export const createCheckout = (packageKey: string, currency: string = "USD", encryptedCard: Record<string, string>) =>
  apiFetch<CheckoutSession>("/payments/checkout", {
    method: "POST",
    body: JSON.stringify({ package_key: packageKey, currency, encrypted_card: encryptedCard }),
  });

export const verifyPayment = (transactionId: string) =>
  apiFetch<Record<string, unknown>>(`/payments/verify/${transactionId}`);
