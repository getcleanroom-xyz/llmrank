import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const metadata = {
  title: "Admin | LLMRank",
  description: "Admin dashboard: manage campaigns and view email stats.",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
