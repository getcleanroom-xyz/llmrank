"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Markdown from "react-markdown";
import { streamRecommendation, type ChatMessage } from "@/lib/api/recommendations";

function LaiIcon({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Speech bubble shape */}
      <path d="M6 8C6 6.34315 7.34315 5 9 5H31C32.6569 5 34 6.34315 34 8V24C34 25.6569 32.6569 27 31 27H20L12 34V27H9C7.34315 27 6 25.6569 6 24V8Z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* "lai" text — lowercase, handwritten style */}
      <text x="11" y="21" fontFamily="Georgia, serif" fontSize="13" fontWeight="800" fontStyle="italic" fill={color} letterSpacing="-0.5">
        lai
      </text>
    </svg>
  );
}

const QUICK_ACTIONS = [
  { label: "Generate content plan", prompt: "Generate a content plan to improve my AI visibility. Focus on the topics where my competitors beat me." },
  { label: "Fix weakest query", prompt: "Which of my queries is performing worst and how can I improve it?" },
  { label: "Beat top competitor", prompt: "Who is my top competitor and what specific content gaps should I fill to beat them?" },
];

export function ChatWidget({ brandId }: { brandId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setError("");

    try {
      const history = messages.slice(-6);
      let fullResponse = "";
      const assistantMsg: ChatMessage = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMsg]);

      for await (const token of streamRecommendation(brandId, text, history)) {
        fullResponse += token;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: fullResponse };
          return updated;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setStreaming(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 100,
            width: 56, height: 56, borderRadius: "50%",
            background: "var(--primary)", color: "#1A1A1A",
            border: "3px solid var(--border)",
            boxShadow: "3px 3px 0 #1A1A1A",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <LaiIcon size={30} color="#1A1A1A" />
        </button>
      )}

      {/* Chat panel — full screen on mobile, floating on desktop */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "var(--surface)",
            display: "flex", flexDirection: "column",
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: "2px solid var(--border)",
            background: "#FFF9DB", position: "relative",
          }}>
            {/* Hand-drawn underline */}
            <svg width="100%" height="4" viewBox="0 0 400 4" preserveAspectRatio="none" style={{ position: "absolute", bottom: -2, left: 0, right: 0 }}>
              <path d="M0 2 Q20 0 40 3 Q60 4 80 1 Q100 0 120 3 Q140 4 160 1 Q180 0 200 3 Q220 4 240 1 Q260 0 280 3 Q300 4 320 1 Q340 0 360 3 Q380 4 400 2" stroke="var(--primary)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "var(--radius)",
                background: "var(--primary)", border: "2px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><LaiIcon size={22} color="#1A1A1A" /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>lai</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Your visibility copilot</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm" style={{ fontSize: 16 }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", position: "relative" }}>
                {/* Background doodles */}
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ position: "absolute", top: 10, right: 10, opacity: 0.08, pointerEvents: "none" }}>
                  <circle cx="60" cy="60" r="50" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="4 6" />
                  <path d="M30 60 Q60 20 90 60 Q60 100 30 60Z" stroke="var(--primary)" strokeWidth="1" fill="none" />
                </svg>
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ position: "absolute", bottom: 20, left: 10, opacity: 0.06, pointerEvents: "none" }}>
                  <path d="M10 40 Q25 10 40 40 Q55 70 70 40" stroke="var(--primary)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <circle cx="40" cy="40" r="3" fill="var(--primary)" />
                </svg>

                <div style={{
                  width: 56, height: 56, borderRadius: "50%", background: "var(--primary)", margin: "0 auto 16px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "3px solid var(--border)", boxShadow: "3px 3px 0 #1A1A1A",
                }}><LaiIcon size={34} color="#1A1A1A" /></div>
                <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                  Hey, what's on your mind?
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20, fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic" }}>
                  I can see your real scan data. Ask me anything.
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
                  I can analyze your AI visibility, suggest content strategies, and help you beat competitors.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {QUICK_ACTIONS.map((action, i) => (
                    <button
                      key={action.label}
                      onClick={() => send(action.prompt)}
                      style={{
                        padding: "8px 12px", textAlign: "left", cursor: "pointer",
                        fontSize: 14, fontWeight: 600, color: "var(--text)",
                        background: ["#FFF9DB", "#DBEAFF", "#E6F9ED"][i] ?? "#FFF",
                        border: "2px solid var(--border)", borderRadius: "8px 8px 8px 2px",
                        boxShadow: "2px 2px 0 #1A1A1A",
                        fontFamily: "var(--font-hand), Caveat, cursive",
                        transform: `rotate(${i % 2 === 0 ? "-0.5deg" : "0.5deg"})`,
                        transition: "transform 0.15s, box-shadow 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "rotate(0deg) translate(-1px, -1px)"; e.currentTarget.style.boxShadow = "3px 3px 0 #1A1A1A"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${i % 2 === 0 ? "-0.5deg" : "0.5deg"})`; e.currentTarget.style.boxShadow = "2px 2px 0 #1A1A1A"; }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "85%",
                  padding: "10px 14px",
                  fontSize: 13,
                  lineHeight: 1.5,
                  position: "relative",
                  ...(msg.role === "user"
                    ? { background: "var(--primary)", color: "#1A1A1A", border: "2px solid var(--border)", borderRadius: "12px 12px 4px 12px", boxShadow: "2px 2px 0 rgba(0,0,0,0.08)" }
                    : { background: "#FFF", color: "var(--text)", border: "2px solid var(--border)", borderRadius: "12px 12px 12px 4px", boxShadow: "2px 2px 0 rgba(0,0,0,0.08)" }),
                }}>
                  {/* Subtle sketchy corner accent */}
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ position: "absolute", top: -1, [msg.role === "user" ? "right" : "left"]: -1, opacity: 0.15, pointerEvents: "none" }}>
                    <path d={msg.role === "user" ? "M20 0 Q15 5 20 20" : "M0 0 Q5 5 0 20"} stroke="var(--text)" strokeWidth="1" fill="none" />
                  </svg>
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    {msg.role === "assistant" ? (
                      <Markdown
                        components={{
                          h1: ({children}) => (
                            <div style={{ margin: "4px 0 1px" }}>
                              <h1 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{children}</h1>
                            </div>
                          ),
                          h2: ({children}) => (
                            <div style={{ margin: "4px 0 1px" }}>
                              <h2 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 15, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{children}</h2>
                            </div>
                          ),
                          h3: ({children}) => <h3 style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 14, fontWeight: 700, margin: "3px 0 1px" }}>{children}</h3>,
                          p: ({children}) => <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, lineHeight: 1.5, margin: "3px 0" }}>{children}</p>,
                          ul: ({children}) => <ul style={{ margin: 0, paddingLeft: 16 }}>{children}</ul>,
                          ol: ({children}) => <ol style={{ margin: 0, paddingLeft: 16 }}>{children}</ol>,
                          li: ({children}) => <li style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, lineHeight: 1.5, margin: 0 }}>{children}</li>,
                          strong: ({children}) => (
                            <strong style={{ fontWeight: 700, background: "linear-gradient(to bottom, transparent 60%, var(--primary) 60%)", padding: "0 2px" }}>
                              {children}
                            </strong>
                          ),
                          blockquote: ({children}) => (
                            <div style={{ margin: "4px 0", padding: "8px 12px", background: "#FFF9DB", border: "2px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "2px 2px 0 #1A1A1A", transform: "rotate(0.3deg)", fontSize: 12 }}>
                              {children}
                            </div>
                          ),
                          code: ({children, className}) => {
                            const isInline = !className;
                            return isInline
                              ? <code style={{ fontFamily: "monospace", fontSize: 12, background: "rgba(0,0,0,0.06)", padding: "1px 4px", borderRadius: 3 }}>{children}</code>
                              : <code style={{ display: "block", fontFamily: "monospace", fontSize: 11, background: "rgba(0,0,0,0.06)", padding: 8, borderRadius: 4, overflow: "auto" }}>{children}</code>;
                          },
                          a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "underline", fontSize: 13 }}>{children}</a>,
                        }}
                      >
                        {msg.content}
                      </Markdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === "assistant" && i === messages.length - 1 && streaming && (
                    <span style={{ display: "inline-block", width: 6, height: 14, background: "var(--text)", opacity: 0.4, marginLeft: 2, animation: "blink 1s infinite" }} />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--red)", fontWeight: 600, borderTop: "1px solid var(--border)" }}>
              {error}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "12px 16px", borderTop: "2px solid var(--border)",
            background: "#FFF9DB", position: "relative",
            display: "flex", gap: 8, alignItems: "flex-end",
          }}>
            {/* Notebook lines */}
            <svg width="100%" height="100%" viewBox="0 0 400 60" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.15 }}>
              {[12, 24, 36, 48].map((y) => (
                <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#3B82F6" strokeWidth="0.5" />
              ))}
              <line x1="40" y1="0" x2="40" y2="60" stroke="#EF4444" strokeWidth="0.5" />
            </svg>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="jot something down..."
              rows={1}
              style={{
                flex: 1, resize: "none", border: "none", outline: "none",
                borderRadius: 0, padding: "8px 12px",
                fontSize: 13, fontFamily: "var(--font-hand), Caveat, cursive", lineHeight: 1.4,
                background: "transparent", color: "var(--text)",
                minHeight: 40, maxHeight: 120,
              }}
              disabled={streaming}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              style={{
                height: 36, padding: "0 14px", flexShrink: 0,
                background: "var(--primary)", color: "#1A1A1A",
                border: "2px solid var(--border)", borderRadius: "var(--radius)",
                boxShadow: "2px 2px 0 #1A1A1A", cursor: "pointer",
                fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 14, fontWeight: 700,
              }}
            >
              {streaming ? "..." : "send"}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @media (min-width: 769px) {
          /* Desktop: constrain chat panel */
          [style*="position: fixed"][style*="inset: 0"][style*="z-index: 200"] {
            top: auto !important;
            bottom: 0 !important;
            right: 0 !important;
            left: auto !important;
            width: 400px !important;
            max-height: 600px !important;
            border: 2px solid var(--border) !important;
            border-bottom: none !important;
            border-radius: var(--radius) var(--radius) 0 0 !important;
            box-shadow: -4px -4px 0 #1A1A1A !important;
          }
        }
      `}</style>
    </>
  );
}
