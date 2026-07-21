import { cookies } from "next/headers";
import { Suspense } from "react";
import { getServerSession, getServerDashboard, getServerQueries } from "@/lib/api/server";
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

  // Server-side auth check — if it fails, pass null and let client handle redirect
  const user = await getServerSession(cookieHeader);

  // Fetch dashboard data server-side (passes even if auth fails — client will refetch)
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
        user={user}
      />
    </Suspense>
  );
}
