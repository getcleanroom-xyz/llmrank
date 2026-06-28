"use client";

import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from "recharts";

interface HistoryPoint { date: string; visibility_score: number; mention_rate: number; }

export function ScoreHistoryChart({ data }: { data: HistoryPoint[] }) {
  if (!data || data.length < 2) return <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "20px 0", textAlign: "center", fontWeight: 600 }}>{data?.length === 1 ? "Run another scan for trends." : "No history yet."}</div>;

  const formatted = data.map((d) => ({ ...d, label: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }));

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={formatted} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-muted)", fontWeight: 600 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: "var(--surface)", border: "2px solid var(--border)", borderRadius: "var(--radius)", fontSize: 11, fontWeight: 600, boxShadow: "var(--shadow)" }} />
        <Line type="monotone" dataKey="visibility_score" stroke="var(--primary)" strokeWidth={2} dot={{ fill: "var(--primary)", r: 3, stroke: "var(--border)", strokeWidth: 1.5 }} activeDot={{ r: 5 }} name="Visibility" />
        <Line type="monotone" dataKey="mention_rate" stroke="var(--green)" strokeWidth={2} dot={{ fill: "var(--green)", r: 3, stroke: "var(--border)", strokeWidth: 1.5 }} activeDot={{ r: 5 }} name="Mentions" />
      </LineChart>
    </ResponsiveContainer>
  );
}
