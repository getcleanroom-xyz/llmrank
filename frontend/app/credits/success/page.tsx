"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useVerifyPayment } from "@/lib/hooks";

type State =
  | { status: "loading" }
  | { status: "success"; credits: number }
  | { status: "already_credited" }
  | { status: "failed"; reason: string }
  | { status: "error"; message: string };

function CreditsSuccessPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifyPayment = useVerifyPayment();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const status = searchParams.get("status");
    const transactionId = searchParams.get("transaction_id");

    if (!transactionId || status !== "successful") {
      const reason = status === "cancelled" ? "Payment was cancelled." : "Payment was not successful.";
      setState({ status: "failed", reason });
      return;
    }

    verifyPayment.mutateAsync(transactionId)
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
  }, [searchParams, verifyPayment]);

  return (
    <main className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: "0 var(--page-px)" }}>
      <div className="card" style={{ maxWidth: 420, width: "100%", padding: 32, textAlign: "center" }}>
        {state.status === "loading" && (
          <>
            <div className="section-label" style={{ marginBottom: 12, fontSize: 12 }}>Verifying payment</div>
            <div className="skeleton" style={{ height: 4, marginBottom: 16 }} />
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Please wait while we confirm your payment with Flutterwave.</p>
          </>
        )}

        {state.status === "success" && (
          <>
            <div style={{ fontSize: 40, fontWeight: 800, color: "#166534", marginBottom: 8 }}>OK</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Payment successful</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              {state.credits > 0
                ? `${state.credits.toLocaleString()} credits granted. You can now start scanning.`
                : "Your credits have been added. You can now start scanning."}
            </p>
            <button className="btn btn-primary" onClick={() => router.push("/brands")}>
              Go to Dashboard
            </button>
          </>
        )}

        {state.status === "already_credited" && (
          <>
            <div style={{ fontSize: 40, fontWeight: 800, color: "var(--primary)", marginBottom: 8 }}>OK</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Already credited</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              This payment has already been processed and credits were granted.
            </p>
            <button className="btn btn-primary" onClick={() => router.push("/brands")}>
              Go to Dashboard
            </button>
          </>
        )}

        {state.status === "failed" && (
          <>
            <div style={{ fontSize: 40, fontWeight: 800, color: "#991B1B", marginBottom: 8 }}>!</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Payment not confirmed</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              {state.reason}
            </p>
            <button className="btn" onClick={() => router.push("/brands")}>
              Back to Dashboard
            </button>
          </>
        )}

        {state.status === "error" && (
          <>
            <div style={{ fontSize: 40, fontWeight: 800, color: "#991B1B", marginBottom: 8 }}>!</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              {state.message}
            </p>
            <button className="btn" onClick={() => router.push("/brands")}>
              Back to Dashboard
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function CreditsSuccessPage() {
  return (
    <Suspense fallback={
      <main className="page" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", padding: "0 var(--page-px)" }}>
        <div className="card" style={{ maxWidth: 420, width: "100%", padding: 32, textAlign: "center" }}>
          <div className="section-label" style={{ marginBottom: 12, fontSize: 12 }}>Loading</div>
          <div className="skeleton" style={{ height: 4, marginBottom: 16 }} />
        </div>
      </main>
    }>
      <CreditsSuccessPageInner />
    </Suspense>
  );
}
