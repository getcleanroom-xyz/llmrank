import { connection } from "next/server";
import { BrandDashboardClient } from "@/components/dashboard/BrandDashboardClient";

export const metadata = {
  title: "Brand Dashboard | LLMRanked",
  description: "Track your brand's AI visibility across ChatGPT, Gemini, Claude, and more.",
};

export default async function BrandDashboardPage() {
  await connection();
  return <BrandDashboardClient />;
}
