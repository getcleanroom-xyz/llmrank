export const queryKeys = {
  brands: ["brands"] as const,
  queries: (brandId: string) => ["queries", brandId] as const,
  scans: (brandId: string) => ["scans", brandId] as const,
  dashboard: (brandId: string) => ["dashboard", brandId] as const,
  drilldown: (brandId: string, queryId: string) => ["drilldown", brandId, queryId] as const,
  credits: ["credits"] as const,
  creditPackages: ["creditPackages"] as const,
  user: ["user"] as const,
  campaigns: ["campaigns"] as const,
  campaign: (id: string) => ["campaigns", id] as const,
  adminUsers: (search?: string) => ["adminUsers", search ?? ""] as const,
  adminStats: ["adminStats"] as const,
};
