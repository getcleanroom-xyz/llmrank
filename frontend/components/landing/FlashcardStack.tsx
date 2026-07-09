"use client";

import { useState } from "react";

interface QaItem {
  q: string;
  a: string;
}

const COLORS = [
  { bg: "#FFF9DB", accent: "var(--primary)" },
  { bg: "#DBEAFF", accent: "#3B82F6" },
  { bg: "#E6F9ED", accent: "#22C55E" },
  { bg: "#F3E8FF", accent: "#A855F7" },
  { bg: "#FFE8DB", accent: "#F97316" },
  { bg: "#FFF9DB", accent: "var(--primary)" },
];

export function FlashcardStack({ items }: { items: QaItem[] }) {
  const [active, setActive] = useState<number | null>(null);

  const handleClick = (i: number) => {
    setActive(active === i ? null : i);
  };

  return (
    <section style={{ paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <h2
          style={{
            fontFamily: "var(--font-hand), Caveat, cursive",
            fontSize: "clamp(24px, 3.5vw, 30px)",
            fontWeight: 700,
            margin: 0,
            lineHeight: 1,
            transform: "rotate(-0.4deg)",
          }}
        >
          Questions people ask us
        </h2>
        <svg width="40" height="10" viewBox="0 0 40 10" fill="none">
          <path d="M0 5 Q6 2 12 6 Q18 9 24 4 Q30 1 40 7" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      {/* Flashcard stack container */}
      <div style={{ position: "relative", maxWidth: 640 }}>
        {active !== null ? (
          <>
            {/* Active card — full size, on top */}
            {(() => {
              const item = items[active];
              const c = COLORS[active % COLORS.length];
              return (
                <div
                  key={`active-${active}`}
                  style={{
                    background: c.bg,
                    border: "2px solid var(--border)",
                    borderRadius: "var(--radius)",
                    boxShadow: "5px 5px 0 #1A1A1A",
                    position: "relative",
                    zIndex: items.length + 1,
                    transform: "rotate(-0.3deg)",
                    cursor: "pointer",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  }}
                  onClick={() => setActive(null)}
                >
                  {/* Pushpin */}
                  <svg width="18" height="22" viewBox="0 0 18 22" fill="none" style={{ position: "absolute", top: -10, left: 16, zIndex: 2 }}>
                    <ellipse cx="9" cy="4.5" rx="4.5" ry="4.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.5" />
                    <rect x="7" y="9" width="4" height="7" rx="1" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.5" />
                  </svg>

                  {/* Question */}
                  <div
                    style={{
                      padding: "18px 20px 10px",
                      fontFamily: "var(--font-hand), Caveat, cursive",
                      fontSize: "clamp(22px, 3.2vw, 28px)",
                      fontWeight: 700,
                      lineHeight: 1.2,
                      borderBottom: "2px solid var(--border)",
                      marginTop: 4,
                    }}
                  >
                    {item.q}
                  </div>

                  {/* Answer */}
                  <div
                    style={{
                      padding: "14px 20px 20px",
                      fontSize: "clamp(16px, 2vw, 19px)",
                      lineHeight: 1.7,
                      fontFamily: "var(--font-serif), Georgia, serif",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {/* Scribble accent above answer */}
                    <svg width="80%" height="6" viewBox="0 0 120 6" preserveAspectRatio="none" style={{ display: "block", marginBottom: 12 }}>
                      <path d="M0 3 Q8 0 16 4 Q24 6 32 2 Q40 0 48 5 Q56 6 64 2 Q72 0 80 4 Q88 6 96 2 Q104 0 112 4 Q120 3 120 2" fill="none" stroke={c.accent} strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    {item.a}
                  </div>
                </div>
              );
            })()}

            {/* Stacked cards beneath */}
            <div style={{ position: "relative", marginTop: -4 }}>
              {items.map((item, i) => {
                if (i === active) return null;
                const c = COLORS[i % COLORS.length];
                const stackDepth = active !== null ? Math.min(i, items.length - 1) : 0;
                const isAfterActive = i > active;

                return (
                  <div
                    key={i}
                    style={{
                      background: c.bg,
                      border: "2px solid var(--border)",
                      borderRadius: "var(--radius)",
                      padding: "12px 18px",
                      cursor: "pointer",
                      position: "relative",
                      zIndex: items.length - stackDepth,
                      transform: `rotate(${i % 2 === 0 ? "-0.5deg" : "0.4deg"})`,
                      marginTop: isAfterActive && i === active + 1 ? 8 : -6,
                      boxShadow: "2px 2px 0 #1A1A1A",
                      transition: "margin-top 0.25s ease, transform 0.15s",
                    }}
                    onClick={() => handleClick(i)}
                  >
                    {/* Tiny pushpin */}
                    <svg width="12" height="16" viewBox="0 0 12 16" fill="none" style={{ position: "absolute", top: -7, left: 10, zIndex: 1 }}>
                      <ellipse cx="6" cy="3.5" rx="3" ry="3" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1" />
                      <rect x="4.5" y="6" width="3" height="5" rx="0.5" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1" />
                    </svg>
                    <div
                      style={{
                        fontFamily: "var(--font-hand), Caveat, cursive",
                        fontSize: 16,
                        fontWeight: 700,
                        lineHeight: 1.2,
                        opacity: 0.7,
                      }}
                    >
                      {item.q}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* All cards stacked when nothing is active */
          <>
            {items.map((item, i) => {
              const c = COLORS[i % COLORS.length];
              const stackOffset = (items.length - 1 - i) * 4;

              return (
                <div
                  key={i}
                  style={{
                    background: c.bg,
                    border: "2px solid var(--border)",
                    borderRadius: "var(--radius)",
                    padding: "14px 20px",
                    cursor: "pointer",
                    position: "relative",
                    zIndex: i + 1,
                    transform: `rotate(${i % 2 === 0 ? "-0.4deg" : "0.3deg"}) translateY(${stackOffset}px)`,
                    marginTop: i === 0 ? 0 : -6,
                    boxShadow: "3px 3px 0 #1A1A1A",
                    transition: "transform 0.2s ease, box-shadow 0.15s",
                  }}
                  onClick={() => handleClick(i)}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "4px 4px 0 #1A1A1A"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "3px 3px 0 #1A1A1A"; }}
                >
                  {/* Pushpin */}
                  <svg width="14" height="18" viewBox="0 0 14 18" fill="none" style={{ position: "absolute", top: -8, left: 12, zIndex: 1 }}>
                    <ellipse cx="7" cy="3.5" rx="3.5" ry="3.5" fill="#EF4444" stroke="#1A1A1A" strokeWidth="1.2" />
                    <rect x="5.5" y="7" width="3" height="5" rx="0.5" fill="#DC2626" stroke="#1A1A1A" strokeWidth="1.2" />
                  </svg>
                  <div
                    style={{
                      fontFamily: "var(--font-hand), Caveat, cursive",
                      fontSize: "clamp(17px, 2.5vw, 20px)",
                      fontWeight: 700,
                      lineHeight: 1.25,
                      marginTop: 2,
                    }}
                  >
                    {item.q}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
