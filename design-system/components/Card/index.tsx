import { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

const sizeMap = { sm: "bu-card-sm", md: "", lg: "bu-card-lg" };

export function Card({ size = "md", className = "", ...props }: CardProps) {
  return <div className={`bu-card ${sizeMap[size]} ${className}`} {...props} />;
}
