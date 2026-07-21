import { Suspense } from "react";
import { BrandDashboardClient } from "@/components/dashboard/BrandDashboardClient";
import { DashboardSkeleton } from "@/components/dashboard/Skeletons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Brand Dashboard | LLMRanked",
  description: "Track your brand's AI visibility across ChatGPT, Gemini, Claude, and more.",
};

export default async function BrandDashboardPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <BrandDashboardClient brandId={brandId} />
    </Suspense>
  );
}
