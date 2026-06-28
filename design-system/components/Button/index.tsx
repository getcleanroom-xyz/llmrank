import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "danger" | "success" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
}

const variantMap = {
  default: "",
  primary: "bu-btn-primary",
  danger: "bu-btn-danger",
  success: "bu-btn-success",
  ghost: "bu-btn-ghost",
};

const sizeMap = {
  xs: "bu-btn-xs",
  sm: "bu-btn-sm",
  md: "",
  lg: "bu-btn-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "md", className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`bu-btn ${variantMap[variant]} ${sizeMap[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
