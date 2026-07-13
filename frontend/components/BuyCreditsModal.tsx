"use client";

import { useState, useEffect } from "react";
import { useCreditPackages, useCreateCheckout } from "@/lib/hooks";
import { getEncryptionKey } from "@/lib/api";
import { encryptAES, generateNonce } from "@/lib/encrypt";

interface BuyCreditsModalProps {
  open: boolean;
  onClose: () => void;
}

export function BuyCreditsModal({ open, onClose }: BuyCreditsModalProps) {
  const { data: packages = [], isLoading } = useCreditPackages();
  const createCheckout = useCreateCheckout();
  const [step, setStep] = useState<"packages" | "card">("packages");
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [encrypting, setEncrypting] = useState(false);
  const [error, setError] = useState("");
  const [encKey, setEncKey] = useState("");

  useEffect(() => {
    if (open) {
      setStep("packages");
      setError("");
      setCardNumber("");
      setExpiry("");
      setCvv("");
      getEncryptionKey().then((r) => setEncKey(r.key)).catch(() => setError("Failed to load encryption key"));
    }
  }, [open]);

  if (!open) return null;

  const handleSelectPackage = (pkg: string) => {
    setSelectedPkg(pkg);
    setStep("card");
    setError("");
  };

  const handlePay = async () => {
    const num = cardNumber.replace(/\s/g, "");
    if (num.length < 13 || num.length > 19) { setError("Invalid card number"); return; }

    const [m, y] = expiry.split("/").map((s) => s.trim());
    if (!m || !y || m.length !== 2 || y.length !== 2) { setError("Invalid expiry (MM/YY)"); return; }

    if (cvv.length < 3 || cvv.length > 4) { setError("Invalid CVV"); return; }

    if (!encKey) { setError("Encryption key not loaded"); return; }

    setEncrypting(true);
    setError("");

    try {
      const nonce = generateNonce();
      const [encNum, encMon, encYr, encCvv] = await Promise.all([
        encryptAES(num, encKey, nonce),
        encryptAES(m, encKey, nonce),
        encryptAES("20" + y, encKey, nonce),
        encryptAES(cvv, encKey, nonce),
      ]);

      const session = await createCheckout.mutateAsync({
        packageKey: selectedPkg!,
        encryptedCard: {
          encrypted_card_number: encNum,
          encrypted_expiry_month: encMon,
          encrypted_expiry_year: encYr,
          encrypted_cvv: encCvv,
          nonce,
        },
      });

      if (session.checkout_url) {
        window.location.replace(session.checkout_url);
      } else {
        setError("No redirect URL returned. Try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setEncrypting(false);
    }
  };

  const formatCard = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 16);
    return d.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    if (d.length >= 2) return d.slice(0, 2) + " / " + d.slice(2);
    return d;
  };

  const pkg = packages.find((p) => p.key === selectedPkg);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} onClick={onClose} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} />
      <div className="card" style={{ position: "relative", width: "100%", maxWidth: 420, margin: "0 16px", padding: 24, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>
              {step === "packages" ? "Buy Credits" : "Card details"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>1 credit = $0.001</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" aria-label="Close">x</button>
        </div>

        {error && (
          <div style={{ background: "#FEE2E2", border: "1.5px solid var(--red)", borderRadius: "var(--radius)", padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#991B1B", fontWeight: 600 }}>
            {error}
          </div>
        )}

        {step === "packages" && (
          isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {packages.map((p) => (
                <button key={p.key} onClick={() => handleSelectPackage(p.key)}
                  className="card" style={{ padding: 16, cursor: "pointer", borderColor: p.key === "popular" ? "var(--primary)" : undefined }}>
                  {p.key === "popular" ? (
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", marginBottom: 4 }}>
                      POPULAR
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                      {p.label}
                    </div>
                  )}
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{p.credits.toLocaleString()}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>${p.amount_usd.toFixed(2)}</div>
                </button>
              ))}
            </div>
          )
        )}

        {step === "card" && pkg && (
          <>
            <div style={{ marginBottom: 10, padding: "8px 12px", background: "var(--bg-dark)", borderRadius: "var(--radius)", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
              <span>{pkg.label} ({pkg.credits.toLocaleString()} credits)</span>
              <span style={{ fontWeight: 700 }}>${pkg.amount_usd.toFixed(2)}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              <input className="input" placeholder="Card number" value={cardNumber} onChange={(e) => setCardNumber(formatCard(e.target.value))} maxLength={19} autoComplete="cc-number" />
              <div style={{ display: "flex", gap: 10 }}>
                <input className="input" placeholder="MM / YY" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} maxLength={7} autoComplete="cc-exp" style={{ flex: 1 }} />
                <input className="input" placeholder="CVV" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} autoComplete="cc-csc" style={{ flex: 1 }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setStep("packages"); setError(""); }} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Back</button>
              <button onClick={handlePay} disabled={encrypting} className="btn btn-primary" style={{ flex: 1 }}>
                {encrypting ? "Processing..." : `Pay $${pkg.amount_usd.toFixed(2)}`}
              </button>
            </div>
          </>
        )}

        <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 14, textAlign: "center" }}>
          Secured by Flutterwave. We never store your card details.
        </p>
      </div>
    </div>
  );
}
