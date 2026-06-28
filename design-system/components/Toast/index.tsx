import { HTMLAttributes } from "react";

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "success" | "danger" | "warning" | "info";
}

const variantMap = {
  success: "bu-toast-success",
  danger: "bu-toast-danger",
  warning: "bu-toast-warning",
  info: "bu-toast-info",
};

export function Toast({ variant = "info", className = "", ...props }: ToastProps) {
  return <div className={`bu-toast ${variantMap[variant]} ${className}`} role="alert" {...props} />;
}
