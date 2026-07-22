"use client";

import React from "react";

interface Feature {
  title: string;
  desc: string;
  color: string;
  accent: string;
  image: string;
  size: "large" | "medium" | "small" | "wide";
}

export function FeaturesGrid({ features }: { features: Feature[] }) {
  return (
    <div
      className="features-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, 1fr)",
        gridAutoRows: "minmax(180px, auto)",
        gap: 16,
      }}
    >
      {features.map((feature, i) => {
        let gridStyle: React.CSSProperties = {};
        let rotate = "0deg";

        if (feature.size === "large") {
          gridStyle = { gridColumn: "span 7", gridRow: "span 2" };
          rotate = "-0.5deg";
        } else if (feature.size === "medium" && i === 1) {
          gridStyle = { gridColumn: "span 5", gridRow: "span 2" };
          rotate = "0.8deg";
        } else if (feature.size === "medium" && i === 2) {
          gridStyle = { gridColumn: "span 5", gridRow: "span 2" };
          rotate = "-0.3deg";
        } else if (feature.size === "small") {
          gridStyle = { gridColumn: "span 6", gridRow: "span 1" };
          rotate = i % 2 === 0 ? "0.4deg" : "-0.6deg";
        } else if (feature.size === "wide") {
          gridStyle = { gridColumn: "span 12", gridRow: "span 1" };
          rotate = "-0.2deg";
        }

        return (
          <div
            key={feature.title}
            className="card sketchy"
            style={{
              ...gridStyle,
              background: feature.color,
              border: "2px solid var(--border)",
              borderRadius: "var(--radius)",
              boxShadow: "4px 4px 0 #1A1A1A",
              transform: `rotate(${rotate})`,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              cursor: "default",
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "rotate(0deg) translateY(-2px)";
              e.currentTarget.style.boxShadow = "6px 6px 0 #1A1A1A";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = `rotate(${rotate})`;
              e.currentTarget.style.boxShadow = "4px 4px 0 #1A1A1A";
            }}
          >
            {/* Image area */}
            <div
              style={{
                flex: 1,
                minHeight:
                  feature.size === "large"
                    ? 260
                    : feature.size === "medium"
                      ? 180
                      : feature.size === "wide"
                        ? 200
                        : 140,
                background: `linear-gradient(135deg, ${feature.color} 0%, ${feature.color}dd 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
                padding: feature.size === "large" ? 16 : 12,
              }}
            >
              {/* Feature image */}
              {feature.image && (
                <img
                  src={feature.image}
                  alt={feature.title}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    borderRadius: 6,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                />
              )}

              {/* Decorative elements (shown when no image) */}
              {!feature.image && (
                <svg
                  width="100%"
                  height="100%"
                  style={{ position: "absolute", top: 0, left: 0, opacity: 0.15 }}
                >
                  <circle cx="80%" cy="20%" r="60" fill={feature.accent} />
                  <circle cx="20%" cy="80%" r="40" fill={feature.accent} />
                  <path
                    d="M0 50 Q25 30 50 55 Q75 80 100 45"
                    stroke={feature.accent}
                    strokeWidth="2"
                    fill="none"
                    opacity="0.5"
                  />
                </svg>
              )}

              {/* Pushpin on large card */}
              {feature.size === "large" && (
                <svg
                  width="18"
                  height="22"
                  viewBox="0 0 18 22"
                  fill="none"
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 16,
                    zIndex: 2,
                  }}
                >
                  <ellipse
                    cx="9"
                    cy="4.5"
                    rx="4.5"
                    ry="4.5"
                    fill="#EF4444"
                    stroke="#1A1A1A"
                    strokeWidth="1.5"
                  />
                  <rect
                    x="7"
                    y="9"
                    width="4"
                    height="7"
                    rx="1"
                    fill="#DC2626"
                    stroke="#1A1A1A"
                    strokeWidth="1.5"
                  />
                </svg>
              )}
            </div>

            {/* Text content */}
            <div
              style={{
                padding:
                  feature.size === "large" ? "18px 20px" : "14px 16px",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-hand), Caveat, cursive",
                  fontSize:
                    feature.size === "large"
                      ? 26
                      : feature.size === "medium"
                        ? 22
                        : 18,
                  fontWeight: 700,
                  marginBottom: 6,
                  lineHeight: 1.1,
                  color: "var(--text)",
                }}
              >
                {feature.title}
              </div>
              <div
                style={{
                  fontSize: feature.size === "large" ? 15 : 13,
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                  fontFamily: "var(--font-serif), Georgia, serif",
                }}
              >
                {feature.desc}
              </div>
            </div>

            {/* Gold accent line */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 4,
                background: feature.accent,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
