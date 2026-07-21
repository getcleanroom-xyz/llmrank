import { cookies } from "next/headers";
import { Suspense } from "react";
import { getServerDashboard, getServerQueries } from "@/lib/api/server";
import { DashboardSkeleton } from "@/components/dashboard/Skeletons";
import { BrandDashboardClient } from "@/components/dashboard/BrandDashboardClient";

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
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  // Server-side data fetch (best effort — client refetches if this fails)
  const [dashboardData, queriesData] = await Promise.all([
    getServerDashboard(brandId, cookieHeader),
    getServerQueries(brandId, cookieHeader),
  ]);

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <BrandDashboardClient
        brandId={brandId}
        initialData={dashboardData}
        initialQueries={queriesData}
      />
    </Suspense>
  );
}
