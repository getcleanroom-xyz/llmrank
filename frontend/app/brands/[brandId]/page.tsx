import { BrandDashboardClient } from "@/components/dashboard/BrandDashboardClient";

export const metadata = {
  title: "Brand Dashboard | LLMRank",
  description: "Track your brand's AI visibility across ChatGPT, Gemini, Claude, and more.",
};

export default function BrandDashboardPage() {
  return <BrandDashboardClient />;
}
