"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { AuthModal } from "./AuthModal";

export function AuthButton() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="btn btn-sm"
      >
        {user ? (
          <>
            <div style={{ width: 20, height: 20, borderRadius: "var(--radius)", background: "var(--primary)", border: "1.5px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            <span>{user.display_name}</span>
          </>
        ) : (
          <span>Sign in</span>
        )}
      </button>

      <AuthModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
