// Contact & Social admin tab. Split into three clear sections so the admin is never confused:
//  1. Footer contact details - each line has its value + its own On/Off switch + live preview.
//  2. Floating social icons - on/off + link per icon.
//  3. Brand & other details (brand, byline, GSTIN, delivery note).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import FooterContact from "@/components/footer-contact.tsx";
import { adminApi } from "./api.ts";
import { AdminButton, AdminCard, FIELD, LABEL, Spinner, Toggle } from "./ui.tsx";

type SettingsRow = {
  brand: string;
  byline: string | null;
  whatsapp_number: string | null;
  phone: string | null;
  email: string | null;
  instagram_user: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  telegram_url: string | null;
  maps_url: string | null;
  address: string | null;
  hours: { day: string; time: string }[] | null;
  delivery_note: string | null;
  gstin: string | null;
  show_whatsapp: boolean;
  show_instagram: boolean;
  show_facebook: boolean;
  show_youtube: boolean;
  show_x: boolean;
  show_telegram: boolean;
  show_footer_email: boolean;
  show_footer_whatsapp: boolean;
  show_footer_phone: boolean;
  show_footer_address: boolean;
  show_footer_maps: boolean;
  show_footer_hours: boolean;
};

const EMPTY: SettingsRow = {
  brand: "",
  byline: "",
  whatsapp_number: "",
  phone: "",
  email: "",
  instagram_user: "",
  instagram_url: "",
  facebook_url: "",
  youtube_url: "",
  x_url: "",
  telegram_url: "",
  maps_url: "",
  address: "",
  hours: [],
  delivery_note: "",
  gstin: "",
  show_whatsapp: true,
  show_instagram: true,
  show_facebook: false,
  show_youtube: false,
  show_x: false,
  show_telegram: false,
  show_footer_email: true,
  show_footer_whatsapp: true,
  show_footer_phone: true,
  show_footer_address: true,
  show_footer_maps: true,
  show_footer_hours: true,
};

type TextKey = { [K in keyof SettingsRow]: SettingsRow[K] extends string | null ? K : never }[keyof SettingsRow];
type BoolKey = { [K in keyof SettingsRow]: SettingsRow[K] extends boolean ? K : never }[keyof SettingsRow];

// Footer contact lines: value field + its own switch. (Hours is handled separately below.)
const FOOTER_LINES: { label: string; valueKey: TextKey; showKey: BoolKey; placeholder: string; multiline?: boolean }[] = [
  { label: "Support Email", valueKey: "email", showKey: "show_footer_email", placeholder: "support@boldandbrilliant.in" },
  { label: "WhatsApp Number (country code, digits only)", valueKey: "whatsapp_number", showKey: "show_footer_whatsapp", placeholder: "919876543210" },
  { label: "Call Number", valueKey: "phone", showKey: "show_footer_phone", placeholder: "+91 98765 43210" },
  { label: "Studio Address", valueKey: "address", showKey: "show_footer_address", placeholder: "Shop no., street, area, Rajkot", multiline: true },
  { label: "Google Maps Link", valueKey: "maps_url", showKey: "show_footer_maps", placeholder: "https://maps.app.goo.gl/..." },
];

// Floating social icons: switch + link field.
const SOCIAL_LINES: { label: string; showKey: BoolKey; linkKey: TextKey | null; placeholder: string }[] = [
  { label: "WhatsApp", showKey: "show_whatsapp", linkKey: null, placeholder: "" },
  { label: "Instagram", showKey: "show_instagram", linkKey: "instagram_url", placeholder: "https://instagram.com/..." },
  { label: "Facebook", showKey: "show_facebook", linkKey: "facebook_url", placeholder: "https://facebook.com/..." },
  { label: "YouTube", showKey: "show_youtube", linkKey: "youtube_url", placeholder: "https://youtube.com/..." },
  { label: "X (Twitter)", showKey: "show_x", linkKey: "x_url", placeholder: "https://x.com/..." },
  { label: "Telegram", showKey: "show_telegram", linkKey: "telegram_url", placeholder: "https://t.me/..." },
];

const OTHER_FIELDS: { key: TextKey; label: string; placeholder?: string }[] = [
  { key: "brand", label: "Brand Name" },
  { key: "byline", label: "Byline" },
  { key: "instagram_user", label: "Instagram Username" },
  { key: "gstin", label: "GSTIN (optional, shown on invoices)" },
  { key: "delivery_note", label: "Delivery Note" },
];

function SectionTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

