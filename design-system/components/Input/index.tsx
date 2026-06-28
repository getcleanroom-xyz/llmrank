import { InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  size?: "sm" | "md" | "lg";
  label?: string;
  helper?: string;
  error?: string;
}

const sizeMap = { sm: "bu-input-sm", md: "", lg: "bu-input-lg" };

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ size = "md", label, helper, error, className = "", id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    return (
      <div>
        {label && <label htmlFor={inputId} className="bu-label">{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={`bu-input ${sizeMap[size]} ${error ? "border-[var(--bu-danger)]" : ""} ${className}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helper ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && <div id={`${inputId}-error`} className="bu-helper bu-helper-error">{error}</div>}
        {!error && helper && <div id={`${inputId}-helper`} className="bu-helper">{helper}</div>}
      </div>
    );
  }
);
Input.displayName = "Input";
