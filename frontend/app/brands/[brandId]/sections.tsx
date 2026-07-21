import { getServerDashboard, getServerQueries } from "@/lib/api/server";
import { DashboardSkeleton, KpiCardsSkeleton, TableSkeleton } from "@/components/dashboard/Skeletons";

export async function DashboardHeaderSection({
  brandId,
  cookieHeader,
}: {
  brandId: string;
  cookieHeader: string;
}) {
  const data = await getServerDashboard(brandId, cookieHeader);
  if (!data) return <DashboardSkeleton />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
      {data.active_scan && (
        <span className="pill pill-gold" style={{ fontSize: 10, flexShrink: 0 }}>Scanning</span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
        {(data.active_scan ?? data.latest_scan)?.completed_at && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
            {new Date((data.active_scan ?? data.latest_scan)!.completed_at!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );
}

export async function OverviewSection({
  brandId,
  cookieHeader,
}: {
  brandId: string;
  cookieHeader: string;
}) {
  const data = await getServerDashboard(brandId, cookieHeader);
  if (!data) return <KpiCardsSkeleton />;
  return null;
}

export async function QueriesSection({
  brandId,
  cookieHeader,
}: {
  brandId: string;
  cookieHeader: string;
}) {
  const queries = await getServerQueries(brandId, cookieHeader);
  if (!queries || queries.length === 0) return <TableSkeleton rows={3} />;
  return null;
}

export async function ScansSection({
  brandId,
  cookieHeader,
}: {
  brandId: string;
  cookieHeader: string;
}) {
  const data = await getServerDashboard(brandId, cookieHeader);
  if (!data) return <TableSkeleton rows={5} />;
  return null;
}

export async function CompetitorsSection({
  brandId,
  cookieHeader,
}: {
  brandId: string;
  cookieHeader: string;
}) {
  const data = await getServerDashboard(brandId, cookieHeader);
  if (!data) return <TableSkeleton rows={4} />;
  return null;
}
