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
              <div className="section-label" style={{ marginBottom: 8 }}>Audience</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <input type="radio" name="audience" value="all_users" checked={audienceType === "all_users"} onChange={() => setAudienceType("all_users")} disabled={!editable} />
                  All registered users
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <input type="radio" name="audience" value="segment" checked={audienceType === "segment"} onChange={() => setAudienceType("segment")} disabled={!editable} />
                  Segment
                </label>

                {audienceType === "segment" && (
                  <div style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
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

                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <input type="radio" name="audience" value="upload" checked={audienceType === "upload"} onChange={() => setAudienceType("upload")} disabled={!editable} />
                  CSV upload
                </label>

                {audienceType === "upload" && existing && (
                  <div style={{ paddingLeft: 20 }}>
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
            </div>

            <div className="card">
              <div className="section-label" style={{ marginBottom: 8 }}>Schedule</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <input type="radio" name="schedule" value="now" checked={scheduleType === "now"} onChange={() => setScheduleType("now")} disabled={!editable} />
                  Send immediately on save
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <input type="radio" name="schedule" value="once" checked={scheduleType === "once"} onChange={() => setScheduleType("once")} disabled={!editable} />
                  Schedule for later
                </label>

                {scheduleType === "once" && (
                  <div style={{ paddingLeft: 20 }}>
                    <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input" disabled={!editable} />
                  </div>
                )}

                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <input type="radio" name="schedule" value="recurring" checked={scheduleType === "recurring"} onChange={() => setScheduleType("recurring")} disabled={!editable} />
                  Recurring
                </label>

                {scheduleType === "recurring" && (
                  <div style={{ paddingLeft: 20 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Cron expression</div>
                    <input
                      type="text"
                      value={cronExpr}
                      onChange={(e) => setCronExpr(e.target.value)}
                      className="input"
                      placeholder='e.g. "0 9 * * 1" (weekly Mon 9AM)'
                      disabled={!editable}
                    />
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                      Examples: 0 9 * * 1 (Mon 9AM), 0 0 1 * * (1st of month), */15 * * * * (every 15 min)
                    </div>
                  </div>
                )}
              </div>
            </div>

            {existing && (
              <div className="card">
                <div className="section-label" style={{ marginBottom: 8 }}>Stats</div>
                <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div>Status: <strong>{existing.status}</strong></div>
                  <div>Recipients: <strong>{existing.total_recipients}</strong></div>
                  <div>Sent: <strong>{existing.sent_count}</strong></div>
                  <div>Opened: <strong>{existing.opened_count}</strong></div>
                  <div>Clicked: <strong>{existing.clicked_count}</strong></div>
                  {existing.scheduled_at && <div>Scheduled: <strong>{new Date(existing.scheduled_at).toLocaleString()}</strong></div>}
                  {existing.last_sent_at && <div>Last sent: <strong>{new Date(existing.last_sent_at).toLocaleString()}</strong></div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
