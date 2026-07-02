"use client";

import { useState, useCallback, useEffect } from "react";
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
  const [editing, setEditing] = useState<TemplateVar | null>(null);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [defaultVal, setDefaultVal] = useState("");
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const startAdd = () => {
    setEditing({ key: "", label: "", default_value: "" });
    setKey("");
    setLabel("");
    setDefaultVal("");
  };

  const startEdit = (v: TemplateVar) => {
    setEditing(v);
    setKey(v.key);
    setLabel(v.label);
    setDefaultVal(v.default_value || "");
  };

  const cancelEdit = () => {
    setEditing(null);
    setKey("");
    setLabel("");
    setDefaultVal("");
  };

  const saveVar = () => {
    const trimmedKey = key.trim();
    if (!trimmedKey || !label.trim()) return;
    const updated: TemplateVar = { key: trimmedKey, label: label.trim(), default_value: defaultVal.trim() || undefined };
    if (editing && vars.find((v) => v.key === editing.key)) {
      onChange(vars.map((v) => (v.key === editing.key ? updated : v)));
    } else {
      onChange([...vars, updated]);
    }
    cancelEdit();
  };

  const removeVar = (k: string) => {
    onChange(vars.filter((v) => v.key !== k));
    if (editing?.key === k) cancelEdit();
  };

  const editingNow = editing !== null;
  const canSave = key.trim().length > 0 && label.trim().length > 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div className="section-label">Template Variables</div>
        {!disabled && !editingNow && (
          <button onClick={startAdd} className="btn btn-sm btn-ghost" type="button" style={{ fontSize: 11 }}>
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
              border: editing?.key === v.key ? "2px solid var(--primary)" : "1.5px solid transparent",
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
                  onClick={() => startEdit(v)}
                  className="btn btn-sm btn-ghost"
                  type="button"
                  title="Edit"
                  style={{ fontSize: 10, padding: "2px 5px" }}
                >
                  Edit
                </button>
                <button
                  onClick={() => setRemoveTarget(v.key)}
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
              value={key}
              onChange={(e) => setKey(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              className="input"
              placeholder="e.g. name"
              style={{ fontSize: 12, padding: "5px 8px" }}
              autoFocus
            />
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
              Use <code>{`{{${key || "key"}}}`}</code> in your email body
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Label</div>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="input"
              placeholder="e.g. User Name"
              style={{ fontSize: 12, padding: "5px 8px" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>Default value (fallback if no data)</div>
            <input
              type="text"
              value={defaultVal}
              onChange={(e) => setDefaultVal(e.target.value)}
              className="input"
              placeholder="e.g. there"
              style={{ fontSize: 12, padding: "5px 8px" }}
            />
          </div>
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 2 }}>
            <button onClick={cancelEdit} className="btn btn-sm btn-ghost" type="button">Cancel</button>
            <button onClick={saveVar} disabled={!canSave} className="btn btn-sm btn-primary" type="button">
              {editing?.key && vars.find((v) => v.key === editing.key) ? "Update" : "Add"}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove template variable"
        confirmLabel="Remove"
        destructive
        onConfirm={() => { if (removeTarget) { removeVar(removeTarget); setRemoveTarget(null); } }}
        onCancel={() => setRemoveTarget(null)}
      >
        Are you sure you want to remove the template variable <strong>{`{{${removeTarget}}}`}</strong>? Any references to this variable in your email body will become broken when the campaign is saved.
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

export function CampaignEditor({ existing }: CampaignEditorProps) {
  const { user } = useAuth();
  const router = useRouter();

  const createCampaign = useAdminCreateCampaign();
  const updateCampaign = useAdminUpdateCampaign();
  const scheduleCampaign = useAdminScheduleCampaign();
  const previewCampaign = useAdminPreviewCampaign();
  const buildAudience = useAdminBuildAudience();
  const { data: users = [] } = useAdminUsers("");

  const [name, setName] = useState(existing?.name || "");
  const [subject, setSubject] = useState(existing?.subject || "");
  const [fromEmail, setFromEmail] = useState(existing?.from_email || "");
  const [audienceType, setAudienceType] = useState(existing?.audience_type || "all_users");
  const [signedUpAfter, setSignedUpAfter] = useState("");
  const [signedUpBefore, setSignedUpBefore] = useState("");
  const [scheduleType, setScheduleType] = useState("now");
  const [cronExpr, setCronExpr] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [templateVars, setTemplateVars] = useState<TemplateVar[]>(existing?.template_vars || []);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    (existing?.audience_config?.user_ids as string[]) || []
  );
  const [manualEmails, setManualEmails] = useState<string[]>(
    (existing?.audience_config?.emails as string[]) || []
  );
  const [showSource, setShowSource] = useState(false);
  const [sourceHtml, setSourceHtml] = useState(existing?.html_body || "");
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [campaignId, setCampaignId] = useState<string | null>(existing?.id || null);

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
    if (showSource) return sourceHtml;
    return editor?.getHTML() || "";
  }, [showSource, sourceHtml, editor]);

  const buildPayload = useCallback(() => {
    let audience_config: Record<string, unknown> | undefined;
    if (audienceType === "segment") {
      audience_config = { signed_up_after: signedUpAfter || undefined, signed_up_before: signedUpBefore || undefined };
    } else if (audienceType === "selected") {
      audience_config = { user_ids: selectedUserIds, emails: manualEmails };
    }
    return {
      name,
      subject,
      html_body: getHtmlBody(),
      from_email: fromEmail || undefined,
      audience_type: audienceType,
      audience_config,
      template_vars: templateVars.length > 0 ? templateVars : undefined,
    };
  }, [name, subject, getHtmlBody, fromEmail, audienceType, signedUpAfter, signedUpBefore, selectedUserIds, manualEmails, templateVars]);

  const saveDraft = async () => {
    setError("");
    setSuccess("");
    try {
      const payload = buildPayload();
      if (campaignId) {
        await updateCampaign.mutateAsync({ id: campaignId, data: payload as any });
        setSuccess("Campaign saved as draft");
      } else {
        const c = await createCampaign.mutateAsync(payload as any);
        setCampaignId(c.id);
        setSuccess("Campaign saved as draft");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const scheduleAndSend = async () => {
    setError("");
    try {
      let id = campaignId;
      if (!id) {
        const c = await createCampaign.mutateAsync(buildPayload() as any);
        id = c.id;
        setCampaignId(id);
      } else {
        await updateCampaign.mutateAsync({ id, data: buildPayload() as any });
      }

      // Build audience first (needs draft status), then schedule
      await buildAudience.mutateAsync(id);

      await scheduleCampaign.mutateAsync({
        id,
        data: {
          schedule_type: scheduleType,
          cron_expr: scheduleType === "recurring" ? cronExpr : undefined,
          scheduled_at: scheduleType === "once" ? scheduledAt : undefined,
        },
      });

      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Schedule failed");
      setShowConfirm(false);
    }
  };

  const handlePreview = async () => {
    if (!existing && !campaignId) {
      setError("Save the campaign as draft first before sending a preview");
      return;
    }
    const id = campaignId || existing?.id;
    if (!id) return;
    try {
      const result = await previewCampaign.mutateAsync(id);
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    }
  };

  const handleLivePreview = () => {
    const html = getHtmlBody();
    const sampleVars: Record<string, string> = {
      display_name: user?.display_name || "Jane Doe",
      email: user?.email || "jane@example.com",
      name: user?.display_name || "Jane Doe",
    };
    for (const v of templateVars) {
      if (!sampleVars[v.key]) {
        sampleVars[v.key] = v.default_value || `[${v.label}]`;
      }
    }
    let rendered = html;
    for (const [key, val] of Object.entries(sampleVars)) {
      rendered = rendered.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), val);
    }
    setPreviewHtml(rendered);
    setShowPreview(true);
  };

  const insertVariable = (key: string) => {
    if (!editor || showSource) return;
    editor.chain().focus().insertContent(`{{ ${key} }}`).run();
  };

  const toggleSource = () => {
    if (!showSource) {
      setSourceHtml(editor?.getHTML() || "");
    }
    setShowSource(!showSource);
  };

  const handleInsertLink = () => {
    if (!editor || !linkUrl.trim()) return;
    const url = linkUrl.trim();
    const label = linkLabel.trim();
    const { from, to } = editor.state.selection;
    if (from !== to && from >= 0 && to >= 0) {
      editor.chain().focus().setLink({ href: url }).run();
    } else if (label) {
      editor.chain().focus().insertContent(`<a href="${url}">${label}</a>`).run();
    }
    setShowLinkDialog(false);
    setLinkUrl("");
    setLinkLabel("");
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
        {campaignId && (!existing || ["draft", "scheduled", "cancelled"].includes(existing.status)) && (
          <button onClick={handlePreview} disabled={saving} className="btn btn-sm">
            Send Preview
          </button>
        )}
        <button
          onClick={() => setShowConfirm(true)}
          disabled={saving || !editable || !name.trim() || !subject.trim()}
          className="btn btn-sm btn-primary"
        >
          {saving ? "Saving..." : "Schedule & Send"}
        </button>
      </PageHeader>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {error && (
          <div className="card" style={{ marginBottom: "var(--gap)", color: "var(--red)", fontSize: 12, fontWeight: 600, padding: "10px 14px" }}>
            {error}
            <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 14 }}>✕</button>
          </div>
        )}
        {success && (
          <div className="card" style={{ marginBottom: "var(--gap)", color: "var(--green)", fontSize: 12, fontWeight: 600, padding: "10px 14px" }}>
            {success}
            <button onClick={() => setSuccess("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "var(--green)", fontSize: 14 }}>✕</button>
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
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
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
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
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
                    {showSource ? "Editor" : "Source"}
                  </button>
                </div>
              </div>

              {!showSource ? (
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
                          setLinkLabel(selected);
                          setLinkUrl(existingHref);
                          setShowLinkDialog(true);
                        }}
                        className={`btn btn-sm ${editor.isActive("link") ? "btn-primary" : "btn-ghost"}`}
                        type="button"
                      >
                        Link
                      </button>
                      {templateVars.length > 0 && (
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
                              {templateVars.map((v) => (
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
                  value={sourceHtml}
                  onChange={(e) => setSourceHtml(e.target.value)}
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
                value={audienceType as typeof AUDIENCE_OPTIONS[number]["value"]}
                onChange={setAudienceType}
                disabled={!editable}
              />

              {audienceType === "segment" && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1.5px solid var(--bg-dark)", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Signed up after</div>
                    <input type="date" value={signedUpAfter} onChange={(e) => setSignedUpAfter(e.target.value)} className="input" disabled={!editable} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Signed up before</div>
                    <input type="date" value={signedUpBefore} onChange={(e) => setSignedUpBefore(e.target.value)} className="input" disabled={!editable} />
                  </div>
                </div>
              )}

              {audienceType === "selected" && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1.5px solid var(--bg-dark)" }}>
                  <MultiUserSelect
                    users={users}
                    selectedIds={selectedUserIds}
                    onChange={setSelectedUserIds}
                    manualEmails={manualEmails}
                    onManualEmailsChange={setManualEmails}
                    disabled={!editable}
                  />
                </div>
              )}
            </div>

            <div className="card" style={{ padding: "14px 16px" }}>
              <div className="section-label" style={{ marginBottom: 10 }}>Schedule</div>
              <RadioGroup
                options={SCHEDULE_OPTIONS}
                value={scheduleType as typeof SCHEDULE_OPTIONS[number]["value"]}
                onChange={setScheduleType}
                disabled={!editable}
              />

              {scheduleType === "once" && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1.5px solid var(--bg-dark)" }}>
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input" disabled={!editable} />
                </div>
              )}

              {scheduleType === "recurring" && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1.5px solid var(--bg-dark)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Cron expression</div>
                  <input
                    type="text"
                    value={cronExpr}
                    onChange={(e) => setCronExpr(e.target.value)}
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
                vars={templateVars}
                onChange={setTemplateVars}
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
                    value={existing.sent_count > 0 ? `${Math.round((existing.opened_count / existing.sent_count) * 100)}%` : "—"}
                    highlight={existing.sent_count > 0 ? "var(--green)" : undefined}
                  />
                  <StatRow
                    label="Click rate"
                    value={existing.opened_count > 0 ? `${Math.round((existing.clicked_count / existing.opened_count) * 100)}%` : "—"}
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
        open={showConfirm}
        title="Schedule & Send Campaign"
        confirmLabel={scheduleType === "now" ? "Send Now" : "Schedule"}
        onConfirm={scheduleAndSend}
        onCancel={() => setShowConfirm(false)}
        loading={saving}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div><strong>Campaign:</strong> {name || "Untitled"}</div>
          <div><strong>Subject:</strong> {subject || "No subject"}</div>
          <div><strong>Audience:</strong> {AUDIENCE_OPTIONS.find((o) => o.value === audienceType)?.label}</div>
          <div>
            <strong>Schedule:</strong>{" "}
            {scheduleType === "now" ? "Immediately" : scheduleType === "once" ? scheduledAt || "Not set" : `Recurring: ${cronExpr || "Not set"}`}
          </div>
          {templateVars.length > 0 && (
            <div><strong>Template vars:</strong> {templateVars.map((v) => `{{${v.key}}}`).join(", ")}</div>
          )}
        </div>
      </ConfirmDialog>

      {showPreview && (
        <RenderPreview html={previewHtml} onClose={() => setShowPreview(false)} />
      )}

      {showLinkDialog && (
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
          onClick={() => setShowLinkDialog(false)}
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
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
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
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
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
                onClick={() => { setShowLinkDialog(false); setLinkUrl(""); setLinkLabel(""); }}
                className="btn btn-sm btn-ghost"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleInsertLink}
                disabled={!linkUrl.trim()}
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
