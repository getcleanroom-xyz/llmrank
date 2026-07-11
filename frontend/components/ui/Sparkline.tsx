"use client";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "var(--text)",
  showDots = true,
}: SparklineProps) {
  if (!data.length) {
    return (
      <div style={{
        width, height, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, color: "var(--text-muted)",
      }}>
        -
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((val, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * (width - padding * 2);
    const y = padding + (1 - (val - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Determine color based on trend
  const first = data[0];
  const last = data[data.length - 1];
  const trend = last - first;
  const strokeColor = trend > 0 ? "#22C55E" : trend < 0 ? "#EF4444" : color;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dots */}
      {showDots && points.length <= 10 && points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="2"
          fill={i === points.length - 1 ? strokeColor : "var(--surface)"}
          stroke={strokeColor}
          strokeWidth="1"
        />
      ))}
      {/* End dot highlighted */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="3"
          fill={strokeColor}
        />
      )}
    </svg>
  );
}
