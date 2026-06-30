"use client";

import { useState } from "react";
import { useCreditPackages, useCreateCheckout } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";

interface BuyCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export function BuyCreditsModal({ open, onClose }: BuyCreditsModalProps) {
  const { user } = useAuth();
  const { data: packages = [], isLoading, error: loadError } = useCreditPackages();
  const createCheckout = useCreateCheckout();
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!open) return null;

  const handlePurchase = async (packageKey: string) => {
    if (!user) {
      setError("Please sign in first");
      return;
    }

    setPurchasing(packageKey);
    setError("");

    try {
      const session = await createCheckout.mutateAsync({ packageKey });

      if (session.checkout_url) {
        const url = session.checkout_url;
        window.location.replace(url);
      } else {
        setError("Failed to get checkout URL");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      if (msg.includes("Expecting value") || msg.includes("empty body")) {
        setError("Payment provider error. Please try again or contact support.");
      } else {
        setError(msg);
      }
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} onClick={onClose} />

      {/* Modal */}
      <div className="card" style={{ position: "relative", width: "100%", maxWidth: 480, margin: "0 16px", padding: 24, zIndex: 10, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Buy Credits</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>1 credit = $0.001</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm">x</button>
        </div>

        {error && (
          <div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#991B1B", fontWeight: 600 }}>
            {error}
          </div>
        )}

        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 100 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {packages.map((pkg) => (
              <button
                key={pkg.key}
                onClick={() => handlePurchase(pkg.key)}
                disabled={purchasing !== null}
                className="card"
                style={{
                  padding: 16,
                  textAlign: "left",
                  cursor: purchasing ? "not-allowed" : "pointer",
                  opacity: purchasing === pkg.key ? 0.5 : 1,
                  borderColor: pkg.key === "popular" ? "var(--primary)" : undefined,
                }}
              >
                {pkg.key === "popular" && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", marginBottom: 4 }}>POPULAR</div>
                )}
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
                  {pkg.credits.toLocaleString()}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  ${pkg.amount_usd.toFixed(2)}
                </div>
                {purchasing === pkg.key && (
                  <div style={{ fontSize: 11, color: "var(--primary)", marginTop: 4 }}>Processing...</div>
                )}
              </button>
            ))}
          </div>
        )}

        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, textAlign: "center" }}>
          Payments processed securely via Flutterwave.
        </p>
      </div>
    </div>
  );
}