export default function SiteSettingsTab({ password }: { password: string }) {
  const [form, setForm] = useState<SettingsRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void adminApi.list<SettingsRow>(password, "site_settings").then(({ ok, data }) => {
      if (ok) setForm({ ...EMPTY, ...((data as unknown as { row?: SettingsRow }).row ?? {}) });
      else toast.error(data.error ?? "Could not load site settings");
    });
  }, [password]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const { ok, data } = await adminApi.update(password, "site_settings", form);
    setSaving(false);
    if (!ok) {
      toast.error(data.error ?? "Could not save settings");
      return;
    }
    toast.success("Site details updated");
  };

  if (!form) return <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>;

  const set = <K extends keyof SettingsRow>(key: K, value: SettingsRow[K]) => setForm({ ...form, [key]: value });
  const hours = form.hours ?? [];
  const updateHour = (i: number, field: "day" | "time", value: string) =>
    set("hours", hours.map((h, idx) => (idx === i ? { ...h, [field]: value } : h)));

  const preview = {
    email: form.email ?? "",
    whatsappNumber: form.whatsapp_number ?? "",
    phone: form.phone ?? "",
    address: form.address ?? "",
    mapsUrl: form.maps_url ?? "",
    hours,
    showFooterEmail: form.show_footer_email,
    showFooterWhatsapp: form.show_footer_whatsapp,
    showFooterPhone: form.show_footer_phone,
    showFooterAddress: form.show_footer_address,
    showFooterMaps: form.show_footer_maps,
    showFooterHours: form.show_footer_hours,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-2xl">Contact & Social</h2>
        <AdminButton onClick={() => void save()} disabled={saving}>
          {saving ? <Spinner /> : <Save className="size-4" />} Save Changes
        </AdminButton>
      </div>

      {/* 1. Footer contact details */}
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <AdminCard className="space-y-4">
          <SectionTitle title="1. Footer Contact Details" sub="Each line has its own switch. Off = hidden from the website footer. Empty lines are hidden automatically." />
          {FOOTER_LINES.map((l) => (
            <div key={l.valueKey} className="space-y-1.5 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <label className={LABEL}>{l.label}</label>
                <Toggle checked={form[l.showKey]} onChange={(v) => set(l.showKey, v)} label={form[l.showKey] ? "Shown" : "Hidden"} />
              </div>
              {l.multiline ? (
                <textarea className={`${FIELD} h-20 py-2`} placeholder={l.placeholder} value={form[l.valueKey] ?? ""} onChange={(e) => set(l.valueKey, e.target.value)} />
              ) : (
                <input className={FIELD} placeholder={l.placeholder} value={form[l.valueKey] ?? ""} onChange={(e) => set(l.valueKey, e.target.value)} />
              )}
            </div>
          ))}

          <div className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <label className={LABEL}>Opening Hours</label>
              <Toggle checked={form.show_footer_hours} onChange={(v) => set("show_footer_hours", v)} label={form.show_footer_hours ? "Shown" : "Hidden"} />
            </div>
            {hours.map((h, i) => (
              <div key={i} className="flex gap-2">
                <input className={FIELD} placeholder="Mon - Sat" value={h.day} onChange={(e) => updateHour(i, "day", e.target.value)} />
                <input className={FIELD} placeholder="10:00 AM - 8:00 PM" value={h.time} onChange={(e) => updateHour(i, "time", e.target.value)} />
                <AdminButton variant="danger" onClick={() => set("hours", hours.filter((_, idx) => idx !== i))}>
                  <Trash2 className="size-3.5" />
                </AdminButton>
              </div>
            ))}
            <AdminButton variant="secondary" onClick={() => set("hours", [...hours, { day: "", time: "" }])}>
              <Plus className="size-3.5" /> Add Row
            </AdminButton>
          </div>
        </AdminCard>

        <AdminCard className="h-fit space-y-3 lg:sticky lg:top-4">
          <SectionTitle title="Live Footer Preview" sub="This is exactly what customers will see." />
          <div className="rounded-xl border bg-secondary/40 p-4">
            <FooterContact settings={preview} />
            {Object.values(preview).every((v) => v !== true) && null}
          </div>
        </AdminCard>
      </div>

      {/* 2. Floating social icons */}
      <AdminCard className="space-y-4">
        <SectionTitle title="2. Social Icons" sub="Round icons shown in the footer and site. WhatsApp uses the number above." />
        <div className="grid gap-3 sm:grid-cols-2">
          {SOCIAL_LINES.map((s) => (
            <div key={s.showKey} className="space-y-1.5 rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <label className={LABEL}>{s.label}</label>
                <Toggle checked={form[s.showKey]} onChange={(v) => set(s.showKey, v)} label={form[s.showKey] ? "On" : "Off"} />
              </div>
              {s.linkKey && (
                <input className={FIELD} placeholder={s.placeholder} value={form[s.linkKey] ?? ""} onChange={(e) => set(s.linkKey as TextKey, e.target.value)} />
              )}
            </div>
          ))}
        </div>
      </AdminCard>

      {/* 3. Other details */}
      <AdminCard className="space-y-4">
        <SectionTitle title="3. Brand & Other Details" sub="Used on invoices, header and delivery info." />
        <div className="grid gap-4 sm:grid-cols-2">
          {OTHER_FIELDS.map((f) => (
            <div key={f.key}>
              <label className={LABEL}>{f.label}</label>
              <input className={FIELD} placeholder={f.placeholder} value={form[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminButton onClick={() => void save()} disabled={saving}>
        {saving ? <Spinner /> : <Save className="size-4" />} Save Changes
      </AdminButton>
    </div>
  );
}
