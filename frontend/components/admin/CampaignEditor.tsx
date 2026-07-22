"use client";

import { useReducer, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useAuth } from "@/lib/auth";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { MultiUserSelect } from "@/components/admin/MultiUserSelect";
import {
  useAdminCreateCampaign,
  useAdminUpdateCampaign,
  useAdminScheduleCampaign,
  useAdminPreviewCampaign,
  useAdminBuildAudience,
  useAdminUsers,
} from "@/lib/hooks";
import type { AdminCampaignDetail, TemplateVar } from "@/lib/api";

interface CampaignEditorProps {
  existing?: AdminCampaignDetail;
}

const AUDIENCE_OPTIONS = [
  { value: "all_users", label: "All registered users" },
  { value: "segment", label: "Segment by sign-up date" },
  { value: "selected", label: "Select specific users" },
] as const;

const SCHEDULE_OPTIONS = [
  { value: "now", label: "Send immediately" },
  { value: "once", label: "Schedule for later" },
  { value: "recurring", label: "Recurring (cron)" },
] as const;

// ─── RadioGroup ─────────────────────────────────────────────────────────────

function RadioGroup<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: "var(--radius)",
              border: selected ? "2px solid var(--border)" : "2px solid transparent",
              background: selected ? "var(--primary)" : "transparent",
              cursor: disabled ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: selected ? 700 : 600,
              transition: "all 0.1s",
              opacity: disabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!disabled && !selected) {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.background = "var(--bg-dark)";
              }
            }}
            onMouseLeave={(e) => {
              if (!selected) {
                (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }
            }}
          >
            <input
              type="radio"
              name={opt.label}
              value={opt.value}
              checked={selected}
              onChange={() => onChange(opt.value)}
              disabled={disabled}
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}

// ─── TemplateVarManager ─────────────────────────────────────────────────────

interface TemplateVarManagerState {
  editing: TemplateVar | null;
  key: string;
  label: string;
  defaultVal: string;
  removeTarget: string | null;
}

type TemplateVarManagerAction =
  | { type: "SET_KEY"; value: string }
  | { type: "SET_LABEL"; value: string }
  | { type: "SET_DEFAULT_VAL"; value: string }
  | { type: "SET_REMOVE_TARGET"; value: string | null }
  | { type: "START_ADD" }
  | { type: "START_EDIT"; value: TemplateVar }
  | { type: "CANCEL_EDIT" };

function templateVarReducer(state: TemplateVarManagerState, action: TemplateVarManagerAction): TemplateVarManagerState {
  switch (action.type) {
    case "SET_KEY":
      return { ...state, key: action.value };
    case "SET_LABEL":
      return { ...state, label: action.value };
    case "SET_DEFAULT_VAL":
      return { ...state, defaultVal: action.value };
    case "SET_REMOVE_TARGET":
      return { ...state, removeTarget: action.value };
    case "START_ADD":
      return { editing: { key: "", label: "", default_value: "" }, key: "", label: "", defaultVal: "", removeTarget: null };
    case "START_EDIT":
      return { editing: action.value, key: action.value.key, label: action.value.label, defaultVal: action.value.default_value || "", removeTarget: null };
    case "CANCEL_EDIT":
      return { ...state, editing: null, key: "", label: "", defaultVal: "" };
  }
}

