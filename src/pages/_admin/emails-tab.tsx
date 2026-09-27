// Emails admin tab: every automatic email the website sends (orders, bookings, and alerts to the
// owner). Each one can be switched on/off, have its subject + HTML design edited/previewed, and
// pick which verified sender address to send from (Hissa 8 fix) instead of one hardcoded address.
// Sending needs RESEND_API_KEY (and EMAIL_FROM as a fallback) in Vercel env vars.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, Mail, Plus, Save, Trash2 } from "lucide-react";
import { adminApi } from "./api.ts";
import { AdminButton, AdminCard, EmptyRow, FIELD, LABEL, Spinner, Toggle } from "./ui.tsx";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";

type EmailTemplate = { key: string; name: string; audience: "customer" | "admin"; subject: string; html: string; enabled: boolean; from_address: string | null };
type SenderAddress = { label: string; email: string };
type SiteSettingsRow = { sender_addresses?: SenderAddress[] };

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

// Admin > Emails > Sender Addresses: the list of verified "from" addresses (e.g. support@,
// offers@) that any automatic or ad-hoc email can be sent from. Each address must already be
// verified with the email provider (Resend) - this list is just labels the admin can pick from.
function SenderAddressesCard({ password }: { password: string }) {
  const [addresses, setAddresses] = useState<SenderAddress[] | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void adminApi.list<SiteSettingsRow>(password, "site_settings").then(({ ok, data }) => {
      if (ok) setAddresses((data as unknown as { row?: SiteSettingsRow }).row?.sender_addresses ?? []);
    });
  }, [password]);

  const save = async (next: SenderAddress[]) => {
    setSaving(true);
    const { ok, data } = await adminApi.update(password, "site_settings", { sender_addresses: next });
    setSaving(false);
    if (!ok) {
      toast.error(data.error ?? "Could not save sender addresses");
      return;
    }
    setAddresses(next);
    toast.success("Sender addresses saved");
  };

  const add = () => {
    if (!newLabel.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail.trim())) {
      toast.error("Please enter a label and a valid email address.");
      return;
    }
    void save([...(addresses ?? []), { label: newLabel.trim(), email: newEmail.trim().toLowerCase() }]);
    setNewLabel("");
    setNewEmail("");
  };

  const remove = (email: string) => void save((addresses ?? []).filter((a) => a.email !== email));

  return (
    <AdminCard className="space-y-3">
      <div>
        <p className="font-medium">Sender Addresses</p>
        <p className="text-xs text-muted-foreground">Verified addresses (e.g. support@, offers@) any email can be sent from. Each must already be verified with your email provider (Resend).</p>
      </div>
      {addresses === null ? (
        <EmptyRow>Loading...</EmptyRow>
      ) : (
        <div className="space-y-2">
          {addresses.map((a) => (
            <div key={a.email} className="flex items-center justify-between rounded-xl border p-2 text-sm">
              <span>{a.label} <span className="text-muted-foreground">({a.email})</span></span>
              <AdminButton variant="danger" onClick={() => remove(a.email)} disabled={saving}>
                <Trash2 className="size-3.5" />
              </AdminButton>
            </div>
          ))}
          {addresses.length === 0 && <p className="text-sm text-muted-foreground">No sender addresses added yet.</p>}
        </div>
      )}
      <div className="flex gap-2">
        <input className={FIELD} placeholder="Label, e.g. Support" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        <input className={FIELD} placeholder="support@yourdomain.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <AdminButton onClick={add} disabled={saving}><Plus className="size-4" /></AdminButton>
      </div>
    </AdminCard>
  );
}

function TemplateEditor({ password, initial, senderAddresses }: { password: string; initial: EmailTemplate; senderAddresses: SenderAddress[] }) {
  const [form, setForm] = useState(initial);
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const vars = form.key.includes("booking") ? BOOKING_VARS : ORDER_VARS;

  const save = async (next: EmailTemplate) => {
    setSaving(true);
    const { ok, data } = await adminApi.update(password, "email_templates", { key: next.key, subject: next.subject, html: next.html, enabled: next.enabled, from_address: next.from_address });
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
          {senderAddresses.length > 0 && (
            <div>
              <label className={LABEL}>Send from</label>
              <select className={FIELD} value={form.from_address ?? ""} onChange={(e) => setForm({ ...form, from_address: e.target.value || null })}>
                <option value="">Default (from EMAIL_FROM)</option>
                {senderAddresses.map((a) => (
                  <option key={a.email} value={a.email}>{a.label} ({a.email})</option>
                ))}
              </select>
            </div>
          )}
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
  const [senderAddresses, setSenderAddresses] = useState<SenderAddress[]>([]);

  useEffect(() => {
    void adminApi.list<EmailTemplate>(password, "email_templates").then(({ ok, data }) => {
      if (ok) setTemplates(data.rows ?? []);
      else toast.error(data.error ?? "Could not load emails");
    });
    void adminApi.list<SiteSettingsRow>(password, "site_settings").then(({ ok, data }) => {
      if (ok) setSenderAddresses((data as unknown as { row?: SiteSettingsRow }).row?.sender_addresses ?? []);
    });
  }, [password]);

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl">Emails</h2>
      <p className="text-sm text-muted-foreground">Switch each email on or off, edit its design, and choose which address it sends from. Customer emails go to the email they signed in or booked with.</p>
      <SenderAddressesCard password={password} />
      {templates === null ? (
        <EmptyRow>Loading emails...</EmptyRow>
      ) : templates.length === 0 ? (
        <EmptyRow>No email templates found.</EmptyRow>
      ) : (
        templates.map((t) => <TemplateEditor key={t.key} password={password} initial={t} senderAddresses={senderAddresses} />)
      )}
    </div>
  );
}
