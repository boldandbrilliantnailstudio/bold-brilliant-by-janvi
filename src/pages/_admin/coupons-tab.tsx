// Coupons admin tab (Hissa 7): general coupons (anyone can use, code entered at checkout) plus
// personal coupons (tied to one customer, auto-generated code, sent to them directly - see
// "Send Coupon" in Admin > Customers). Coupon Settings holds the defaults every new coupon
// form starts from. Dates/times are entered and shown in IST; stored as UTC instants.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Settings, Tag, Trash2, User } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { adminApi } from "./api.ts";
import { AdminButton, AdminCard, EmptyRow, FIELD, LABEL, Spinner, Toggle } from "./ui.tsx";

type Scope = "shop" | "booking" | "both";

type Coupon = {
  id: string;
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  max_discount: number | null;
  min_order_amount: number;
  usage_limit: number | null;
  per_user_limit: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  user_id: string | null;
  scope: Scope;
};

type CouponSettings = {
  default_discount_type: "percent" | "flat";
  default_discount_value: number;
  default_scope: Scope;
  default_validity_days: number;
};

const SCOPE_LABEL: Record<Scope, string> = { shop: "Shop only", booking: "Booking only", both: "Shop & Booking" };

// IST is UTC+5:30 with no DST - a fixed offset conversion is always correct.
const IST_OFFSET_MIN = 330;
function istInputToUtcIso(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min) - IST_OFFSET_MIN * 60 * 1000).toISOString();
}
function utcIsoToIstInput(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const ist = new Date(new Date(iso).getTime() + IST_OFFSET_MIN * 60 * 1000);
  return {
    date: `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`,
    time: `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`,
  };
}

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

type FormState = {
  code: string;
  discountType: "percent" | "flat";
  discountValue: string;
  maxDiscount: string;
  minOrderAmount: string;
  usageLimit: string;
  perUserLimit: string;
  startsDate: string;
  startsTime: string;
  expiresDate: string;
  expiresTime: string;
  isActive: boolean;
  scope: Scope;
};

function emptyForm(settings: CouponSettings | null): FormState {
  const validityDays = settings?.default_validity_days ?? 7;
  const expires = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
  const istExpires = utcIsoToIstInput(expires.toISOString());
  return {
    code: randomCode(),
    discountType: settings?.default_discount_type ?? "percent",
    discountValue: String(settings?.default_discount_value ?? 10),
    maxDiscount: "",
    minOrderAmount: "",
    usageLimit: "",
    perUserLimit: "1",
    startsDate: "",
    startsTime: "",
    expiresDate: istExpires.date,
    expiresTime: istExpires.time,
    isActive: true,
    scope: settings?.default_scope ?? "both",
  };
}

