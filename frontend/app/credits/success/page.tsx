"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyPayment } from "@/lib/api";

type State =
  | { status: "loading" }
  | { status: "success"; credits: number }
  | { status: "already_credited" }
  | { status: "failed"; reason: string }
  | { status: "error"; message: string };

export default function CreditsSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const status = searchParams.get("status");
    const transactionId = searchParams.get("transaction_id");

    if (!transactionId || status !== "successful") {
      const reason = status === "cancelled" ? "Payment was cancelled." : "Payment was not successful.";
      setState({ status: "failed", reason });
      return;
    }

    verifyPayment(transactionId)
      .then((res: Record<string, unknown>) => {
        const s = res.status as string;
        if (s === "successful") {
          setState({ status: "success", credits: (res.credits_granted as number) ?? 0 });
        } else if (s === "already_credited") {
          setState({ status: "already_credited" });
        } else {
          setState({ status: "failed", reason: "Payment verification did not confirm success." });
        }
      })
      .catch((err) => {
        setState({ status: "error", message: err instanceof Error ? err.message : "Verification failed" });
      });
  }, [searchParams]);

  return (
    <main className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: "0 var(--page-px)" }}>
      <div className="card" style={{ maxWidth: 400, width: "100%", padding: 32, textAlign: "center" }}>
        {state.status === "loading" && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Verifying payment...</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Please wait while we confirm your payment.</p>
          </>
        )}

        {state.status === "success" && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Payment successful!</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              {state.credits > 0
                ? `Credits granted: ${state.credits.toLocaleString()}. You can now start scanning.`
                : "Your credits have been added. You can now start scanning."}
            </p>
            <button className="btn btn-primary" onClick={() => router.push("/brands")}>
              Go to Dashboard
            </button>
          </>
        )}

        {state.status === "already_credited" && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>ℹ️</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Already credited</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              This payment has already been processed.
            </p>
            <button className="btn btn-primary" onClick={() => router.push("/brands")}>
              Go to Dashboard
            </button>
          </>
        )}

        {(state.status === "failed" || state.status === "error") && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Payment failed</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              {state.status === "failed" ? state.reason : state.message}
            </p>
            <button className="btn btn-secondary" onClick={() => router.push("/brands")}>
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </main>
  );
}
