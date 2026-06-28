import { useState, useRef, useEffect, type ReactNode } from "react";

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({ value, onValueChange, options, placeholder, disabled, className = "" }: SelectProps) {
  return (
    <select
      className={`bu-select ${className}`}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
