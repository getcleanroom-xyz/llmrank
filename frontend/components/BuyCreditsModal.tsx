"use client";

import { useState, useEffect, useRef } from "react";
import { useCreditPackages, useCreateCheckout } from "@/lib/hooks";
import { getEncryptionKey } from "@/lib/api";
import { encryptAES, generateNonce } from "@/lib/encrypt";
import { useToast } from "@/components/ui/Toast";

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
  const [encKey, setEncKey] = useState("");
  const prevOpen = useRef(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (open && !prevOpen.current) {
      setStep("packages");
      setCardNumber("");
      setExpiry("");
      setCvv("");
      setEncKey("");
      getEncryptionKey().then((r) => setEncKey(r.key)).catch(() => addToast("Failed to load encryption key", "error"));
    }
    prevOpen.current = open;
  }, [open, addToast]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSelectPackage = (pkg: string) => {
    setSelectedPkg(pkg);
    setStep("card");
  };

  const handlePay = async () => {
    const num = cardNumber.replace(/\s/g, "");
    if (num.length < 13 || num.length > 19) { addToast("Invalid card number", "error"); return; }

    const [m, y] = expiry.split("/").map((s) => s.trim());
    if (!m || !y || m.length !== 2 || y.length !== 2) { addToast("Invalid expiry (MM/YY)", "error"); return; }

    if (cvv.length < 3 || cvv.length > 4) { addToast("Invalid CVV", "error"); return; }

    if (!encKey) { addToast("Encryption key not loaded", "error"); return; }

    setEncrypting(true);

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
        addToast("Redirecting to payment...", "info");
        window.location.replace(session.checkout_url);
      } else {
        addToast("No redirect URL returned. Try again.", "error");
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Payment failed", "error");
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

  const receiptStyle: React.CSSProperties = {
    position: "relative",
    background: "#FFFEF5",
    border: "1.5px dashed #C8C4BC",
    borderRadius: 2,
    overflow: "hidden",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)" }} onClick={onClose} />
      <div style={{ ...receiptStyle, width: "100%", maxWidth: 420, margin: "0 16px", padding: "28px 24px 24px", zIndex: 10 }}>
        {/* Torn top edge */}
        <svg width="100%" height="8" viewBox="0 0 200 8" preserveAspectRatio="none" style={{ position: "absolute", top: -4, left: 0, right: 0 }}>
          <path d="M0 8 L5 2 L10 6 L15 1 L20 5 L25 2 L30 7 L35 1 L40 6 L45 3 L50 7 L55 1 L60 5 L65 2 L70 6 L75 1 L80 5 L85 3 L90 7 L95 2 L100 6 L105 1 L110 5 L115 3 L120 7 L125 1 L130 6 L135 2 L140 5 L145 3 L150 7 L155 1 L160 6 L165 2 L170 5 L175 3 L180 7 L185 1 L190 6 L195 2 L200 5 L200 8 Z" fill="#FFFEF5" />
        </svg>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 24, fontWeight: 700, color: "#1A1A1A" }}>
            {step === "packages" ? "Buy Credits" : "Card details"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 18, padding: 0 }}>x</button>
        </div>

        <div style={{ borderTop: "1px dashed #D4D0C8", margin: "0 0 14px" }} />

        {step === "packages" && (
          isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 100 }} />)}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {packages.map((p) => (
                <button key={p.key} onClick={() => handleSelectPackage(p.key)}
                  style={{
                    ...receiptStyle,
                    padding: "16px 14px",
                    cursor: "pointer",
                    textAlign: "center",
                    transform: `rotate(${p.key === "popular" ? "-0.5deg" : "0.4deg"})`,
                    boxShadow: "1px 2px 4px rgba(0,0,0,0.06)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "rotate(0deg) translateY(-2px)"; e.currentTarget.style.boxShadow = "2px 4px 8px rgba(0,0,0,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${p.key === "popular" ? "-0.5deg" : "0.4deg"})`; e.currentTarget.style.boxShadow = "1px 2px 4px rgba(0,0,0,0.06)"; }}
                >
                  {p.key === "popular" ? (
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--primary)", marginBottom: 6, letterSpacing: "0.1em" }}>POPULAR</div>
                  ) : (
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{p.label}</div>
                  )}
                  <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>{p.credits.toLocaleString()} credits</div>
                  <div style={{ borderTop: "1px dashed #D4D0C8", margin: "0 0 8px" }} />
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#1A1A1A", lineHeight: 1 }}>${p.amount_usd.toFixed(2)}</div>
                </button>
              ))}
            </div>
          )
        )}

        {step === "card" && pkg && (
          <>
            {/* Selected package receipt */}
            <div style={{ ...receiptStyle, padding: "12px 14px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Selected plan</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{pkg.label}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{pkg.credits.toLocaleString()} credits</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>${pkg.amount_usd.toFixed(2)}</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              <input
                className="input"
                placeholder="Card number"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCard(e.target.value))}
                maxLength={19}
                autoComplete="cc-number"
                style={{ fontFamily: "'Courier New', Courier, monospace", letterSpacing: "0.1em" }}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <input className="input" placeholder="MM / YY" value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))} maxLength={7} autoComplete="cc-exp" style={{ flex: 1, fontFamily: "'Courier New', Courier, monospace" }} />
                <input className="input" placeholder="CVV" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} maxLength={4} autoComplete="cc-csc" style={{ flex: 1, fontFamily: "'Courier New', Courier, monospace" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep("packages")} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Back</button>
              <button onClick={handlePay} disabled={encrypting} className="btn btn-primary" style={{ flex: 1, fontFamily: "'Courier New', Courier, monospace" }}>
                {encrypting ? "Processing..." : `Pay $${pkg.amount_usd.toFixed(2)}`}
              </button>
            </div>
          </>
        )}

        <div style={{ borderTop: "1px dashed #D4D0C8", margin: "16px 0 12px" }} />

        <p style={{ fontSize: 11, color: "#888", textAlign: "center", fontStyle: "italic" }}>
          Secured by Flutterwave. We never store your card details.
        </p>

        {/* Torn bottom edge */}
        <svg width="100%" height="10" viewBox="0 0 200 10" preserveAspectRatio="none" style={{ position: "absolute", bottom: -5, left: 0, right: 0 }}>
          <path d="M0 0 L5 6 L10 2 L15 7 L20 3 L25 6 L30 1 L35 7 L40 3 L45 5 L50 1 L55 7 L60 3 L65 6 L70 2 L75 7 L80 3 L85 5 L90 1 L95 6 L100 2 L105 7 L110 3 L115 5 L120 1 L125 6 L130 2 L135 7 L140 3 L145 5 L150 1 L155 7 L160 3 L165 6 L170 2 L175 5 L180 1 L185 6 L190 2 L195 5 L200 3 L200 0 Z" fill="#FFFEF5" />
        </svg>
      </div>
    </div>
  );
}
