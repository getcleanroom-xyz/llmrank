"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Sidebar() {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation" style={{ width: 48, background: "var(--surface)", borderRight: "2px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 4, flexShrink: 0, position: "sticky", top: 0, height: "100vh", zIndex: 10 }}>
      <Link href="/" style={{ textDecoration: "none", fontSize: 12, fontWeight: 800, color: "var(--text)", marginBottom: 12, letterSpacing: "-0.03em" }}>
        llm<span style={{ background: "var(--primary)", padding: "0 2px", border: "1px solid var(--border)" }}>r</span>
      </Link>
      <Link href="/" aria-label="Brands" title="Brands" style={{ width: 32, height: 32, borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: path === "/" ? "var(--text)" : "var(--text-muted)", background: path === "/" ? "var(--primary)" : "transparent", border: path === "/" ? "1.5px solid var(--border)" : "1.5px solid transparent", textDecoration: "none" }}>B</Link>
    </nav>
  );
}
