// Customer profiles admin tab (Hissa 6): search customers by name/phone/email, see their
// spend/order/booking/review history at a glance, and open a detail view with their address,
// private admin notes, tags, review photos, coupons issued/used, a "Send Coupon" action
// (Hissa 7, with an optional start date), and a "Send Message" action for ad-hoc email/WhatsApp
// using the template library from Admin > Message Templates (Hissa 8, with a sender address
// picker). Backed by api/admin-customers.ts and api/admin-send-message.ts (separate from the
// generic adminApi since they aggregate/reach out).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, Mail, MapPin, MessageCircle, Search, Send, Star, Tag, Ticket, User, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { adminApi } from "./api.ts";
import { AdminButton, AdminCard, EmptyRow, FIELD, LABEL, Spinner } from "./ui.tsx";

type CustomerSummary = {
  id: string;
  customerId: string;
  fullName: string;
  phone: string;
  city: string;
  state: string;
  tags: string[];
  adminNotes: string | null;
  totalSpend: number;
  orderCount: number;
  bookingCount: number;
  reviewCount: number;
};

type CustomerCoupon = {
  id: string;
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  scope: "shop" | "booking" | "both";
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  used: boolean;
};

type CustomerDetail = {
  profile: {
    id: string;
    customer_number: number;
    full_name: string;
    phone: string;
    pincode: string;
    address_line1: string;
    address_line2: string;
    landmark: string | null;
    city: string;
    state: string;
    admin_notes: string | null;
    tags: string[];
    marketing_opt_out: boolean;
  };
  email: string | null;
  orders: { id: string; product_name: string; amount: number; status: string; created_at: string }[];
  bookings: { id: string; service: string; status: string; preferred_date: string }[];
  reviews: { id: string; rating: number; body: string; photo_urls: string[] | null; created_at: string }[];
  coupons: CustomerCoupon[];
};

type CouponSettings = { default_discount_type: "percent" | "flat"; default_discount_value: number; default_scope: "shop" | "booking" | "both"; default_validity_days: number };
type MessageTemplate = { id: string; channel: "email" | "whatsapp"; name: string; subject: string | null; body: string };
type SenderAddress = { label: string; email: string };
type SiteSettingsRow = { sender_addresses?: SenderAddress[] };

const SUGGESTED_TAGS = ["VIP", "Regular", "New", "At Risk"];

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// IST is UTC+5:30 with no DST - a fixed offset conversion is always correct.
const IST_OFFSET_MIN = 330;
function istInputToUtcIso(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min) - IST_OFFSET_MIN * 60 * 1000).toISOString();
}

// Fills {{name}}, {{coupon}} and any other placeholder into a subject/body for previewing and
// sending ad-hoc messages - kept in sync with api/_lib/email.ts's fillTemplate on the server.
function fillPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

