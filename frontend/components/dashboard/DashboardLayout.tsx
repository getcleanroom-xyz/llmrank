"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ChatWidget } from "@/components/ChatWidget";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { brandId } = useParams<{ brandId: string }>();

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content">
        <div className="dashboard-mobile-header">
          <Link href="/" style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", textDecoration: "none", lineHeight: 1, flexShrink: 0 }}>
            llm<span style={{ background: "var(--primary)", padding: "0 3px", border: "1.5px solid var(--border)" }}>ranked</span>
          </Link>
          <Sidebar.Hamburger />
        </div>
        {children}
      </div>
      {brandId && <ChatWidget brandId={brandId} />}
    </div>
  );
}
