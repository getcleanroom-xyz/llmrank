"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { createPortal } from "react-dom";

type ToastType = "info" | "success" | "error" | "progress";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  progress?: number;
  dismissible?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, options?: { progress?: number; dismissible?: boolean }) => string;
  updateToast: (id: string, updates: Partial<Pick<Toast, "message" | "type" | "progress">>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "info", options?: { progress?: number; dismissible?: boolean }) => {
      const id = `toast-${++toastCounter}`;
      const toast: Toast = {
        id,
        message,
        type,
        progress: options?.progress,
        dismissible: options?.dismissible ?? type !== "progress",
      };
      setToasts((prev) => [...prev, toast]);
      if (type !== "progress") {
        setTimeout(() => removeToast(id), 5000);
      }
      return id;
    },
    [removeToast]
  );

  const updateToast = useCallback(
    (id: string, updates: Partial<Pick<Toast, "message" | "type" | "progress">>) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      );
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, updateToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        bottom: 80,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
        maxWidth: 360,
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>,
    document.body
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(onDismiss, 300);
  };

  const colors: Record<ToastType, { bg: string; border: string; icon: string }> = {
    info: { bg: "#DBEAFF", border: "#3B82F6", icon: "i" },
    success: { bg: "#E6F9ED", border: "#22C55E", icon: "done" },
    error: { bg: "#FEE2E2", border: "#EF4444", icon: "!" },
    progress: { bg: "#FFF9DB", border: "var(--primary)", icon: "~" },
  };
  const c = colors[toast.type];

  return (
    <div
      style={{
        pointerEvents: "auto",
        background: c.bg,
        border: `2px solid ${c.border}`,
        borderRadius: "var(--radius)",
        boxShadow: "3px 3px 0 #1A1A1A",
        padding: "10px 14px",
        fontFamily: "var(--font-sans), Inter, sans-serif",
        transform: visible && !exiting ? "translateX(0) rotate(-0.5deg)" : "translateX(120%) rotate(1deg)",
        opacity: exiting ? 0 : 1,
        transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative pushpin */}
      <svg width="12" height="16" viewBox="0 0 12 16" fill="none" style={{ position: "absolute", top: -6, left: 8, zIndex: 2 }}>
        <ellipse cx="6" cy="3" rx="3" ry="3" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1" />
        <rect x="4.5" y="6" width="3" height="5" rx="0.5" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1" />
      </svg>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {/* Icon circle */}
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: c.border,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 800,
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          {c.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", lineHeight: 1.4 }}>
            {toast.message}
          </div>

          {/* Progress bar */}
          {toast.type === "progress" && typeof toast.progress === "number" && (
            <div
              style={{
                marginTop: 6,
                height: 4,
                background: "rgba(0,0,0,0.08)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, toast.progress)}%`,
                  background: c.border,
                  borderRadius: 2,
                  transition: "width 0.4s ease",
                }}
              />
            </div>
          )}
        </div>

        {toast.dismissible && (
          <button
            onClick={handleDismiss}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
            }}
          >
            x
          </button>
        )}
      </div>
    </div>
  );
}