function TemplateVarManager({
  vars,
  onChange,
  disabled,
  onInsert,
}: {
  vars: TemplateVar[];
  onChange: (v: TemplateVar[]) => void;
  disabled: boolean;
  onInsert: (key: string) => void;
}) {
  const [state, dispatch] = useReducer(templateVarReducer, {
    editing: null,
    key: "",
    label: "",
    defaultVal: "",
    removeTarget: null,
  });

  const set = <K extends keyof TemplateVarManagerState>(field: K, value: TemplateVarManagerState[K]) =>
    dispatch({ type: `SET_${field.toUpperCase()}` as TemplateVarManagerAction["type"], value } as TemplateVarManagerAction);

  const saveVar = () => {
    const trimmedKey = state.key.trim();
    if (!trimmedKey || !state.label.trim()) return;
    const updated: TemplateVar = { key: trimmedKey, label: state.label.trim(), default_value: state.defaultVal.trim() || undefined };
    if (state.editing && vars.find((v) => v.key === state.editing!.key)) {
      onChange(vars.map((v) => (v.key === state.editing!.key ? updated : v)));
    } else {
      onChange([...vars, updated]);
    }
    dispatch({ type: "CANCEL_EDIT" });
  };

  const removeVar = (k: string) => {
    onChange(vars.filter((v) => v.key !== k));
    if (state.editing?.key === k) dispatch({ type: "CANCEL_EDIT" });
  };

  const editingNow = state.editing !== null;
  const canSave = state.key.trim().length > 0 && state.label.trim().length > 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="section-label">Template Variables</div>
        {!disabled && !editingNow && (
          <button onClick={() => dispatch({ type: "START_ADD" })} className="btn btn-sm btn-ghost" type="button" style={{ fontSize: 11 }}>
            + Add
          </button>
        )}
      </div>

      {vars.length === 0 && !editingNow && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "4px 0" }}>
          No variables defined yet. Add variables like <code style={{ background: "var(--bg-dark)", padding: "0 3px" }}>{`{{name}}`}</code> to personalize emails.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {vars.map((v) => (
          <div
            key={v.key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 8px",
              background: "var(--bg-dark)",
              borderRadius: "var(--radius)",
              border: state.editing?.key === v.key ? "2px solid var(--primary)" : "1.5px solid transparent",
              fontSize: 12,
            }}
          >
            <code style={{ fontWeight: 700, fontSize: 11, minWidth: 60 }}>{`{{${v.key}}}`}</code>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{v.label}</div>
              {v.default_value && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>default: {v.default_value}</div>}
            </div>
            {!disabled && (
              <div style={{ display: "flex", gap: 2 }}>
                <button
                  onClick={() => onInsert(v.key)}
                  className="btn btn-sm btn-ghost"
                  type="button"
                  title="Insert into body"
                  style={{ fontSize: 10, padding: "2px 5px" }}
                >
                  Insert
                </button>
                <button
                  onClick={() => dispatch({ type: "START_EDIT", value: v })}
                  className="btn btn-sm btn-ghost"
                  type="button"
                  title="Edit"
                  style={{ fontSize: 10, padding: "2px 5px" }}
                >
                  Edit
                </button>
                <button
                  onClick={() => set("removeTarget", v.key)}
                  className="btn btn-sm btn-ghost"
                  type="button"
                  title="Remove"
                  style={{ fontSize: 10, padding: "2px 5px", color: "var(--red)" }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {editingNow && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            border: "2px solid var(--border)",
            borderRadius: "var(--radius)",
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Variable key</div>
            <input
              type="text"
              value={state.key}
              onChange={(e) => set("key", e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              className="input"
              placeholder="e.g. name"
              style={{ fontSize: 12, padding: "5px 8px" }}
              autoFocus
            />
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              Use <code>{`{{${state.key || "key"}}}`}</code> in your email body
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Label</div>
            <input
              type="text"
              value={state.label}
              onChange={(e) => set("label", e.target.value)}
              className="input"
              placeholder="e.g. User Name"
              style={{ fontSize: 12, padding: "5px 8px" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Default value (fallback if no data)</div>
            <input
              type="text"
              value={state.defaultVal}
              onChange={(e) => set("defaultVal", e.target.value)}
              className="input"
              placeholder="e.g. there"
              style={{ fontSize: 12, padding: "5px 8px" }}
            />
          </div>
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 2 }}>
            <button onClick={() => dispatch({ type: "CANCEL_EDIT" })} className="btn btn-sm btn-ghost" type="button">Cancel</button>
            <button onClick={saveVar} disabled={!canSave} className="btn btn-sm btn-primary" type="button">
              {state.editing?.key && vars.find((v) => v.key === state.editing!.key) ? "Update" : "Add"}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={state.removeTarget !== null}
        title="Remove template variable"
        confirmLabel="Remove"
        destructive
        onConfirm={() => { if (state.removeTarget) { removeVar(state.removeTarget); set("removeTarget", null); } }}
        onCancel={() => set("removeTarget", null)}
      >
        Are you sure you want to remove the template variable <strong>{`{{${state.removeTarget}}}`}</strong>? Any references to this variable in your email body will become broken when the campaign is saved.
      </ConfirmDialog>
    </div>
  );
}

// ─── RenderPreview ──────────────────────────────────────────────────────────

function RenderPreview({
  html,
  onClose,
}: {
  html: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 600, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", padding: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "2px solid var(--border)" }}>
          <div className="section-label">Preview</div>
          <button onClick={onClose} className="btn btn-sm btn-ghost" style={{ fontSize: 14 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 16, background: "#fff" }}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface CampaignEditorState {
  name: string;
  subject: string;
  fromEmail: string;
  audienceType: string;
  signedUpAfter: string;
  signedUpBefore: string;
  scheduleType: string;
  cronExpr: string;
  scheduledAt: string;
  templateVars: TemplateVar[];
  error: string;
  success: string;
  selectedUserIds: string[];
  manualEmails: string[];
  showSource: boolean;
  sourceHtml: string;
  showPreview: boolean;
  previewHtml: string;
  showConfirm: boolean;
  showLinkDialog: boolean;
  linkUrl: string;
  linkLabel: string;
  campaignId: string | null;
}

type CampaignEditorAction =
  | { type: "SET_NAME"; value: string }
  | { type: "SET_SUBJECT"; value: string }
  | { type: "SET_FROM_EMAIL"; value: string }
  | { type: "SET_AUDIENCE_TYPE"; value: string }
  | { type: "SET_SIGNED_UP_AFTER"; value: string }
  | { type: "SET_SIGNED_UP_BEFORE"; value: string }
  | { type: "SET_SCHEDULE_TYPE"; value: string }
  | { type: "SET_CRON_EXPR"; value: string }
  | { type: "SET_SCHEDULED_AT"; value: string }
  | { type: "SET_TEMPLATE_VARS"; value: TemplateVar[] }
  | { type: "SET_ERROR"; value: string }
  | { type: "SET_SUCCESS"; value: string }
  | { type: "SET_SELECTED_USER_IDS"; value: string[] }
  | { type: "SET_MANUAL_EMAILS"; value: string[] }
  | { type: "SET_SHOW_SOURCE"; value: boolean }
  | { type: "SET_SOURCE_HTML"; value: string }
  | { type: "SET_SHOW_PREVIEW"; value: boolean }
  | { type: "SET_PREVIEW_HTML"; value: string }
  | { type: "SET_SHOW_CONFIRM"; value: boolean }
  | { type: "SET_SHOW_LINK_DIALOG"; value: boolean }
  | { type: "SET_LINK_URL"; value: string }
  | { type: "SET_LINK_LABEL"; value: string }
  | { type: "SET_CAMPAIGN_ID"; value: string | null };

function campaignReducer(state: CampaignEditorState, action: CampaignEditorAction): CampaignEditorState {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, name: action.value };
    case "SET_SUBJECT":
      return { ...state, subject: action.value };
    case "SET_FROM_EMAIL":
      return { ...state, fromEmail: action.value };
    case "SET_AUDIENCE_TYPE":
      return { ...state, audienceType: action.value };
    case "SET_SIGNED_UP_AFTER":
      return { ...state, signedUpAfter: action.value };
    case "SET_SIGNED_UP_BEFORE":
      return { ...state, signedUpBefore: action.value };
    case "SET_SCHEDULE_TYPE":
      return { ...state, scheduleType: action.value };
    case "SET_CRON_EXPR":
      return { ...state, cronExpr: action.value };
    case "SET_SCHEDULED_AT":
      return { ...state, scheduledAt: action.value };
    case "SET_TEMPLATE_VARS":
      return { ...state, templateVars: action.value };
    case "SET_ERROR":
      return { ...state, error: action.value };
    case "SET_SUCCESS":
      return { ...state, success: action.value };
    case "SET_SELECTED_USER_IDS":
      return { ...state, selectedUserIds: action.value };
    case "SET_MANUAL_EMAILS":
      return { ...state, manualEmails: action.value };
    case "SET_SHOW_SOURCE":
      return { ...state, showSource: action.value };
    case "SET_SOURCE_HTML":
      return { ...state, sourceHtml: action.value };
    case "SET_SHOW_PREVIEW":
      return { ...state, showPreview: action.value };
    case "SET_PREVIEW_HTML":
      return { ...state, previewHtml: action.value };
    case "SET_SHOW_CONFIRM":
      return { ...state, showConfirm: action.value };
    case "SET_SHOW_LINK_DIALOG":
      return { ...state, showLinkDialog: action.value };
    case "SET_LINK_URL":
      return { ...state, linkUrl: action.value };
    case "SET_LINK_LABEL":
      return { ...state, linkLabel: action.value };
    case "SET_CAMPAIGN_ID":
      return { ...state, campaignId: action.value };
  }
}

function buildInitialState(existing?: AdminCampaignDetail): CampaignEditorState {
  return {
    name: existing?.name || "",
    subject: existing?.subject || "",
    fromEmail: existing?.from_email || "",
    audienceType: existing?.audience_type || "all_users",
    signedUpAfter: "",
    signedUpBefore: "",
    scheduleType: "now",
    cronExpr: "",
    scheduledAt: "",
    templateVars: existing?.template_vars || [],
    error: "",
    success: "",
    selectedUserIds: (existing?.audience_config?.user_ids as string[]) || [],
    manualEmails: (existing?.audience_config?.emails as string[]) || [],
    showSource: false,
    sourceHtml: existing?.html_body || "",
    showPreview: false,
    previewHtml: "",
    showConfirm: false,
    showLinkDialog: false,
    linkUrl: "",
    linkLabel: "",
    campaignId: existing?.id || null,
  };
}

export function CampaignEditor({ existing }: CampaignEditorProps) {
  const { user } = useAuth();
  const router = useRouter();

  const createCampaign = useAdminCreateCampaign();
  const updateCampaign = useAdminUpdateCampaign();
  const scheduleCampaign = useAdminScheduleCampaign();
  const previewCampaign = useAdminPreviewCampaign();
  const buildAudience = useAdminBuildAudience();
  const { data: users = [] } = useAdminUsers("");

  const [state, dispatch] = useReducer(campaignReducer, existing, buildInitialState);
  const set = <K extends keyof CampaignEditorState>(field: K, value: CampaignEditorState[K]) =>
    dispatch({ type: `SET_${field.toUpperCase()}` as CampaignEditorAction["type"], value } as CampaignEditorAction);

  const saving = createCampaign.isPending || updateCampaign.isPending || scheduleCampaign.isPending || buildAudience.isPending;

  const editor = useEditor({
    extensions: [
      StarterKit,
      LinkExtension.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Write your email content here..." }),
    ],
    content: existing?.html_body || "",
    editorProps: {
      attributes: {
        class: "input",
        style: "min-height: 300px; padding: 12px; font-family: var(--font-sans); font-size: 14px; line-height: 1.65;",
      },
    },
  });

  const getHtmlBody = useCallback(() => {
    if (state.showSource) return state.sourceHtml;
    return editor?.getHTML() || "";
  }, [state.showSource, state.sourceHtml, editor]);

  const buildPayload = useCallback((): {
    name: string;
    subject: string;
    html_body: string;
    from_email?: string;
    audience_type?: string;
    audience_config?: Record<string, unknown>;
    template_vars?: TemplateVar[];
  } => {
    let audience_config: Record<string, unknown> | undefined;
    if (state.audienceType === "segment") {
      audience_config = { signed_up_after: state.signedUpAfter || undefined, signed_up_before: state.signedUpBefore || undefined };
    } else if (state.audienceType === "selected") {
      audience_config = { user_ids: state.selectedUserIds, emails: state.manualEmails };
    }
    return {
      name: state.name,
      subject: state.subject,
      html_body: getHtmlBody(),
      from_email: state.fromEmail || undefined,
      audience_type: state.audienceType,
      audience_config,
      template_vars: state.templateVars.length > 0 ? state.templateVars : undefined,
    };
  }, [state.name, state.subject, getHtmlBody, state.fromEmail, state.audienceType, state.signedUpAfter, state.signedUpBefore, state.selectedUserIds, state.manualEmails, state.templateVars]);

  const saveDraft = async () => {
    set("error", "");
    set("success", "");
    try {
      const payload = buildPayload();
      if (state.campaignId) {
        await updateCampaign.mutateAsync({ id: state.campaignId, data: payload });
        set("success", "Campaign saved as draft");
      } else {
        const c = await createCampaign.mutateAsync(payload);
        set("campaignId", c.id);
        set("success", "Campaign saved as draft");
      }
    } catch (err) {
      set("error", err instanceof Error ? err.message : "Save failed");
    }
  };

  const scheduleAndSend = async () => {
    set("error", "");
    try {
      let id = state.campaignId;
      if (!id) {
        const c = await createCampaign.mutateAsync(buildPayload());
        id = c.id;
        set("campaignId", id);
      } else {
        await updateCampaign.mutateAsync({ id, data: buildPayload() });
      }

      await buildAudience.mutateAsync(id);

      await scheduleCampaign.mutateAsync({
        id,
        data: {
          schedule_type: state.scheduleType,
          cron_expr: state.scheduleType === "recurring" ? state.cronExpr : undefined,
          scheduled_at: state.scheduleType === "once" ? state.scheduledAt : undefined,
        },
      });

      router.push("/admin");
    } catch (err) {
      set("error", err instanceof Error ? err.message : "Schedule failed");
      set("showConfirm", false);
    }
  };

  const handlePreview = async () => {
    if (!existing && !state.campaignId) {
      set("error", "Save the campaign as draft first before sending a preview");
      return;
    }
    const id = state.campaignId || existing?.id;
    if (!id) return;
    try {
      const result = await previewCampaign.mutateAsync(id);
      set("success", result.message);
    } catch (err) {
      set("error", err instanceof Error ? err.message : "Preview failed");
    }
  };

  const handleLivePreview = () => {
    const html = getHtmlBody();
    const sampleVars: Record<string, string> = {
      display_name: user?.display_name || "Jane Doe",
      email: user?.email || "jane@example.com",
      name: user?.display_name || "Jane Doe",
    };
    for (const v of state.templateVars) {
      if (!sampleVars[v.key]) {
        sampleVars[v.key] = v.default_value || `[${v.label}]`;
      }
    }
    let rendered = html;
    for (const [key, val] of Object.entries(sampleVars)) {
      rendered = rendered.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), val);
    }
    set("previewHtml", rendered);
    set("showPreview", true);
  };

  const insertVariable = (key: string) => {
    if (!editor || state.showSource) return;
    editor.chain().focus().insertContent(`{{ ${key} }}`).run();
  };

  const toggleSource = () => {
    if (!state.showSource) {
      set("sourceHtml", editor?.getHTML() || "");
    }
    set("showSource", !state.showSource);
  };

  const handleInsertLink = () => {
    if (!editor || !state.linkUrl.trim()) return;
    const url = state.linkUrl.trim();
    const label = state.linkLabel.trim();
    const safeUrl = /^(https?:\/\/|mailto:)/i.test(url) ? url : `https://${url}`;
    const { from, to } = editor.state.selection;
    if (from !== to && from >= 0 && to >= 0) {
      editor.chain().focus().setLink({ href: safeUrl }).run();
    } else if (label) {
      editor.chain().focus().insertContent(`<a href="${safeUrl}">${label}</a>`).run();
    }
    set("showLinkDialog", false);
    set("linkUrl", "");
    set("linkLabel", "");
  };

  const editable = !existing || ["draft", "scheduled", "cancelled"].includes(existing.status);
  const isNew = !existing;

  if (!user) return null;

  return (
    <div className="page">
      <AppHeader
        breadcrumb={
          <span style={{ fontWeight: 600 }}>
            <Link href="/admin" style={{ color: "var(--text-secondary)", textDecoration: "none", fontWeight: 400 }}>
              Admin
            </Link>
            <span style={{ margin: "0 6px", color: "var(--text-muted)" }}>/</span>
            {isNew ? "New Campaign" : existing?.name || "Edit Campaign"}
          </span>
        }
      />
      <PageHeader>
        <Link href="/admin" className="btn btn-sm btn-ghost btn-back" style={{ marginRight: "auto" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <button onClick={saveDraft} disabled={saving || !editable} className="btn btn-sm">
          {saving ? "Saving..." : "Save Draft"}
        </button>
        {state.campaignId && (!existing || ["draft", "scheduled", "cancelled"].includes(existing.status)) && (
          <button onClick={handlePreview} disabled={saving} className="btn btn-sm">
            Send Preview
          </button>
        )}
        <button
          onClick={() => set("showConfirm", true)}
          disabled={saving || !editable || !state.name.trim() || !state.subject.trim()}
          className="btn btn-sm btn-primary"
        >
          {saving ? "Saving..." : "Schedule & Send"}
        </button>
      </PageHeader>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {state.error && (
          <div className="card" style={{ marginBottom: "var(--gap)", color: "var(--red)", fontSize: 12, fontWeight: 600, padding: "10px 14px" }}>
            {state.error}
            <button onClick={() => set("error", "")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 14 }}>✕</button>
          </div>
        )}
        {state.success && (
          <div className="card" style={{ marginBottom: "var(--gap)", color: "var(--green)", fontSize: 12, fontWeight: 600, padding: "10px 14px" }}>
            {state.success}
            <button onClick={() => set("success", "")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "var(--green)", fontSize: 14 }}>✕</button>
          </div>
        )}

        <div className="editor-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
            <div className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: "var(--gap)", flexDirection: "column" }}>
                <div>
                  <div className="section-label" style={{ marginBottom: 6 }}>Campaign Name</div>
                  <input
                    type="text"
                    value={state.name}
                    onChange={(e) => set("name", e.target.value)}
                    className="input"
                    placeholder="e.g. Weekly Newsletter"
                    disabled={!editable}
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div>
                  <div className="section-label" style={{ marginBottom: 6 }}>Email Subject</div>
                  <input
                    type="text"
                    value={state.subject}
                    onChange={(e) => set("subject", e.target.value)}
                    className="input"
                    placeholder="Subject line"
                    disabled={!editable}
                    style={{ fontSize: 13 }}
                  />
                </div>
                <div>
                  <div className="section-label" style={{ marginBottom: 6 }}>From Email</div>
                  <input
                    type="email"
                    value={state.fromEmail}
                    onChange={(e) => set("fromEmail", e.target.value)}
                    className="input"
                    placeholder="marketing@emails.getcleanroom.xyz"
                    disabled={!editable}
                    style={{ fontSize: 13 }}
                  />
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div className="section-label">Email Body</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={handleLivePreview} className="btn btn-sm btn-ghost" type="button" disabled={!getHtmlBody()}>
                    Preview
                  </button>
                  <button onClick={toggleSource} className="btn btn-sm btn-ghost" type="button">
                    {state.showSource ? "Editor" : "Source"}
                  </button>
                </div>
              </div>

              {!state.showSource ? (
                <>
                  {editor && (
                    <div style={{ marginBottom: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <button
                        onClick={() => editor.chain().focus().undo().run()}
                        className="btn btn-sm btn-ghost"
                        type="button"
                        title="Undo"
                        disabled={!editor.can().undo()}
                      >
                        ↩
                      </button>
                      <button
                        onClick={() => editor.chain().focus().redo().run()}
                        className="btn btn-sm btn-ghost"
                        type="button"
                        title="Redo"
                        disabled={!editor.can().redo()}
                      >
                        ↪
                      </button>
                      <span style={{ width: 1, background: "var(--text-muted)", margin: "4px 2px" }} />
                      <button
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`btn btn-sm ${editor.isActive("bold") ? "btn-primary" : "btn-ghost"}`}
                        type="button"
                      >
                        B
                      </button>
                      <button
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`btn btn-sm ${editor.isActive("italic") ? "btn-primary" : "btn-ghost"}`}
                        type="button"
                      >
                        I
                      </button>
                      <span style={{ width: 1, background: "var(--text-muted)", margin: "4px 2px" }} />
                      <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        className={`btn btn-sm ${editor.isActive("heading", { level: 2 }) ? "btn-primary" : "btn-ghost"}`}
                        type="button"
                      >
                        H2
                      </button>
                      <button
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        className={`btn btn-sm ${editor.isActive("heading", { level: 3 }) ? "btn-primary" : "btn-ghost"}`}
                        type="button"
                      >
                        H3
                      </button>
                      <span style={{ width: 1, background: "var(--text-muted)", margin: "4px 2px" }} />
                      <button
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={`btn btn-sm ${editor.isActive("bulletList") ? "btn-primary" : "btn-ghost"}`}
                        type="button"
                      >
                        List
                      </button>
                      <button
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        className={`btn btn-sm ${editor.isActive("blockquote") ? "btn-primary" : "btn-ghost"}`}
                        type="button"
                      >
                        Quote
                      </button>
                      <button
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        className="btn btn-sm btn-ghost"
                        type="button"
                      >
                        ―
                      </button>
                      <button
                        onClick={() => {
                          const { from, to } = editor.state.selection;
                          const selected = from !== to ? editor.state.doc.textBetween(from, to, " ").trim() : "";
                          const existingHref = editor.getAttributes("link").href || "";
                          set("linkLabel", selected);
                          set("linkUrl", existingHref);
                          set("showLinkDialog", true);
                        }}
                        className={`btn btn-sm ${editor.isActive("link") ? "btn-primary" : "btn-ghost"}`}
                        type="button"
                      >
                        Link
                      </button>
                      {state.templateVars.length > 0 && (
                        <>
                          <span style={{ width: 1, background: "var(--text-muted)", margin: "4px 2px" }} />
                          <div style={{ position: "relative", display: "inline-block" }}>
                            <button
                              className="btn btn-sm btn-ghost"
                              type="button"
                              style={{ color: "var(--text)" }}
                              onClick={(e) => {
                                const menu = (e.currentTarget.parentElement?.querySelector(".var-menu")) as HTMLElement;
                                if (menu) menu.style.display = menu.style.display === "none" ? "flex" : "none";
                              }}
                            >
                              + Var
                            </button>
                            <div
                              className="var-menu"
                              style={{
                                display: "none",
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                zIndex: 50,
                                background: "var(--surface)",
                                border: "2px solid var(--border)",
                                borderRadius: "var(--radius)",
                                padding: 6,
                                minWidth: 160,
                                flexDirection: "column",
                                gap: 2,
                                boxShadow: "var(--shadow)",
                              }}
                            >
                              <div style={{ fontSize: 10, color: "var(--text-muted)", padding: "4px 6px", marginBottom: 2 }}>Insert variable</div>
                              {state.templateVars.map((v) => (
                                <button
                                  key={v.key}
                                  onClick={() => {
                                    insertVariable(v.key);
                                    const menu = document.querySelector(".var-menu") as HTMLElement;
                                    if (menu) menu.style.display = "none";
                                  }}
                                  className="btn btn-sm btn-ghost"
                                  type="button"
                                  style={{ fontSize: 11, justifyContent: "flex-start", padding: "4px 6px" }}
                                >
                                  <code style={{ fontWeight: 700 }}>{`{{${v.key}}}`}</code>
                                  <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>{v.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <EditorContent editor={editor} disabled={!editable} />
                </>
              ) : (
                <textarea
                  className="input"
                  value={state.sourceHtml}
                  onChange={(e) => set("sourceHtml", e.target.value)}
                  style={{ minHeight: 300, fontSize: 12, fontFamily: "var(--font-mono)", lineHeight: 1.5, resize: "vertical" }}
                  disabled={!editable}
                  placeholder="<html>..."
                />
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
            <div className="card" style={{ padding: "14px 16px" }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Audience</div>
              <RadioGroup
                options={AUDIENCE_OPTIONS}
                value={state.audienceType as typeof AUDIENCE_OPTIONS[number]["value"]}
                onChange={(v) => set("audienceType", v)}
                disabled={!editable}
              />

              {state.audienceType === "segment" && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1.5px solid var(--bg-dark)", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Signed up after</div>
                    <input type="date" value={state.signedUpAfter} onChange={(e) => set("signedUpAfter", e.target.value)} className="input" disabled={!editable} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Signed up before</div>
                    <input type="date" value={state.signedUpBefore} onChange={(e) => set("signedUpBefore", e.target.value)} className="input" disabled={!editable} />
                  </div>
                </div>
              )}

              {state.audienceType === "selected" && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1.5px solid var(--bg-dark)" }}>
                  <MultiUserSelect
                    users={users}
                    selectedIds={state.selectedUserIds}
                    onChange={(v) => set("selectedUserIds", v)}
                    manualEmails={state.manualEmails}
                    onManualEmailsChange={(v) => set("manualEmails", v)}
                    disabled={!editable}
                  />
                </div>
              )}
            </div>

            <div className="card" style={{ padding: "14px 16px" }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Schedule</div>
              <RadioGroup
                options={SCHEDULE_OPTIONS}
                value={state.scheduleType as typeof SCHEDULE_OPTIONS[number]["value"]}
                onChange={(v) => set("scheduleType", v)}
                disabled={!editable}
              />

              {state.scheduleType === "once" && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1.5px solid var(--bg-dark)" }}>
                  <input type="datetime-local" value={state.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} className="input" disabled={!editable} />
                </div>
              )}

              {state.scheduleType === "recurring" && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1.5px solid var(--bg-dark)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Cron expression</div>
                  <input
                    type="text"
                    value={state.cronExpr}
                    onChange={(e) => set("cronExpr", e.target.value)}
                    className="input"
                    placeholder='e.g. "0 9 * * 1"'
                    disabled={!editable}
                  />
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                    Examples: 0 9 * * 1 (Mon 9AM), 0 0 1 * * (1st of month), */15 * * * * (every 15 min)
                  </div>
                </div>
              )}
            </div>

            <div className="card" style={{ padding: "14px 16px" }}>
              <TemplateVarManager
                vars={state.templateVars}
                onChange={(v) => set("templateVars", v)}
                disabled={!editable}
                onInsert={insertVariable}
              />
            </div>

            {existing && (
              <div className="card" style={{ padding: "14px 16px" }}>
                <div className="section-label" style={{ marginBottom: 10, paddingBottom: 8, borderBottom: "2px solid var(--border)" }}>
                  Stats
                </div>
                <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <StatRow label="Status" value={existing.status} />
                  <StatRow label="Recipients" value={String(existing.total_recipients)} />
                  <StatRow label="Sent" value={String(existing.sent_count)} />
                  <StatRow
                    label="Open rate"
                    value={existing.sent_count > 0 ? `${Math.round((existing.opened_count / existing.sent_count) * 100)}%` : "\u2013"}
                    highlight={existing.sent_count > 0 ? "var(--green)" : undefined}
                  />
                  <StatRow
                    label="Click rate"
                    value={existing.opened_count > 0 ? `${Math.round((existing.clicked_count / existing.opened_count) * 100)}%` : "\u2013"}
                    highlight={existing.opened_count > 0 ? "var(--text)" : undefined}
                  />
                  {existing.scheduled_at && <StatRow label="Scheduled" value={new Date(existing.scheduled_at).toLocaleString()} />}
                  {existing.last_sent_at && <StatRow label="Last sent" value={new Date(existing.last_sent_at).toLocaleString()} />}
                </div>

                {existing.sent_count > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <MiniBar label="Opened" value={existing.opened_count} max={existing.sent_count} color="var(--green)" />
                    <div style={{ height: 4 }} />
                    <MiniBar label="Clicked" value={existing.clicked_count} max={existing.sent_count} color="var(--text-secondary)" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={state.showConfirm}
        title="Schedule & Send Campaign"
        confirmLabel={state.scheduleType === "now" ? "Send Now" : "Schedule"}
        onConfirm={scheduleAndSend}
        onCancel={() => set("showConfirm", false)}
        loading={saving}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div><strong>Campaign:</strong> {state.name || "Untitled"}</div>
          <div><strong>Subject:</strong> {state.subject || "No subject"}</div>
          <div><strong>Audience:</strong> {AUDIENCE_OPTIONS.find((o) => o.value === state.audienceType)?.label}</div>
          <div>
            <strong>Schedule:</strong>{" "}
            {state.scheduleType === "now" ? "Immediately" : state.scheduleType === "once" ? state.scheduledAt || "Not set" : `Recurring: ${state.cronExpr || "Not set"}`}
          </div>
          {state.templateVars.length > 0 && (
            <div><strong>Template vars:</strong> {state.templateVars.map((v) => `{{${v.key}}}`).join(", ")}</div>
          )}
        </div>
      </ConfirmDialog>

      {state.showPreview && (
        <RenderPreview html={state.previewHtml} onClose={() => set("showPreview", false)} />
      )}

      {state.showLinkDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => set("showLinkDialog", false)}
        >
          <div
            className="card"
            style={{ maxWidth: 400, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>
              {editor?.getAttributes("link").href ? "Edit Link" : "Insert Link"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Label</div>
                <input
                  type="text"
                  value={state.linkLabel}
                  onChange={(e) => set("linkLabel", e.target.value)}
                  className="input"
                  placeholder="Display text"
                  autoFocus
                  style={{ fontSize: 13 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>URL</div>
                <input
                  type="url"
                  value={state.linkUrl}
                  onChange={(e) => set("linkUrl", e.target.value)}
                  className="input"
                  placeholder="https://example.com"
                  style={{ fontSize: 13 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInsertLink();
                  }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button
                onClick={() => { set("showLinkDialog", false); set("linkUrl", ""); set("linkLabel", ""); }}
                className="btn btn-sm btn-ghost"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertLink}
                disabled={!state.linkUrl.trim()}
                className="btn btn-sm btn-primary"
                type="button"
              >
                {editor?.getAttributes("link").href ? "Update" : "Insert"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <strong style={{ color: highlight || "var(--text)" }}>{value}</strong>
    </div>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}/{max} ({pct}%)</span>
      </div>
      <div className="bar-track" style={{ height: 6 }}>
        <div className="bar-fill" style={{ width: `${pct}%`, background: color, borderRadius: 1 }} />
      </div>
    </div>
  );
}