export default function CouponsTab({ password }: { password: string }) {
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [settings, setSettings] = useState<CouponSettings | null>(null);
  const [editing, setEditing] = useState<Coupon | null | "new">(null);
  const [showSettings, setShowSettings] = useState(false);

  const load = () => {
    void adminApi.list<Coupon>(password, "coupons").then(({ ok, data }) => {
      if (ok) setCoupons(data.rows ?? []);
      else toast.error(data.error ?? "Could not load coupons");
    });
  };
  const loadSettings = () => {
    void adminApi.list<CouponSettings>(password, "coupon_settings").then(({ ok, data }) => {
      if (ok && data.row) setSettings(data.row);
    });
  };
  useEffect(load, [password]);
  useEffect(loadSettings, [password]);

  const toggleActive = async (c: Coupon, value: boolean) => {
    const { ok, data } = await adminApi.update<Coupon>(password, "coupons", { id: c.id, is_active: value });
    if (!ok) {
      toast.error(data.error ?? "Could not update coupon");
      return;
    }
    setCoupons((prev) => prev?.map((x) => (x.id === c.id ? { ...x, is_active: value } : x)) ?? null);
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`Delete coupon "${c.code}"?`)) return;
    const { ok, data } = await adminApi.remove(password, "coupons", c.id);
    if (!ok) {
      toast.error(data.error ?? "Could not delete coupon");
      return;
    }
    setCoupons((prev) => prev?.filter((x) => x.id !== c.id) ?? null);
    toast.success("Coupon deleted");
  };

  const generalCoupons = coupons?.filter((c) => !c.user_id) ?? [];
  const personalCoupons = coupons?.filter((c) => !!c.user_id) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl">Coupons</h2>
        <div className="flex gap-2">
          <AdminButton variant="secondary" onClick={() => setShowSettings(true)}>
            <Settings className="size-4" /> Coupon Settings
          </AdminButton>
          <AdminButton onClick={() => setEditing("new")}>
            <Plus className="size-4" /> New Coupon
          </AdminButton>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">General Coupons</h3>
        {coupons === null ? (
          <EmptyRow>Loading coupons...</EmptyRow>
        ) : generalCoupons.length === 0 ? (
          <EmptyRow>No general coupons yet. Create one to offer a discount at checkout.</EmptyRow>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {generalCoupons.map((c) => (
              <CouponCard key={c.id} coupon={c} onToggle={toggleActive} onEdit={setEditing} onRemove={remove} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Personal Coupons {personalCoupons.length > 0 && `(${personalCoupons.length})`}
        </h3>
        <p className="text-xs text-muted-foreground">Sent to one specific customer. Create these from Admin &gt; Customers &gt; Send Coupon.</p>
        {personalCoupons.length === 0 ? (
          <EmptyRow>No personal coupons sent yet.</EmptyRow>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {personalCoupons.map((c) => (
              <CouponCard key={c.id} coupon={c} onToggle={toggleActive} onEdit={setEditing} onRemove={remove} personal />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <CouponFormDialog
          password={password}
          coupon={editing === "new" ? null : editing}
          settings={settings}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {showSettings && settings && (
        <CouponSettingsDialog password={password} settings={settings} onClose={() => setShowSettings(false)} onSaved={loadSettings} />
      )}
    </div>
  );
}

function CouponCard({
  coupon: c,
  onToggle,
  onEdit,
  onRemove,
  personal,
}: {
  coupon: Coupon;
  onToggle: (c: Coupon, v: boolean) => void;
  onEdit: (c: Coupon) => void;
  onRemove: (c: Coupon) => void;
  personal?: boolean;
}) {
  return (
    <AdminCard className="space-y-2">
      <div className="flex items-center gap-2">
        {personal ? <User className="size-4 text-primary" /> : <Tag className="size-4 text-primary" />}
        <p className="font-mono text-lg font-semibold">{c.code}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {c.discount_type === "percent" ? `${c.discount_value}% off` : `₹${c.discount_value} off`}
        {c.max_discount ? ` (max ₹${c.max_discount})` : ""} · Min order ₹{c.min_order_amount}
      </p>
      <p className="text-xs text-muted-foreground">
        {SCOPE_LABEL[c.scope]} · Used {c.used_count}
        {c.usage_limit ? ` / ${c.usage_limit}` : ""} times
      </p>
      {c.expires_at && <p className="text-xs text-muted-foreground">Expires {new Date(c.expires_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>}
      <Toggle checked={c.is_active} onChange={(v) => onToggle(c, v)} label={c.is_active ? "Active" : "Off"} />
      <div className="flex gap-2 pt-1">
        <AdminButton variant="secondary" onClick={() => onEdit(c)} className="flex-1">
          <Pencil className="size-3.5" /> Edit
        </AdminButton>
        <AdminButton variant="danger" onClick={() => onRemove(c)}>
          <Trash2 className="size-3.5" />
        </AdminButton>
      </div>
    </AdminCard>
  );
}

function CouponFormDialog({
  password,
  coupon,
  settings,
  onClose,
  onSaved,
}: {
  password: string;
  coupon: Coupon | null;
  settings: CouponSettings | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => {
    if (!coupon) return emptyForm(settings);
    const starts = utcIsoToIstInput(coupon.starts_at);
    const expires = utcIsoToIstInput(coupon.expires_at);
    return {
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: String(coupon.discount_value),
      maxDiscount: coupon.max_discount ? String(coupon.max_discount) : "",
      minOrderAmount: String(coupon.min_order_amount),
      usageLimit: coupon.usage_limit ? String(coupon.usage_limit) : "",
      perUserLimit: coupon.per_user_limit ? String(coupon.per_user_limit) : "",
      startsDate: starts.date,
      startsTime: starts.time,
      expiresDate: expires.date,
      expiresTime: expires.time,
      isActive: coupon.is_active,
      scope: coupon.scope,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const code = form.code.trim().toUpperCase();
    const discountValue = Number(form.discountValue);
    if (!/^[A-Z0-9]{3,30}$/.test(code)) {
      setError("Code must be 3-30 letters/numbers, no spaces.");
      return;
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0 || (form.discountType === "percent" && discountValue > 100)) {
      setError("Please enter a valid discount value.");
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      code,
      discount_type: form.discountType,
      discount_value: discountValue,
      max_discount: form.maxDiscount ? Number(form.maxDiscount) : null,
      min_order_amount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
      usage_limit: form.usageLimit ? Number(form.usageLimit) : null,
      per_user_limit: form.perUserLimit ? Number(form.perUserLimit) : null,
      starts_at: form.startsDate && form.startsTime ? istInputToUtcIso(form.startsDate, form.startsTime) : null,
      expires_at: form.expiresDate && form.expiresTime ? istInputToUtcIso(form.expiresDate, form.expiresTime) : null,
      is_active: form.isActive,
      scope: form.scope,
    };
    const { ok, data } = coupon
      ? await adminApi.update(password, "coupons", { id: coupon.id, ...body })
      : await adminApi.create(password, "coupons", body);
    setSaving(false);
    if (!ok) {
      setError(data.error ?? "Could not save coupon");
      return;
    }
    toast.success(coupon ? "Coupon updated" : "Coupon created");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle className="font-serif text-2xl">{coupon ? "Edit Coupon" : "New Coupon"}</DialogTitle>
        <div className="grid gap-4 pt-2">
          <div>
            <div className="flex items-center justify-between">
              <label className={LABEL}>Coupon Code</label>
              {!coupon && (
                <button type="button" onClick={() => setForm({ ...form, code: randomCode() })} className="text-xs font-medium text-primary hover:underline">
                  Generate new code
                </button>
              )}
            </div>
            <input className={`${FIELD} font-mono uppercase`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="WELCOME10" />
          </div>
          <div>
            <label className={LABEL}>Where can this be used?</label>
            <select className={FIELD} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as Scope })}>
              <option value="both">Shop & Booking</option>
              <option value="shop">Shop only</option>
              <option value="booking">Booking only</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Discount Type</label>
              <select className={FIELD} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as "percent" | "flat" })}>
                <option value="percent">% Off</option>
                <option value="flat">₹ Off</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Value</label>
              <input type="number" min="0" className={FIELD} value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
            </div>
          </div>
          {form.discountType === "percent" && (
            <div>
              <label className={LABEL}>Max discount amount (optional, ₹)</label>
              <input type="number" min="0" className={FIELD} value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
            </div>
          )}
          <div>
            <label className={LABEL}>Minimum order amount (₹)</label>
            <input type="number" min="0" className={FIELD} value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Total usage limit (optional)</label>
              <input type="number" min="1" className={FIELD} value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Per-customer limit (optional)</label>
              <input type="number" min="1" className={FIELD} value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} />
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground">Start & expiry (India time)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Starts (optional)</label>
              <div className="flex gap-2">
                <input type="date" className={FIELD} value={form.startsDate} onChange={(e) => setForm({ ...form, startsDate: e.target.value })} />
                <input type="time" className={FIELD} value={form.startsTime} onChange={(e) => setForm({ ...form, startsTime: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={LABEL}>Expires (optional)</label>
              <div className="flex gap-2">
                <input type="date" className={FIELD} value={form.expiresDate} onChange={(e) => setForm({ ...form, expiresDate: e.target.value })} />
                <input type="time" className={FIELD} value={form.expiresTime} onChange={(e) => setForm({ ...form, expiresTime: e.target.value })} />
              </div>
            </div>
          </div>
          <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={form.isActive ? "Active" : "Off"} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <AdminButton variant="secondary" onClick={onClose} className="flex-1">Cancel</AdminButton>
            <AdminButton onClick={() => void save()} disabled={saving} className="flex-1">
              {saving && <Spinner />} Save
            </AdminButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CouponSettingsDialog({
  password,
  settings,
  onClose,
  onSaved,
}: {
  password: string;
  settings: CouponSettings;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { ok, data } = await adminApi.update(password, "coupon_settings", form);
    setSaving(false);
    if (!ok) {
      toast.error(data.error ?? "Could not save settings");
      return;
    }
    toast.success("Coupon settings saved");
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="font-serif text-2xl">Coupon Settings</DialogTitle>
        <p className="text-sm text-muted-foreground">Defaults used every time you create a new coupon.</p>
        <div className="grid gap-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Default Discount Type</label>
              <select className={FIELD} value={form.default_discount_type} onChange={(e) => setForm({ ...form, default_discount_type: e.target.value as "percent" | "flat" })}>
                <option value="percent">% Off</option>
                <option value="flat">₹ Off</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Default Value</label>
              <input type="number" min="0" className={FIELD} value={form.default_discount_value} onChange={(e) => setForm({ ...form, default_discount_value: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Default Scope</label>
            <select className={FIELD} value={form.default_scope} onChange={(e) => setForm({ ...form, default_scope: e.target.value as Scope })}>
              <option value="both">Shop & Booking</option>
              <option value="shop">Shop only</option>
              <option value="booking">Booking only</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Default Validity (days from creation)</label>
            <input type="number" min="1" className={FIELD} value={form.default_validity_days} onChange={(e) => setForm({ ...form, default_validity_days: Number(e.target.value) })} />
          </div>
          <div className="flex gap-2">
            <AdminButton variant="secondary" onClick={onClose} className="flex-1">Cancel</AdminButton>
            <AdminButton onClick={() => void save()} disabled={saving} className="flex-1">
              {saving && <Spinner />} Save
            </AdminButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
