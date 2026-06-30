"use client";

import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useAdminCampaign } from "@/lib/hooks";
import { CampaignEditor } from "@/components/admin/CampaignEditor";

export function CampaignDetail() {
  const params = useParams();
  const { user } = useAuth();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const { data: campaign, isLoading, error: loadError } = useAdminCampaign(id);

  if (!user) return null;

  if (isLoading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading campaign...</div>
      </div>
    );
  }

  const error = loadError ? (loadError instanceof Error ? loadError.message : "Failed to load campaign") : null;

  if (error || !campaign) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div className="card" style={{ color: "var(--red)", fontSize: 13, fontWeight: 600 }}>
          {error || "Campaign not found"}
        </div>
      </div>
    );
  }

  return <CampaignEditor existing={campaign} />;
}
