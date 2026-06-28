"use client";

import { useState, useEffect } from "react";
import { getCreditPackages, createCheckout, type CreditPackage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface BuyCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export function BuyCreditsModal({ open, onClose }: BuyCreditsModalProps) {
  const { user } = useAuth();
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      getCreditPackages()
        .then(setPackages)
        .catch(() => setError("Failed to load packages"))
        .finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  const handlePurchase = async (packageKey: string) => {
    if (!user) {
      setError("Please sign in first");
      return;
    }

    setPurchasing(packageKey);
    setError("");

    try {
      const session = await createCheckout(packageKey);

      if (session.checkout_url) {
        const url = session.checkout_url;
        window.location.replace(url);
      } else {
        setError("Failed to get checkout URL");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#141414] border-2 border-[#222] rounded-xl p-8 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Buy Credits</h2>
            <p className="text-gray-400 text-sm mt-1">1 credit = $0.001</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-[#1A1A1A] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {packages.map((pkg) => (
              <button
                key={pkg.key}
                onClick={() => handlePurchase(pkg.key)}
                disabled={purchasing !== null}
                className={`p-6 rounded-xl text-left transition-all ${
                  pkg.key === "popular"
                    ? "bg-[#FFD600]/10 border-2 border-[#FFD600] hover:bg-[#FFD600]/20"
                    : "bg-[#1A1A1A] border-2 border-[#333] hover:border-[#555]"
                } ${purchasing === pkg.key ? "opacity-50" : ""}`}
              >
                {pkg.key === "popular" && (
                  <span className="text-xs font-bold text-[#FFD600] uppercase">Most Popular</span>
                )}
                <div className="text-2xl font-bold text-white mt-1">
                  {pkg.credits.toLocaleString()} credits
                </div>
                <div className="text-gray-400 text-sm mt-1">
                  ${pkg.amount_usd.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  ${(pkg.amount_usd / pkg.credits * 1000).toFixed(2)} per 1K credits
                </div>
                {purchasing === pkg.key && (
                  <div className="text-sm text-[#FFD600] mt-2">Processing...</div>
                )}
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-500 mt-6">
          Payments processed securely via Flutterwave. Credits are added instantly after payment.
        </p>
      </div>
    </div>
  );
}
