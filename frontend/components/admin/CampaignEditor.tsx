"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useAuth } from "@/lib/auth";
import { AppHeader, PageHeader } from "@/components/AppHeader";
import {
  useAdminCreateCampaign,
  useAdminUpdateCampaign,
  useAdminScheduleCampaign,
  useAdminPreviewCampaign,
  useAdminBuildAudience,
  useAdminUploadCsv,
  useAdminUsers,
  useAdminCampaign,
} from "@/lib/hooks";
import type { AdminCampaignDetail } from "@/lib/api";

interface CampaignEditorProps {
  existing?: AdminCampaignDetail;
}

const AUDIENCE_OPTIONS = [
  { value: "all_users", label: "All registered users" },
  { value: "segment", label: "Segment by sign-up date" },
  { value: "upload", label: "CSV upload" },
] as const;

const SCHEDULE_OPTIONS = [
  { value: "now", label: "Send immediately" },
  { value: "once", label: "Schedule for later" },
  { value: "recurring", label: "Recurring (cron)" },
] as const;

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

export function CampaignEditor({ existing }: CampaignEditorProps) {
  const { user } = useAuth();
  const router = useRouter();

  const createCampaign = useAdminCreateCampaign();
  const updateCampaign = useAdminUpdateCampaign();
  const scheduleCampaign = useAdminScheduleCampaign();
  const previewCampaign = useAdminPreviewCampaign();
  const buildAudience = useAdminBuildAudience();
  const uploadCsv = useAdminUploadCsv();
  const { data: users = [] } = useAdminUsers();

  const [name, setName] = useState(existing?.name || "");
  const [subject, setSubject] = useState(existing?.subject || "");
  const [fromEmail, setFromEmail] = useState(existing?.from_email || "");
  const [audienceType, setAudienceType] = useState(existing?.audience_type || "all_users");
  const [signedUpAfter, setSignedUpAfter] = useState("");
  const [signedUpBefore, setSignedUpBefore] = useState("");
  const [scheduleType, setScheduleType] = useState("now");
  const [cronExpr, setCronExpr] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState("");
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSave = async () => {
    if (!editor) return;
    setError("");

    try {
      const payload: Record<string, unknown> = {
        name,
        subject,
        html_body: editor.getHTML(),
        from_email: fromEmail || undefined,
        audience_type: audienceType,
        audience_config: audienceType === "segment" ? { signed_up_after: signedUpAfter || undefined, signed_up_before: signedUpBefore || undefined } : undefined,
      };

      let campaign;
      if (existing) {
        campaign = await updateCampaign.mutateAsync({ id: existing.id, data: payload });
      } else {
        campaign = await createCampaign.mutateAsync(payload as any);
      }

      await scheduleCampaign.mutateAsync({
        id: campaign.id,
        data: {
          schedule_type: scheduleType,
          cron_expr: scheduleType === "recurring" ? cronExpr : undefined,
          scheduled_at: scheduleType === "once" ? scheduledAt : undefined,
        },
      });

      if (audienceType !== "upload") {
        await buildAudience.mutateAsync(campaign.id);
      }

      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const handlePreview = async () => {
    if (!existing) return;
    try {
      const result = await previewCampaign.mutateAsync(existing.id);
      alert(result.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Preview failed");
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !existing) return;
    try {
      await uploadCsv.mutateAsync({ id: existing.id, file });
      alert("CSV uploaded — audience built");
      e.target.value = "";
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const editable = !existing || existing.status === "draft" || existing.status === "scheduled";
  const isNew = !existing;

  if (!user) return null;

  return (
    <div className="page">
      <AppHeader breadcrumb={<span style={{ fontWeight: 600 }}>{isNew ? "New Campaign" : "Edit Campaign"}</span>} />
      <PageHeader>
        {existing && existing.status === "draft" && (
          <button onClick={handlePreview} className="btn btn-sm">Send Preview</button>
        )}
        <button onClick={handleSave} disabled={saving || !editable} className="btn btn-primary btn-sm">
          {saving ? "Saving..." : isNew ? "Create Campaign" : "Save Changes"}
        </button>
        <button onClick={() => router.push("/admin")} className="btn btn-sm btn-ghost">Cancel</button>
      </PageHeader>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--gap) var(--page-px)", width: "100%" }}>
        {error && (
          <div className="card" style={{ marginBottom: "var(--gap)", color: "var(--red)", fontSize: 12, fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: "var(--gap)", gridTemplateColumns: "2fr 1fr" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
            <div className="card">
              <div className="section-label" style={{ marginBottom: 8 }}>Campaign Name</div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="e.g. Weekly Newsletter"
                disabled={!editable}
              />
            </div>

            <div className="card">
              <div className="section-label" style={{ marginBottom: 8 }}>Email Subject</div>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input"
                placeholder="Subject line"
                disabled={!editable}
              />
            </div>

            <div className="card">
              <div className="section-label" style={{ marginBottom: 8 }}>From Email</div>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="input"
                placeholder="marketing@emails.getcleanroom.xyz"
                disabled={!editable}
              />
            </div>

            <div className="card">
              <div className="section-label" style={{ marginBottom: 8 }}>Email Body</div>
              {editor && (
                <div style={{ marginBottom: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
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
                  <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`btn btn-sm ${editor.isActive("bulletList") ? "btn-primary" : "btn-ghost"}`}
                    type="button"
                  >
                    List
                  </button>
                  <button
                    onClick={() => {
                      const url = prompt("Enter URL:");
                      if (url) editor.chain().focus().setLink({ href: url }).run();
                    }}
                    className={`btn btn-sm ${editor.isActive("link") ? "btn-primary" : "btn-ghost"}`}
                    type="button"
                  >
                    Link
                  </button>
                </div>
              )}
              <EditorContent editor={editor} disabled={!editable} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
            <div className="card">
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

              {audienceType === "upload" && existing && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1.5px solid var(--bg-dark)" }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    style={{ fontSize: 11, width: "100%" }}
                    disabled={!editable}
                  />
                </div>
              )}
            </div>

            <div className="card">
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

            {existing && (
              <div className="card">
                <div
                  className="section-label"
                  style={{
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: "2px solid var(--border)",
                  }}
                >
                  Stats
                </div>
                <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <StatRow label="Status" value={existing.status} />
                  <StatRow label="Recipients" value={String(existing.total_recipients)} />
                  <StatRow label="Sent" value={String(existing.sent_count)} />
                  <StatRow label="Opened" value={String(existing.opened_count)} />
                  <StatRow label="Clicked" value={String(existing.clicked_count)} />
                  {existing.scheduled_at && <StatRow label="Scheduled" value={new Date(existing.scheduled_at).toLocaleString()} />}
                  {existing.last_sent_at && <StatRow label="Last sent" value={new Date(existing.last_sent_at).toLocaleString()} />}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
