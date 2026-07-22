import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
