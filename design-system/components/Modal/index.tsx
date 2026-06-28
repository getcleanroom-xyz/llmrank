import { useEffect, useCallback } from "react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div className="bu-modal-overlay" onClick={onClose}>
      <div className="bu-modal" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="bu-modal-header">
            <span className="bu-font-bold bu-text-md">{title}</span>
            <button onClick={onClose} className="bu-btn bu-btn-ghost bu-btn-xs">✕</button>
          </div>
        )}
        <div className="bu-modal-body">{children}</div>
        {footer && <div className="bu-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
