"use client";

import { useReducer, useRef, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Markdown from "react-markdown";
import { streamRecommendation, type ChatMessage } from "@/lib/api/recommendations";
import {
  useConversations,
  useConversationMessages,
  useCreateConversation,
  useDeleteConversation,
} from "@/lib/hooks/conversations";
import type { Conversation } from "@/lib/api/conversations";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

interface State {
  open: boolean;
  sidebarOpen: boolean;
  activeConvId: string | null;
  localMessages: ChatMessage[];
  streamingMsg: string;
  input: string;
  streaming: boolean;
  thinking: boolean;
  error: string;
  deleteTarget: string | null;
}

type Action =
  | { type: "SET"; field: keyof State; value: unknown }
  | { type: "RESET_CHAT" }
  | { type: "SELECT_CONVERSATION"; convId: string }
  | { type: "CONFIRM_DELETE_ACTIVE"; convId: string }
  | { type: "SEND_START"; userMsg: ChatMessage }
  | { type: "SET_CONV_ID"; convId: string }
  | { type: "SEND_ERROR"; message: string }
  | { type: "STREAM_TOKEN"; token: string }
  | { type: "STREAM_FINISH"; fullResponse: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET":
      return { ...state, [action.field]: action.value };
    case "RESET_CHAT":
      return { ...state, activeConvId: null, localMessages: [], streamingMsg: "", error: "", sidebarOpen: false };
    case "SELECT_CONVERSATION":
      return { ...state, activeConvId: action.convId, localMessages: [], streamingMsg: "", error: "", sidebarOpen: false };
    case "CONFIRM_DELETE_ACTIVE":
      return {
        ...state,
        deleteTarget: null,
        ...(action.convId === state.activeConvId ? { activeConvId: null, localMessages: [], streamingMsg: "" } : {}),
      };
    case "SEND_START":
      return { ...state, input: "", streaming: true, thinking: true, error: "", streamingMsg: "", localMessages: [...state.localMessages, action.userMsg] };
    case "SET_CONV_ID":
      return { ...state, activeConvId: action.convId };
    case "SEND_ERROR":
      return { ...state, error: action.message, streaming: false, thinking: false };
    case "STREAM_TOKEN":
      return { ...state, thinking: false, streamingMsg: state.streamingMsg + action.token };
    case "STREAM_FINISH": {
      const localMessages = action.fullResponse
        ? [...state.localMessages, { role: "assistant" as const, content: action.fullResponse }]
        : state.localMessages;
      return { ...state, streaming: false, thinking: false, streamingMsg: "", localMessages };
    }
  }
}

function LaiIcon({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 8C6 6.34315 7.34315 5 9 5H31C32.6569 5 34 6.34315 34 8V24C34 25.6569 32.6569 27 31 27H20L12 34V27H9C7.34315 27 6 25.6569 6 24V8Z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="11" y="21" fontFamily="Georgia, serif" fontSize="13" fontWeight="800" fontStyle="italic" fill={color} letterSpacing="-0.5">
        Lai
      </text>
    </svg>
  );
}

const QUICK_ACTIONS = [
  { label: "Generate content plan", prompt: "Generate a content plan to improve my AI visibility. Focus on the topics where my competitors beat me." },
  { label: "Fix weakest query", prompt: "Which of my queries is performing worst and how can I improve it?" },
  { label: "Beat top competitor", prompt: "Who is my top competitor and what specific content gaps should I fill to beat them?" },
];

const initialState: State = {
  open: false,
  sidebarOpen: false,
  activeConvId: null,
  localMessages: [],
  streamingMsg: "",
  input: "",
  streaming: false,
  thinking: false,
  error: "",
  deleteTarget: null,
};

