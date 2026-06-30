"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { adminGetCampaign, type AdminCampaignDetail } from "@/lib/api";
import { CampaignEditor } from "@/components/admin/CampaignEditor";

export function CampaignDetail() {
  const params = useParams();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<AdminCampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !params.id) return;
    const id = typeof params.id === "string" ? params.id : params.id[0];
    adminGetCampaign(id)
      .then(setCampaign)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load campaign"))
      .finally(() => setLoading(false));
  }, [user, params.id]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading campaign...</div>
      </div>
    );
  }

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
