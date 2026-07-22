"use client";

import { Sidebar } from "@/components/dashboard/Sidebar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content">
        <div className="dashboard-mobile-header">
          <Sidebar.Hamburger />
        </div>
        {children}
      </div>
    </div>
  );
}
