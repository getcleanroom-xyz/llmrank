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
        className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] border-2 border-[#333] rounded-lg text-sm text-white hover:border-[#FFD600] transition-colors"
      >
        {user ? (
          <>
            <div className="w-6 h-6 rounded-full bg-[#FFD600] flex items-center justify-center text-xs font-bold text-black">
              {user.display_name.charAt(0).toUpperCase()}
            </div>
            <span className="hidden sm:inline">{user.display_name}</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="hidden sm:inline">Sign in</span>
          </>
        )}
      </button>

      <AuthModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