async function callCustomers<T>(password: string, query: string, init?: RequestInit): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(`/api/admin-customers${query}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), "x-admin-password": password, "Content-Type": "application/json" },
  });
  return { ok: res.ok, data: (await res.json()) as T };
}

async function callSendMessage<T>(password: string, query: string, init?: RequestInit): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(`/api/admin-send-message${query}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), "x-admin-password": password, "Content-Type": "application/json" },
  });
  return { ok: res.ok, data: (await res.json()) as T };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function CustomersTab({ password }: { password: string }) {
  const [customers, setCustomers] = useState<CustomerSummary[] | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    void callCustomers<{ customers?: CustomerSummary[]; error?: string }>(password, `?${params.toString()}`).then(({ ok, data }) => {
      if (ok) setCustomers(data.customers ?? []);
      else toast.error(data.error ?? "Could not load customers");
    });
  };
  useEffect(load, [password, debouncedSearch]);

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl">Customers</h2>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input className={`${FIELD} pl-9`} placeholder="Search by name, phone or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {customers === null ? (
        <EmptyRow>Loading customers...</EmptyRow>
      ) : customers.length === 0 ? (
        <EmptyRow>No customers found.</EmptyRow>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <button key={c.id} onClick={() => setOpenId(c.id)} className="text-left">
              <AdminCard className="h-full space-y-2 transition-colors hover:border-primary/40">
                <div className="flex items-center gap-2">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <User className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.fullName}</p>
                    <p className="text-xs text-muted-foreground">#{c.customerId} · {c.phone}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{c.city}, {c.state}</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Tag className="size-2.5" /> {t}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t pt-2 text-center text-xs">
                  <div>
                    <p className="font-semibold text-foreground">₹{c.totalSpend}</p>
                    <p className="text-muted-foreground">Spend</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{c.orderCount + c.bookingCount}</p>
                    <p className="text-muted-foreground">Orders/Bookings</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{c.reviewCount}</p>
                    <p className="text-muted-foreground">Reviews</p>
                  </div>
                </div>
              </AdminCard>
            </button>
          ))}
        </div>
      )}

      {openId && (
        <CustomerDetailDialog
          password={password}
          id={openId}
          onClose={() => setOpenId(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// Hissa 7 fix: personal coupons can now start on a specific future date/time, not just expire -
// matches the general Coupon form in Admin > Coupons.
function SendCouponDialog({ password, customerId, customerName, onClose }: { password: string; customerId: string; customerName: string; onClose: () => void }) {
  const [settings, setSettings] = useState<CouponSettings | null>(null);
  const [code, setCode] = useState(randomCode());
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [scope, setScope] = useState<"shop" | "booking" | "both">("both");
  const [startsDate, setStartsDate] = useState("");
  const [startsTime, setStartsTime] = useState("");
  const [validityDays, setValidityDays] = useState("7");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void adminApi.list<CouponSettings>(password, "coupon_settings").then(({ ok, data }) => {
      if (ok && data.row) {
        setSettings(data.row);
        setDiscountType(data.row.default_discount_type);
        setDiscountValue(String(data.row.default_discount_value));
        setScope(data.row.default_scope);
        setValidityDays(String(data.row.default_validity_days));
      }
    });
  }, [password]);

  const send = async () => {
    const value = Number(discountValue);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Please enter a valid discount value.");
      return;
    }
    if (startsDate && startsTime && validityDays) {
      const startsAt = istInputToUtcIso(startsDate, startsTime);
      if (startsAt && new Date(startsAt).getTime() > Date.now() + Number(validityDays) * 24 * 60 * 60 * 1000) {
        toast.error("The start date is after the expiry date. Please check the dates.");
        return;
      }
    }
    setSaving(true);
    const expiresAt = new Date(Date.now() + Number(validityDays || settings?.default_validity_days || 7) * 24 * 60 * 60 * 1000).toISOString();
    const { ok, data } = await adminApi.create(password, "coupons", {
      code,
      discount_type: discountType,
      discount_value: value,
      min_order_amount: 0,
      per_user_limit: 1,
      starts_at: istInputToUtcIso(startsDate, startsTime),
      expires_at: expiresAt,
      is_active: true,
      user_id: customerId,
      scope,
    });
    setSaving(false);
    if (!ok) {
      toast.error(data.error ?? "Could not create coupon");
      return;
    }
    toast.success(`Coupon ${code} created for ${customerName}. Use Send Message to share it.`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="font-serif text-2xl">Send Coupon</DialogTitle>
        <p className="text-sm text-muted-foreground">This coupon works only for {customerName}, once.</p>
        <div className="grid gap-4 pt-2">
          <div>
            <div className="flex items-center justify-between">
              <label className={LABEL}>Coupon Code</label>
              <button type="button" onClick={() => setCode(randomCode())} className="text-xs font-medium text-primary hover:underline">Regenerate</button>
            </div>
            <input className={`${FIELD} font-mono uppercase`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Discount Type</label>
              <select className={FIELD} value={discountType} onChange={(e) => setDiscountType(e.target.value as "percent" | "flat")}>
                <option value="percent">% Off</option>
                <option value="flat">₹ Off</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Value</label>
              <input type="number" min="0" className={FIELD} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Where can this be used?</label>
            <select className={FIELD} value={scope} onChange={(e) => setScope(e.target.value as "shop" | "booking" | "both")}>
              <option value="both">Shop & Booking</option>
              <option value="shop">Shop only</option>
              <option value="booking">Booking only</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Starts on (optional, India time)</label>
            <div className="flex gap-2">
              <input type="date" className={FIELD} value={startsDate} onChange={(e) => setStartsDate(e.target.value)} />
              <input type="time" className={FIELD} value={startsTime} onChange={(e) => setStartsTime(e.target.value)} />
            </div>
            <p className="pt-1 text-xs text-muted-foreground">Leave blank to make it active immediately.</p>
          </div>
          <div>
            <label className={LABEL}>Valid for (days from creation)</label>
            <input type="number" min="1" className={FIELD} value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <AdminButton variant="secondary" onClick={onClose} className="flex-1">Cancel</AdminButton>
            <AdminButton onClick={() => void send()} disabled={saving} className="flex-1">
              {saving && <Spinner />} <Send className="size-3.5" /> Create Coupon
            </AdminButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Send Message dialog (Hissa 8): pick an email or WhatsApp template (or write from scratch),
// fill in {{name}}/{{coupon}}, pick a verified sender address, preview, then send the email
// directly or open WhatsApp with the message pre-filled (WhatsApp has no server-side send API
// without a paid business account, so this opens wa.me with the text ready to go, and logs it
// for the customer's history). An unsubscribed customer's email send is blocked server-side.
function SendMessageDialog({
  password,
  customerId,
  customerName,
  customerPhone,
  customerEmail,
  marketingOptOut,
  senderAddresses,
  onClose,
}: {
  password: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  marketingOptOut: boolean;
  senderAddresses: SenderAddress[];
  onClose: () => void;
}) {
  const [channel, setChannel] = useState<"email" | "whatsapp">(customerEmail ? "email" : "whatsapp");
  const [templates, setTemplates] = useState<MessageTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState<string>("blank");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [coupon, setCoupon] = useState("");
  const [fromAddress, setFromAddress] = useState<string>(senderAddresses[0]?.email ?? "");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void callSendMessage<{ templates?: MessageTemplate[]; error?: string }>(password, `?resource=templates&channel=${channel}`).then(({ ok, data }) => {
      if (ok) setTemplates(data.templates ?? []);
    });
    setTemplateId("blank");
    setSubject("");
    setBody("");
  }, [password, channel]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates?.find((t) => t.id === id);
    setSubject(tpl?.subject ?? "");
    setBody(tpl?.body ?? "");
  };

  const vars = { name: customerName, coupon: coupon || "(no coupon)" };
  const filledSubject = fillPlaceholders(subject, vars);
  const filledBody = fillPlaceholders(body, vars);

  const sendEmail = async () => {
    if (!customerEmail) {
      toast.error("This customer has no email on file.");
      return;
    }
    if (marketingOptOut) {
      toast.error("This customer has unsubscribed from promotional emails.");
      return;
    }
    if (!filledSubject.trim() || !filledBody.trim()) {
      toast.error("Please fill in the subject and message.");
      return;
    }
    setSending(true);
    const { ok, data } = await callSendMessage<{ error?: string }>(password, "?action=send-email", {
      method: "POST",
      body: JSON.stringify({ userId: customerId, subject: filledSubject, html: filledBody, fromAddress: fromAddress || null }),
    });
    setSending(false);
    if (!ok) {
      toast.error(data.error ?? "Could not send email");
      return;
    }
    toast.success(`Email sent to ${customerEmail}`);
    onClose();
  };

  const sendWhatsapp = async () => {
    if (!filledBody.trim()) {
      toast.error("Please write a message.");
      return;
    }
    const digits = customerPhone.replace(/\D/g, "");
    const waNumber = digits.length === 10 ? `91${digits}` : digits;
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(filledBody)}`, "_blank");
    await callSendMessage(password, "?action=log-whatsapp", { method: "POST", body: JSON.stringify({ userId: customerId, body: filledBody }) }).catch(() => null);
    toast.success("WhatsApp opened with your message ready to send.");
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle className="font-serif text-2xl">Send Message to {customerName}</DialogTitle>
        <div className="grid gap-4 pt-2">
          <div className="flex gap-2">
            <button
              onClick={() => setChannel("email")}
              className={`flex-1 rounded-xl border-2 p-2 text-sm font-medium ${channel === "email" ? "border-primary bg-primary/5" : "border-input"}`}
            >
              <Mail className="mx-auto mb-1 size-4" /> Email {!customerEmail && "(no email)"}
            </button>
            <button
              onClick={() => setChannel("whatsapp")}
              className={`flex-1 rounded-xl border-2 p-2 text-sm font-medium ${channel === "whatsapp" ? "border-primary bg-primary/5" : "border-input"}`}
            >
              <MessageCircle className="mx-auto mb-1 size-4" /> WhatsApp
            </button>
          </div>

          {channel === "email" && marketingOptOut && (
            <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              This customer has unsubscribed from promotional emails. Sending here is blocked.
            </p>
          )}

          <div>
            <label className={LABEL}>Template</label>
            <select className={FIELD} value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="blank">Write from scratch</option>
              {templates?.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {channel === "email" && senderAddresses.length > 0 && (
            <div>
              <label className={LABEL}>Send from</label>
              <select className={FIELD} value={fromAddress} onChange={(e) => setFromAddress(e.target.value)}>
                {senderAddresses.map((a) => (
                  <option key={a.email} value={a.email}>{a.label} ({a.email})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={LABEL}>Coupon code to insert (optional, fills {"{{coupon}}"})</label>
            <input className={`${FIELD} font-mono uppercase`} value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" />
          </div>

          {channel === "email" && (
            <div>
              <label className={LABEL}>Subject</label>
              <input className={FIELD} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          )}
          <div>
            <label className={LABEL}>Message {channel === "email" ? "(HTML)" : ""}</label>
            <textarea className={`${FIELD} h-32 py-2 ${channel === "email" ? "font-mono text-xs" : ""}`} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>

          <div className="rounded-xl border bg-muted/40 p-3">
            <p className={LABEL}>Preview</p>
            {channel === "email" && <p className="pb-1 text-sm font-medium">{filledSubject}</p>}
            {channel === "email" ? (
              <div className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: filledBody }} />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{filledBody}</p>
            )}
          </div>

          <div className="flex gap-2">
            <AdminButton variant="secondary" onClick={onClose} className="flex-1">Cancel</AdminButton>
            {channel === "email" ? (
              <AdminButton onClick={() => void sendEmail()} disabled={sending || !customerEmail || marketingOptOut} className="flex-1">
                {sending && <Spinner />} <Mail className="size-3.5" /> Send Email
              </AdminButton>
            ) : (
              <AdminButton onClick={() => void sendWhatsapp()} className="flex-1">
                <MessageCircle className="size-3.5" /> Open WhatsApp
              </AdminButton>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomerDetailDialog({ password, id, onClose, onSaved }: { password: string; id: string; onClose: () => void; onSaved: () => void }) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingCoupon, setSendingCoupon] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [senderAddresses, setSenderAddresses] = useState<SenderAddress[]>([]);

  useEffect(() => {
    void callCustomers<{ customer?: CustomerDetail; error?: string }>(password, `?id=${encodeURIComponent(id)}`).then(({ ok, data }) => {
      if (ok && data.customer) {
        setDetail(data.customer);
        setNotes(data.customer.profile.admin_notes ?? "");
        setTags(data.customer.profile.tags ?? []);
      } else {
        toast.error(data.error ?? "Could not load customer");
      }
    });
    void adminApi.list<SiteSettingsRow>(password, "site_settings").then(({ ok, data }) => {
      if (ok) setSenderAddresses((data as unknown as { row?: SiteSettingsRow }).row?.sender_addresses ?? []);
    });
  }, [password, id]);

  const toggleTag = (tag: string) => setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  const addCustomTag = () => {
    const t = customTag.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag("");
  };

  const save = async () => {
    setSaving(true);
    const { ok, data } = await callCustomers<{ error?: string }>(password, "", { method: "PATCH", body: JSON.stringify({ id, adminNotes: notes, tags }) });
    setSaving(false);
    if (!ok) {
      toast.error(data.error ?? "Could not save");
      return;
    }
    toast.success("Saved");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle className="font-serif text-2xl">Customer Details</DialogTitle>
        {!detail ? (
          <EmptyRow>Loading...</EmptyRow>
        ) : (
          <div className="grid gap-5 pt-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{detail.profile.full_name}</p>
                <p className="text-sm text-muted-foreground">#{String(detail.profile.customer_number).padStart(6, "0")} · {detail.profile.phone}</p>
                {detail.email && <p className="text-sm text-muted-foreground">{detail.email}</p>}
                {detail.profile.marketing_opt_out && (
                  <p className="pt-1 text-xs font-medium text-destructive">Unsubscribed from promotional emails</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <AdminButton variant="secondary" onClick={() => setSendingMessage(true)}>
                  <MessageCircle className="size-3.5" /> Send Message
                </AdminButton>
                <AdminButton variant="secondary" onClick={() => setSendingCoupon(true)}>
                  <Send className="size-3.5" /> Send Coupon
                </AdminButton>
              </div>
            </div>

            <div className="rounded-xl border p-3">
              <p className={LABEL}>
                <MapPin className="mr-1 inline size-3.5" /> Delivery Address
              </p>
              <p className="text-sm">
                {detail.profile.address_line1}
                {detail.profile.address_line2 ? `, ${detail.profile.address_line2}` : ""}
                {detail.profile.landmark ? ` (near ${detail.profile.landmark})` : ""}
              </p>
              <p className="text-sm text-muted-foreground">{detail.profile.city}, {detail.profile.state} - {detail.profile.pincode}</p>
            </div>

            <div>
              <label className={LABEL}>Tags</label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_TAGS.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${tags.includes(t) ? "border-primary bg-primary/10 text-primary" : "bg-background"}`}
                  >
                    {t}
                  </button>
                ))}
                {tags.filter((t) => !SUGGESTED_TAGS.includes(t)).map((t) => (
                  <button key={t} onClick={() => toggleTag(t)} className="flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {t} <X className="size-3" />
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <input className={FIELD} placeholder="Add a custom tag" value={customTag} onChange={(e) => setCustomTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomTag()} />
                <AdminButton variant="secondary" onClick={addCustomTag}>Add</AdminButton>
              </div>
            </div>

            <div>
              <label className={LABEL}>Private Admin Notes (customer never sees this)</label>
              <textarea className={`${FIELD} h-24 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Prefers gel over acrylic, allergic to X..." />
            </div>

            <div>
              <p className={LABEL}>Orders ({detail.orders.length})</p>
              {detail.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.orders.map((o) => (
                    <div key={o.id} className="flex justify-between text-sm">
                      <span className="truncate">{o.product_name}</span>
                      <span className="shrink-0 text-muted-foreground">₹{o.amount} · {o.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className={LABEL}>Bookings ({detail.bookings.length})</p>
              {detail.bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.bookings.map((b) => (
                    <div key={b.id} className="flex justify-between text-sm">
                      <span className="truncate">{b.service}</span>
                      <span className="shrink-0 text-muted-foreground">{b.preferred_date} · {b.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className={LABEL}>
                <Ticket className="mr-1 inline size-3.5" /> Coupons ({detail.coupons.length})
              </p>
              {detail.coupons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No coupons sent yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.coupons.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                      <span className="font-mono">{c.code}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.discount_type === "percent" ? `${c.discount_value}% off` : `₹${c.discount_value} off`} ·{" "}
                        {c.used ? "Used" : c.is_active ? "Not used yet" : "Inactive"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className={LABEL}>Reviews ({detail.reviews.length})</p>
              {detail.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.reviews.map((r) => (
                    <div key={r.id} className="rounded-xl border p-2 text-sm">
                      <div className="flex gap-0.5 text-primary">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star key={j} className="size-3" fill={j < r.rating ? "currentColor" : "none"} />
                        ))}
                      </div>
                      <p className="pt-1 text-muted-foreground">{r.body}</p>
                      {r.photo_urls && r.photo_urls.length > 0 && (
                        <div className="flex gap-1.5 pt-2">
                          {r.photo_urls.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noreferrer">
                              <img src={url} alt="Review photo" className="size-12 rounded-lg object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <AdminButton variant="secondary" onClick={onClose} className="flex-1">Close</AdminButton>
              <AdminButton onClick={() => void save()} disabled={saving} className="flex-1">
                {saving && <Spinner />} Save
              </AdminButton>
            </div>
          </div>
        )}

        {sendingCoupon && detail && (
          <SendCouponDialog password={password} customerId={detail.profile.id} customerName={detail.profile.full_name} onClose={() => setSendingCoupon(false)} />
        )}
        {sendingMessage && detail && (
          <SendMessageDialog
            password={password}
            customerId={detail.profile.id}
            customerName={detail.profile.full_name}
            customerPhone={detail.profile.phone}
            customerEmail={detail.email}
            marketingOptOut={detail.profile.marketing_opt_out}
            senderAddresses={senderAddresses}
            onClose={() => setSendingMessage(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