export function ChatWidget({ brandId }: { brandId: string }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const titleRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qc = useQueryClient();
  const { addToast } = useToast();

  const { data: convsData } = useConversations(brandId);
  const { data: serverMessages } = useConversationMessages(brandId, state.activeConvId);
  const createConv = useCreateConversation();
  const deleteConv = useDeleteConversation();

  const conversations = convsData?.items ?? [];

  const serverMsgs: ChatMessage[] = (serverMessages ?? []).map((m) => ({ role: m.role, content: m.content }));
  const messages: ChatMessage[] = useMemo(() => {
    const base = state.activeConvId
      ? [...serverMsgs, ...state.localMessages.filter(
          (lm) => !serverMsgs.some((sm) => sm.role === lm.role && sm.content === lm.content)
        )]
      : state.localMessages;
    if (state.streamingMsg) {
      return [...base, { role: "assistant" as const, content: state.streamingMsg }];
    }
    return base;
  }, [state.activeConvId, serverMsgs, state.localMessages, state.streamingMsg]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      if (titleRefreshRef.current) clearTimeout(titleRefreshRef.current);
    };
  }, []);

  useEffect(() => {
    if (state.open) inputRef.current?.focus();
  }, [state.open]);

  const set = useCallback(
    <K extends keyof State>(field: K, value: State[K]) => dispatch({ type: "SET", field, value } as Action),
    [],
  );

  const startNewChat = useCallback(() => dispatch({ type: "RESET_CHAT" }), []);

  const selectConversation = useCallback((conv: Conversation) => dispatch({ type: "SELECT_CONVERSATION", convId: conv.id }), []);

  const handleDeleteConversation = useCallback((convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ type: "SET", field: "deleteTarget", value: convId });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!state.deleteTarget) return;
    await deleteConv.mutateAsync({ brandId, conversationId: state.deleteTarget });
    dispatch({ type: "CONFIRM_DELETE_ACTIVE", convId: state.deleteTarget });
  }, [brandId, deleteConv, state.deleteTarget]);

  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  });

  const send = async (text: string) => {
    if (!text.trim() || state.streaming) return;
    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    dispatch({ type: "SEND_START", userMsg });

    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;

    let convId = state.activeConvId;
    if (!convId) {
      try {
        const conv = await createConv.mutateAsync({ brandId });
        convId = conv.id;
        dispatch({ type: "SET_CONV_ID", convId: conv.id });
        qc.invalidateQueries({ queryKey: ["conversations", brandId] });
      } catch {
        dispatch({ type: "SEND_ERROR", message: "Failed to create conversation" });
        addToast("Failed to create conversation", "error");
        return;
      }
    }

    let fullResponse = "";

    try {
      const history = messagesRef.current.slice(-6);
      fullResponse = "";

      for await (const token of streamRecommendation(brandId, text, history, convId ?? undefined, controller.signal)) {
        dispatch({ type: "STREAM_TOKEN", token });
        fullResponse += token;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to get response";
      dispatch({ type: "SEND_ERROR", message: msg });
      addToast(msg, "error");
    } finally {
      dispatch({ type: "STREAM_FINISH", fullResponse });
      qc.invalidateQueries({ queryKey: ["conversations", brandId] });
      if (convId) {
        qc.invalidateQueries({ queryKey: ["conversationMessages", brandId, convId] });
      }
      if (titleRefreshRef.current) clearTimeout(titleRefreshRef.current);
      titleRefreshRef.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["conversations", brandId] });
      }, 4000);
    }
  };

  return (
    <>
      {!state.open && (
        <button
          onClick={() => set("open", true)}
          aria-label="Open AI copilot"
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

      {state.open && (
        <div
          className="chat-widget-panel"
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "var(--surface)",
            display: "flex", flexDirection: "column",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: "2px solid var(--border)",
            background: "#FFF9DB", position: "relative",
          }}>
            <svg width="100%" height="4" viewBox="0 0 400 4" preserveAspectRatio="none" style={{ position: "absolute", bottom: -2, left: 0, right: 0 }}>
              <path d="M0 2 Q20 0 40 3 Q60 4 80 1 Q100 0 120 3 Q140 4 160 1 Q180 0 200 3 Q220 4 240 1 Q260 0 280 3 Q300 4 320 1 Q340 0 360 3 Q380 4 400 2" stroke="var(--primary)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => set("sidebarOpen", !state.sidebarOpen)}
                style={{
                  width: 32, height: 32, borderRadius: "var(--radius)",
                  background: state.sidebarOpen ? "var(--primary)" : "transparent",
                  border: "2px solid var(--border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: 16,
                }}
                title="Conversations"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M2 8h12M2 12h12" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <div style={{
                width: 32, height: 32, borderRadius: "var(--radius)",
                background: "var(--primary)", border: "2px solid var(--border)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><LaiIcon size={22} color="#1A1A1A" /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Lai</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Your visibility copilot</div>
              </div>
            </div>
            <button onClick={() => set("open", false)} className="btn btn-ghost btn-sm" style={{ fontSize: 16 }}>✕</button>
          </div>

          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {state.sidebarOpen && (
              <div style={{
                width: 260, flexShrink: 0,
                borderRight: "2px solid var(--border)",
                background: "var(--bg)",
                display: "flex", flexDirection: "column",
                overflow: "hidden",
              }}>
                <div style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
                  <button
                    onClick={startNewChat}
                    style={{
                      width: "100%", padding: "8px 12px",
                      background: "var(--primary)", color: "#1A1A1A",
                      border: "2px solid var(--border)", borderRadius: "var(--radius)",
                      boxShadow: "2px 2px 0 #1A1A1A", cursor: "pointer",
                      fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 14, fontWeight: 700,
                      display: "flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New chat
                  </button>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
                  {conversations.length === 0 && (
                    <div style={{ padding: "20px 16px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
                      No conversations yet
                    </div>
                  )}
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => selectConversation(conv)}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        background: conv.id === state.activeConvId ? "var(--primary)" : "transparent",
                        borderLeft: conv.id === state.activeConvId ? "3px solid var(--border)" : "3px solid transparent",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span style={{
                        fontSize: 13, fontWeight: conv.id === state.activeConvId ? 700 : 400,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        flex: 1, minWidth: 0,
                      }}>
                        {conv.title}
                      </span>
                      <button
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        style={{
                          width: 20, height: 20, flexShrink: 0,
                          background: "transparent", border: "none", cursor: "pointer",
                          color: "var(--text-muted)", fontSize: 12,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          opacity: 0.5,
                        }}
                        title="Delete"
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.5"; }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflow: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", position: "relative" }}>
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
                    Hey, what&apos;s on your mind?
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
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ position: "absolute", top: -1, [msg.role === "user" ? "right" : "left"]: -1, opacity: 0.15, pointerEvents: "none" }}>
                      <path d={msg.role === "user" ? "M20 0 Q15 5 20 20" : "M0 0 Q5 5 0 20"} stroke="var(--text)" strokeWidth="1" fill="none" />
                    </svg>
                    <div>
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
                            p: ({children}) => <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, lineHeight: 1.5, margin: 0 }}>{children}</p>,
                            ul: ({children}) => <ul style={{ margin: 0, paddingLeft: 16, listStyleType: "disc" }}>{children}</ul>,
                            ol: ({children}) => <ol style={{ margin: 0, paddingLeft: 16, listStyleType: "decimal" }}>{children}</ol>,
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
                    {msg.role === "assistant" && i === messages.length - 1 && state.streaming && (
                      <span style={{ display: "inline-block", width: 6, height: 14, background: "var(--text)", opacity: 0.4, marginLeft: 2, animation: "blink 1s infinite" }} />
                    )}
                  </div>
                </div>
              ))}
              {state.thinking && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{
                    padding: "10px 14px", fontSize: 13,
                    background: "#FFF", color: "var(--text)",
                    border: "2px solid var(--border)", borderRadius: "12px 12px 12px 4px",
                    boxShadow: "2px 2px 0 rgba(0,0,0,0.08)",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <div style={{ display: "flex", gap: 3 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text)", opacity: 0.3, animation: "blink 1.2s infinite 0s" }} />
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text)", opacity: 0.3, animation: "blink 1.2s infinite 0.2s" }} />
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text)", opacity: 0.3, animation: "blink 1.2s infinite 0.4s" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div style={{
            borderTop: "2px solid var(--border)",
            background: "#FFF9DB", position: "relative",
          }}>
            <svg width="100%" height="100%" viewBox="0 0 400 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.12 }}>
              {[14, 26, 38, 50, 62, 74, 86].map((y) => (
                <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#3B82F6" strokeWidth="0.5" />
              ))}
              <line x1="40" y1="0" x2="40" y2="100" stroke="#EF4444" strokeWidth="0.5" />
            </svg>

            <div style={{
              display: "flex", gap: 2, padding: "6px 12px 4px 48px",
              borderBottom: "1px solid rgba(0,0,0,0.06)", position: "relative", zIndex: 1,
            }}>
              {[
                { label: "B", title: "Bold", insert: "**", wrap: true },
                { label: "I", title: "Italic", insert: "_", wrap: true },
                { label: "H", title: "Heading", insert: "### ", wrap: false },
                { label: "\u2022", title: "List", insert: "- ", wrap: false },
                { label: "1.", title: "Numbered list", insert: "1. ", wrap: false },
                { label: "</>", title: "Code", insert: "`", wrap: true },
                { label: "\u201C", title: "Quote", insert: "> ", wrap: false },
              ].map((btn) => (
                <button
                  key={btn.title}
                  title={btn.title}
                  onClick={() => {
                    const ta = inputRef.current;
                    if (!ta) return;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const selected = state.input.substring(start, end);
                    let newText: string;
                    let newCursor: number;
                    if (btn.wrap && selected) {
                      newText = state.input.substring(0, start) + btn.insert + selected + btn.insert + state.input.substring(end);
                      newCursor = start + btn.insert.length + selected.length + btn.insert.length;
                    } else if (btn.wrap) {
                      newText = state.input.substring(0, start) + btn.insert + btn.insert + state.input.substring(end);
                      newCursor = start + btn.insert.length;
                    } else {
                      newText = state.input.substring(0, start) + btn.insert + state.input.substring(end);
                      newCursor = start + btn.insert.length;
                    }
                    set("input", newText);
                    setTimeout(() => { ta.selectionStart = ta.selectionEnd = newCursor; ta.focus(); }, 0);
                  }}
                  style={{
                    width: 28, height: 24, display: "flex", alignItems: "center", justifyContent: "center",
                    border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12,
                    fontWeight: btn.label === "B" ? 800 : btn.label === "I" ? 400 : 600,
                    fontStyle: btn.label === "I" ? "italic" : "normal",
                    fontFamily: btn.label === "</>" ? "monospace" : "var(--font-sans), sans-serif",
                    color: "var(--text-muted)", background: "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "6px 12px 10px 48px", position: "relative", zIndex: 1 }}>
              <textarea
                ref={inputRef}
                value={state.input}
                onChange={(e) => set("input", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(state.input);
                  }
                  if (e.key === "Tab") {
                    e.preventDefault();
                    const ta = e.currentTarget;
                    const start = ta.selectionStart;
                    set("input", state.input.substring(0, start) + "  " + state.input.substring(ta.selectionEnd));
                    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2; }, 0);
                  }
                }}
                placeholder="jot something down..."
                rows={1}
                style={{
                  flex: 1, resize: "none", border: "none", outline: "none",
                  borderRadius: 0, padding: "4px 0",
                  fontSize: 13, fontFamily: "var(--font-hand), Caveat, cursive", lineHeight: 1.4,
                  background: "transparent", color: "var(--text)",
                  minHeight: 36, maxHeight: 120,
                }}
                disabled={state.streaming}
              />
              <button
                onClick={() => send(state.input)}
                disabled={!state.input.trim() || state.streaming}
                style={{
                  height: 34, padding: "0 14px", flexShrink: 0,
                  background: "var(--primary)", color: "#1A1A1A",
                  border: "2px solid var(--border)", borderRadius: "var(--radius)",
                  boxShadow: "2px 2px 0 #1A1A1A", cursor: "pointer",
                  fontFamily: "var(--font-hand), Caveat, cursive", fontSize: 14, fontWeight: 700,
                }}
              >
                {state.streaming ? "..." : "send"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!state.deleteTarget}
        title="Delete conversation"
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => set("deleteTarget", null)}
        loading={deleteConv.isPending}
      >
        This will permanently delete this conversation and all its messages. This cannot be undone.
      </ConfirmDialog>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @media (min-width: 769px) {
          .chat-widget-panel {
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
