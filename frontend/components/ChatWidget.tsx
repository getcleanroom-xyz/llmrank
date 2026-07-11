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
            background: "var(--bg-dark)",
          }}>
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
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", background: "var(--primary)", margin: "0 auto 16px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "3px solid var(--border)", boxShadow: "3px 3px 0 #1A1A1A",
                }}><LaiIcon size={34} color="#1A1A1A" /></div>
                <div style={{ fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                  Ask me anything
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
                  I can analyze your AI visibility, suggest content strategies, and help you beat competitors.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {QUICK_ACTIONS.map((action) => (
                    <button
                      key={action.label}
                      onClick={() => send(action.prompt)}
                      className="card"
                      style={{
                        padding: "10px 14px", textAlign: "left", cursor: "pointer",
                        fontSize: 12, fontWeight: 600, color: "var(--text)",
                        transition: "box-shadow 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "3px 3px 0 #1A1A1A"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
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
                  borderRadius: "var(--radius)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  ...(msg.role === "user"
                    ? { background: "var(--primary)", color: "#1A1A1A", border: "2px solid var(--border)" }
                    : { background: "var(--bg-dark)", color: "var(--text)", border: "2px solid var(--border)" }),
                }}>
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    {msg.role === "assistant" ? (
                      <Markdown
                        components={{
                          h1: ({children}) => <h1 style={{ fontSize: 15, fontWeight: 800 }}>{children}</h1>,
                          h2: ({children}) => <h2 style={{ fontSize: 14, fontWeight: 700 }}>{children}</h2>,
                          h3: ({children}) => <h3 style={{ fontSize: 13, fontWeight: 700 }}>{children}</h3>,
                          p: ({children}) => <p>{children}</p>,
                          ul: ({children}) => <ul style={{ paddingLeft: 14 }}>{children}</ul>,
                          ol: ({children}) => <ol style={{ paddingLeft: 14 }}>{children}</ol>,
                          li: ({children}) => <li>{children}</li>,
                          strong: ({children}) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                          code: ({children, className}) => {
                            const isInline = !className;
                            return isInline
                              ? <code style={{ background: "rgba(0,0,0,0.06)", padding: "1px 4px", borderRadius: 3, fontSize: 12 }}>{children}</code>
                              : <code style={{ display: "block", background: "rgba(0,0,0,0.06)", padding: 8, borderRadius: 4, fontSize: 12, overflow: "auto" }}>{children}</code>;
                          },
                          a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "underline" }}>{children}</a>,
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
            background: "var(--bg-dark)",
            display: "flex", gap: 8, alignItems: "flex-end",
          }}>
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
              placeholder="Ask about your AI visibility..."
              rows={1}
              style={{
                flex: 1, resize: "none", border: "2px solid var(--border)",
                borderRadius: "var(--radius)", padding: "8px 12px",
                fontSize: 13, fontFamily: "inherit", lineHeight: 1.4,
                background: "var(--surface)", color: "var(--text)",
                minHeight: 40, maxHeight: 120,
              }}
              disabled={streaming}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              className="btn btn-primary btn-sm"
              style={{ height: 40, padding: "0 16px", flexShrink: 0 }}
            >
              {streaming ? "..." : "Send"}
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
