// Emails admin tab: every automatic email the website sends (orders, bookings, and alerts to the
// owner). Each one can be switched on/off and its subject + HTML design edited and previewed.
// Sending needs RESEND_API_KEY (and EMAIL_FROM for your own domain) in Vercel env vars.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, Mail, Save } from "lucide-react";
import { adminApi } from "./api.ts";
import { AdminButton, AdminCard, EmptyRow, FIELD, LABEL, Spinner, Toggle } from "./ui.tsx";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";

type EmailTemplate = { key: string; name: string; audience: "customer" | "admin"; subject: string; html: string; enabled: boolean };

const ORDER_VARS = "{{brand}} {{customer_name}} {{phone}} {{order_id}} {{product_name}} {{total}} {{courier}} {{tracking_number}}";
const BOOKING_VARS = "{{brand}} {{name}} {{phone}} {{booking_number}} {{service}} {{date}} {{time}} {{message}}";

// Full email preview in a popup, so the design can be checked without opening a new tab.
function PreviewDialog({ open, onOpenChange, subject, html }: { open: boolean; onOpenChange: (v: boolean) => void; subject: string; html: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-3 p-0 sm:max-w-3xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <DialogTitle>Email Preview</DialogTitle>
            <p className="pt-1 text-sm text-muted-foreground">{subject}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-secondary/40 p-4">
          <iframe title="Email preview" srcDoc={html} className="h-[70vh] w-full rounded-lg border bg-white" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateEditor({ password, initial }: { password: string; initial: EmailTemplate }) {
  const [form, setForm] = useState(initial);
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const vars = form.key.includes("booking") ? BOOKING_VARS : ORDER_VARS;

  const save = async (next: EmailTemplate) => {
    setSaving(true);
    const { ok, data } = await adminApi.update(password, "email_templates", { key: next.key, subject: next.subject, html: next.html, enabled: next.enabled });
    setSaving(false);
    if (!ok) {
      toast.error(data.error ?? "Could not save email");
      return false;
    }
    toast.success("Email saved");
    return true;
  };

  const toggle = async (enabled: boolean) => {
    const next = { ...form, enabled };
    if (await save(next)) setForm(next);
  };

  return (
    <AdminCard className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Mail className="size-5 text-primary" />
          <div>
            <p className="font-medium">{form.name}</p>
            <p className="text-xs text-muted-foreground">{form.audience === "admin" ? "Sent to you" : "Sent to customer"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Toggle checked={form.enabled} onChange={(v) => void toggle(v)} label={form.enabled ? "On" : "Off"} />
          <AdminButton variant="secondary" onClick={() => setPreviewOpen(true)}><Eye className="size-4" /> Preview</AdminButton>
          <AdminButton variant="secondary" onClick={() => setOpen(!open)}>{open ? "Close" : "Edit"}</AdminButton>
        </div>
      </div>
      {open && (
        <div className="space-y-3">
          <div>
            <label className={LABEL}>Subject</label>
            <input className={FIELD} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div>
            <label className={LABEL}>Email HTML</label>
            <textarea className={`${FIELD} h-64 py-3 font-mono text-xs`} value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} />
            <p className="pt-1 text-xs text-muted-foreground">Filled in automatically: {vars}</p>
          </div>
          <div className="flex gap-2">
            <AdminButton variant="secondary" onClick={() => setPreviewOpen(true)}><Eye className="size-4" /> Preview</AdminButton>
            <AdminButton onClick={() => void save(form)} disabled={saving}>{saving ? <Spinner /> : <Save className="size-4" />} Save</AdminButton>
          </div>
        </div>
      )}
      <PreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} subject={form.subject} html={form.html} />
    </AdminCard>
  );
}

export default function EmailsTab({ password }: { password: string }) {
  const [templates, setTemplates] = useState<EmailTemplate[] | null>(null);

  useEffect(() => {
    void adminApi.list<EmailTemplate>(password, "email_templates").then(({ ok, data }) => {
      if (ok) setTemplates(data.rows ?? []);
      else toast.error(data.error ?? "Could not load emails");
    });
  }, [password]);

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl">Emails</h2>
      <p className="text-sm text-muted-foreground">Switch each email on or off and edit its design. Customer emails go to the email they signed in or booked with.</p>
      {templates === null ? (
        <EmptyRow>Loading emails...</EmptyRow>
      ) : templates.length === 0 ? (
        <EmptyRow>No email templates found.</EmptyRow>
      ) : (
        templates.map((t) => <TemplateEditor key={t.key} password={password} initial={t} />)
      )}
    </div>
  );
}
