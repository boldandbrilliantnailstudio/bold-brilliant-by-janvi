// Message Templates admin tab (Hissa 8): a reusable library of email + WhatsApp messages the
// studio owner can write once and reuse when messaging a specific customer from Admin >
// Customers > Send Message. Separate from the fixed automatic order/booking emails in
// Admin > Emails - those never change from here.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail, MessageCircle, Plus, Save, Trash2 } from "lucide-react";
import { AdminButton, AdminCard, EmptyRow, FIELD, LABEL, Spinner } from "./ui.tsx";

type MessageTemplate = { id: string; channel: "email" | "whatsapp"; name: string; subject: string | null; body: string };

async function callTemplates<T>(password: string, query: string, init?: RequestInit): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(`/api/admin-send-message?resource=templates${query}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), "x-admin-password": password, "Content-Type": "application/json" },
  });
  return { ok: res.ok, data: (await res.json()) as T };
}

const PLACEHOLDER_HINT = "Fill in automatically: {{name}} {{coupon}}";

function TemplateCard({ password, template, onChanged }: { password: string; template: MessageTemplate; onChanged: () => void }) {
  const [form, setForm] = useState(template);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { ok, data } = await callTemplates<{ error?: string }>(password, "", { method: "PATCH", body: JSON.stringify({ id: form.id, name: form.name, subject: form.subject, body: form.body }) });
    setSaving(false);
    if (!ok) {
      toast.error(data.error ?? "Could not save template");
      return;
    }
    toast.success("Template saved");
    setOpen(false);
    onChanged();
  };

  const remove = async () => {
    if (!confirm(`Delete template "${form.name}"?`)) return;
    const { ok, data } = await callTemplates<{ error?: string }>(password, `&id=${form.id}`, { method: "DELETE" });
    if (!ok) {
      toast.error(data.error ?? "Could not delete template");
      return;
    }
    toast.success("Template deleted");
    onChanged();
  };

  return (
    <AdminCard className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {form.channel === "email" ? <Mail className="size-5 text-primary" /> : <MessageCircle className="size-5 text-primary" />}
          <p className="font-medium">{form.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <AdminButton variant="secondary" onClick={() => setOpen(!open)}>{open ? "Close" : "Edit"}</AdminButton>
          <AdminButton variant="danger" onClick={() => void remove()}><Trash2 className="size-3.5" /></AdminButton>
        </div>
      </div>
      {open && (
        <div className="space-y-3">
          <div>
            <label className={LABEL}>Template Name</label>
            <input className={FIELD} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          {form.channel === "email" && (
            <div>
              <label className={LABEL}>Subject</label>
              <input className={FIELD} value={form.subject ?? ""} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
          )}
          <div>
            <label className={LABEL}>Message {form.channel === "email" ? "(HTML)" : ""}</label>
            <textarea className={`${FIELD} h-40 py-3 ${form.channel === "email" ? "font-mono text-xs" : ""}`} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <p className="pt-1 text-xs text-muted-foreground">{PLACEHOLDER_HINT}</p>
          </div>
          <AdminButton onClick={() => void save()} disabled={saving}>{saving ? <Spinner /> : <Save className="size-4" />} Save</AdminButton>
        </div>
      )}
    </AdminCard>
  );
}

function NewTemplateForm({ password, channel, onCreated }: { password: string; channel: "email" | "whatsapp"; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim() || !body.trim()) {
      toast.error("Please fill in the name and message.");
      return;
    }
    setSaving(true);
    const { ok, data } = await callTemplates<{ error?: string }>(password, "", { method: "POST", body: JSON.stringify({ channel, name, subject, body }) });
    setSaving(false);
    if (!ok) {
      toast.error(data.error ?? "Could not create template");
      return;
    }
    toast.success("Template added");
    setOpen(false);
    setName("");
    setSubject("");
    setBody("");
    onCreated();
  };

  if (!open) {
    return (
      <AdminButton variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New {channel === "email" ? "Email" : "WhatsApp"} Template
      </AdminButton>
    );
  }

  return (
    <AdminCard className="space-y-3">
      <div>
        <label className={LABEL}>Template Name</label>
        <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Personal discount" />
      </div>
      {channel === "email" && (
        <div>
          <label className={LABEL}>Subject</label>
          <input className={FIELD} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A little something for you, {{name}}!" />
        </div>
      )}
      <div>
        <label className={LABEL}>Message {channel === "email" ? "(HTML)" : ""}</label>
        <textarea className={`${FIELD} h-32 py-3 ${channel === "email" ? "font-mono text-xs" : ""}`} value={body} onChange={(e) => setBody(e.target.value)} placeholder={channel === "email" ? "<p>Hi {{name}}, here's {{coupon}} for you!</p>" : "Hi {{name}}! Here's {{coupon}} for you."} />
        <p className="pt-1 text-xs text-muted-foreground">{PLACEHOLDER_HINT}</p>
      </div>
      <div className="flex gap-2">
        <AdminButton variant="secondary" onClick={() => setOpen(false)} className="flex-1">Cancel</AdminButton>
        <AdminButton onClick={() => void create()} disabled={saving} className="flex-1">{saving && <Spinner />} Add</AdminButton>
      </div>
    </AdminCard>
  );
}

export default function TemplatesTab({ password }: { password: string }) {
  const [templates, setTemplates] = useState<MessageTemplate[] | null>(null);

  const load = () => {
    void callTemplates<{ templates?: MessageTemplate[]; error?: string }>(password, "").then(({ ok, data }) => {
      if (ok) setTemplates(data.templates ?? []);
      else toast.error(data.error ?? "Could not load templates");
    });
  };
  useEffect(load, [password]);

  const emailTemplates = templates?.filter((t) => t.channel === "email") ?? [];
  const whatsappTemplates = templates?.filter((t) => t.channel === "whatsapp") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl">Message Templates</h2>
        <p className="text-sm text-muted-foreground">Reusable emails and WhatsApp messages for Admin &gt; Customers &gt; Send Message.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Email Templates</h3>
          <NewTemplateForm password={password} channel="email" onCreated={load} />
        </div>
        {templates === null ? (
          <EmptyRow>Loading templates...</EmptyRow>
        ) : emailTemplates.length === 0 ? (
          <EmptyRow>No email templates yet.</EmptyRow>
        ) : (
          emailTemplates.map((t) => <TemplateCard key={t.id} password={password} template={t} onChanged={load} />)
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp Templates</h3>
          <NewTemplateForm password={password} channel="whatsapp" onCreated={load} />
        </div>
        {templates === null ? null : whatsappTemplates.length === 0 ? (
          <EmptyRow>No WhatsApp templates yet.</EmptyRow>
        ) : (
          whatsappTemplates.map((t) => <TemplateCard key={t.id} password={password} template={t} onChanged={load} />)
        )}
      </div>
    </div>
  );
}
