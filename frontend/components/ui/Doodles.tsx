/** Reusable hand-drawn SVG doodle components for the neobrutalist theme. */

export function PushPin({ style }: { style?: React.CSSProperties }) {
  return (
    <svg width="18" height="22" viewBox="0 0 18 22" fill="none" style={{ position: "absolute", top: -10, left: 14, zIndex: 2, ...style }}>
      <ellipse cx="9" cy="4.5" rx="4.5" ry="4.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.2" />
      <rect x="7" y="9" width="3" height="6" rx="0.5" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.2" />
    </svg>
  );
}

export function Scribble({ color = "var(--primary)", width = 80, style }: { color?: string; width?: number; style?: React.CSSProperties }) {
  return (
    <svg width={width} height="8" viewBox="0 0 80 8" fill="none" style={{ display: "block", ...style }}>
      <path d="M0 4 Q8 0 16 5 Q24 8 32 2 Q40 0 48 5 Q56 8 64 3 Q72 0 80 4" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Squiggle({ color = "var(--text-muted)", width = 140, style }: { color?: string; width?: number; style?: React.CSSProperties }) {
  return (
    <svg width={width} height="12" viewBox="0 0 140 12" fill="none" style={{ display: "block", ...style }}>
      <path d="M5 6 Q15 2 30 6 Q45 10 60 6 Q75 2 90 6 Q105 10 120 6 Q130 2 138 6" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function DottedLine({ color = "var(--text-muted)", width = 120, style }: { color?: string; width?: number; style?: React.CSSProperties }) {
  return (
    <svg width={width} height="4" viewBox="0 0 120 4" fill="none" style={{ display: "block", ...style }}>
      <line x1="0" y1="2" x2="120" y2="2" stroke={color} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
    </svg>
  );
}

export function HandArrow({ color = "var(--primary)", style }: { color?: string; style?: React.CSSProperties }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ ...style }}>
      <path d="M5 19 L12 12 M12 12 L8 8 M12 12 L17 10" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function DoodleDivider({ colors, style }: { colors?: string[]; style?: React.CSSProperties }) {
  const cols = colors ?? ["var(--primary)", "#3B82F6", "#22C55E", "#A855F7"];
  return (
    <svg width="200" height="16" viewBox="0 0 200 16" fill="none" style={{ display: "block", ...style }}>
      <path d="M5 8 Q20 2 40 8 Q60 14 80 8 Q100 2 120 8 Q140 14 160 8 Q175 2 195 8" stroke={cols[0]} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="100" cy="10" r="3" stroke={cols[1]} strokeWidth="1.5" fill="none" />
      <circle cx="45" cy="6" r="2" stroke={cols[2]} strokeWidth="1.5" fill="none" />
      <circle cx="155" cy="8" r="2" stroke={cols[3]} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function Cross({ color = "var(--text-muted)", style }: { color?: string; style?: React.CSSProperties }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ ...style }}>
      <path d="M4 4 L12 12 M12 4 L4 12" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Star({ color = "var(--primary)", style }: { color?: string; style?: React.CSSProperties }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ ...style }}>
      <path d="M8 2 L10 6 L14 6 L11 9 L12 13 L8 10 L4 13 L5 9 L2 6 L6 6 Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WavySeparator({ color = "var(--text-muted)", style }: { color?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ textAlign: "center", margin: "12px 0", opacity: 0.2, ...style }}>
      <svg width="200" height="16" viewBox="0 0 200 16" fill="none">
        <path d="M5 8 Q20 2 40 8 Q60 14 80 8 Q100 2 120 8 Q140 14 160 8 Q175 2 195 8" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <circle cx="100" cy="10" r="3" stroke={color} strokeWidth="1.5" fill="none" />
        <circle cx="50" cy="6" r="2" stroke={color} strokeWidth="1.5" fill="none" />
        <circle cx="150" cy="8" r="2" stroke={color} strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
}
