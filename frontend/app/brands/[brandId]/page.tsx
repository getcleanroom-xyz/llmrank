import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard/Skeletons";
import { BrandDashboardClient } from "@/components/dashboard/BrandDashboardClient";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

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
    <DashboardLayout>
      <Suspense fallback={<DashboardSkeleton />}>
        <BrandDashboardClient brandId={brandId} />
      </Suspense>
    </DashboardLayout>
  );
}
