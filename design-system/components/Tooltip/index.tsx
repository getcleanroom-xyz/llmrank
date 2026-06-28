import { useState, useRef, useEffect, type ReactNode } from "react";

export interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  return (
    <div className="bu-tooltip-wrapper">
      {children}
      <div className="bu-tooltip" role="tooltip">{content}</div>
    </div>
  );
}
