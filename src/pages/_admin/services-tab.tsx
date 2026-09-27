// Services & Slots admin tab: manage bookable services (name, price, duration, photo, on/off,
// home visit, price show/hide) and the booking rules (working days, hours, slot length,
// customers per slot, holidays, global price switch).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Plus, Save, Trash2, X } from "lucide-react";
import { adminApi, fileToDataUrl } from "./api.ts";
import { AdminButton, AdminCard, EmptyRow, FIELD, LABEL, Spinner, Toggle } from "./ui.tsx";

type Service = {
  id: string;
  name: string;
  price: number | null;
  duration_minutes: number;
  image_url: string | null;
  is_active: boolean;
  allow_home_visit: boolean;
  show_price: boolean;
  sort_order: number;
};

type Settings = {
  working_days: number[];
  open_time: string;
  close_time: string;
  slot_minutes: number;
  per_slot: number;
  holidays: string[];
  show_prices: boolean;
  hidden_price_text: string;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ServiceCard({ password, service, onChange, onDelete }: { password: string; service: Service; onChange: (s: Service) => void; onDelete: () => void }) {
  const [s, setS] = useState(service);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof Service>(k: K, v: Service[K]) => setS({ ...s, [k]: v });

  const save = async () => {
    if (s.name.trim().length < 2) {
      toast.error("Please enter a service name");
      return;
    }
    setSaving(true);
    const { ok, data } = await adminApi.update<Service>(password, "services", { ...s, name: s.name.trim() });
    setSaving(false);
    if (!ok || !data.row) {
      toast.error(data.error ?? "Could not save service");
      return;
    }
    onChange(data.row);
    toast.success("Service saved");
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const { ok, data } = await adminApi.upload(password, await fileToDataUrl(file), "services");
      if (ok && data.url) set("image_url", data.url);
      else toast.error(data.error ?? "Upload failed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
    setUploading(false);
  };

  return (
    <AdminCard className="space-y-3">
      <div className="flex gap-3">
        <label className="grid size-20 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-2xl border bg-muted">
          {uploading ? <Spinner /> : s.image_url ? <img src={s.image_url} alt={s.name} className="size-full object-cover" /> : <ImagePlus className="size-5 text-muted-foreground" />}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        </label>
        <div className="grid flex-1 gap-2 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className={LABEL}>Service Name</label>
            <input className={FIELD} value={s.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={LABEL}>Price (₹)</label>
            <input type="number" min={0} className={FIELD} value={s.price ?? ""} onChange={(e) => set("price", e.target.value === "" ? null : Number(e.target.value))} />
          </div>
          <div>
            <label className={LABEL}>Duration (min)</label>
            <input type="number" min={15} step={15} className={FIELD} value={s.duration_minutes} onChange={(e) => set("duration_minutes", Number(e.target.value) || 60)} />
          </div>
          <div>
            <label className={LABEL}>Order</label>
            <input type="number" className={FIELD} value={s.sort_order} onChange={(e) => set("sort_order", Number(e.target.value) || 0)} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Toggle checked={s.is_active} onChange={(v) => set("is_active", v)} label={s.is_active ? "Bookable" : "Off"} />
        <Toggle checked={s.allow_home_visit} onChange={(v) => set("allow_home_visit", v)} label={s.allow_home_visit ? "Home visit: Yes" : "Home visit: No"} />
        <Toggle checked={s.show_price} onChange={(v) => set("show_price", v)} label={s.show_price ? "Price shown" : "Price hidden"} />
        {s.image_url && (
          <AdminButton variant="secondary" onClick={() => set("image_url", null)}>
            <X className="size-3.5" /> Photo
          </AdminButton>
        )}
        <div className="ml-auto flex gap-2">
          <AdminButton variant="danger" onClick={onDelete}>
            <Trash2 className="size-4" />
          </AdminButton>
          <AdminButton onClick={() => void save()} disabled={saving}>
            {saving ? <Spinner /> : <Save className="size-4" />} Save
          </AdminButton>
        </div>
      </div>
    </AdminCard>
  );
}

function SettingsCard({ password }: { password: string }) {
  const [s, setS] = useState<Settings | null>(null);
  const [holiday, setHoliday] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void adminApi.list<Settings>(password, "booking_settings").then(({ ok, data }) => {
      if (ok && data.row) setS({ ...data.row, open_time: data.row.open_time.slice(0, 5), close_time: data.row.close_time.slice(0, 5) });
      else toast.error(data.error ?? "Could not load booking settings");
    });
  }, [password]);

  if (!s) return <EmptyRow>Loading booking settings...</EmptyRow>;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  const save = async () => {
    if (s.open_time >= s.close_time) {
      toast.error("Closing time must be after opening time");
      return;
    }
    setSaving(true);
    const { ok, data } = await adminApi.update(password, "booking_settings", s);
    setSaving(false);
    if (ok) toast.success("Booking settings saved");
    else toast.error(data.error ?? "Could not save");
  };

  return (
    <AdminCard className="space-y-4">
      <p className="font-medium">Booking Settings</p>
      <div>
        <label className={LABEL}>Working Days</label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <Toggle
              key={d}
              label={d}
              checked={s.working_days.includes(i)}
              onChange={(on) => set("working_days", on ? [...s.working_days, i].sort() : s.working_days.filter((x) => x !== i))}
            />
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div>
          <label className={LABEL}>Opens</label>
          <input type="time" className={FIELD} value={s.open_time} onChange={(e) => set("open_time", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Closes</label>
          <input type="time" className={FIELD} value={s.close_time} onChange={(e) => set("close_time", e.target.value)} />
        </div>
        <div>
          <label className={LABEL}>Slot Length (min)</label>
          <input type="number" min={15} step={15} className={FIELD} value={s.slot_minutes} onChange={(e) => set("slot_minutes", Number(e.target.value) || 60)} />
        </div>
        <div>
          <label className={LABEL}>Customers per Slot</label>
          <input type="number" min={1} className={FIELD} value={s.per_slot} onChange={(e) => set("per_slot", Math.max(1, Number(e.target.value) || 1))} />
        </div>
      </div>
      <div>
        <label className={LABEL}>Holidays (closed dates)</label>
        <div className="flex gap-2">
          <input type="date" className={FIELD} value={holiday} onChange={(e) => setHoliday(e.target.value)} />
          <AdminButton
            variant="secondary"
            onClick={() => {
              if (holiday && !s.holidays.includes(holiday)) set("holidays", [...s.holidays, holiday].sort());
              setHoliday("");
            }}
          >
            <Plus className="size-4" /> Add
          </AdminButton>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {s.holidays.map((h) => (
            <button key={h} onClick={() => set("holidays", s.holidays.filter((x) => x !== h))} className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
              {new Date(`${h}T00:00`).toLocaleDateString("en-IN", { dateStyle: "medium" })} <X className="size-3" />
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2 rounded-xl border p-3">
        <div className="flex items-center justify-between gap-2">
          <label className={LABEL}>Show prices on booking form (all services)</label>
          <Toggle checked={s.show_prices} onChange={(v) => set("show_prices", v)} label={s.show_prices ? "Shown" : "Hidden"} />
        </div>
        <label className={LABEL}>Text when price is hidden</label>
        <input className={FIELD} placeholder="Price on request" value={s.hidden_price_text} onChange={(e) => set("hidden_price_text", e.target.value)} />
      </div>
      <AdminButton onClick={() => void save()} disabled={saving}>
        {saving ? <Spinner /> : <Save className="size-4" />} Save Settings
      </AdminButton>
    </AdminCard>
  );
}

export default function ServicesTab({ password }: { password: string }) {
  const [services, setServices] = useState<Service[] | null>(null);

  useEffect(() => {
    void adminApi.list<Service>(password, "services").then(({ ok, data }) => {
      if (ok) setServices(data.rows ?? []);
      else toast.error(data.error ?? "Could not load services");
    });
  }, [password]);

  const add = async () => {
    const { ok, data } = await adminApi.create<Service>(password, "services", {
      name: `New Service ${(services?.length ?? 0) + 1}`,
      sort_order: (services?.length ?? 0) + 1,
    });
    if (ok && data.row) setServices([...(services ?? []), data.row]);
    else toast.error(data.error ?? "Could not add service");
  };

  const remove = async (id: string) => {
    const { ok, data } = await adminApi.remove(password, "services", id);
    if (ok) setServices(services?.filter((s) => s.id !== id) ?? null);
    else toast.error(data.error ?? "Could not delete");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl">Services & Slots</h2>
        <AdminButton onClick={() => void add()}>
          <Plus className="size-4" /> Add Service
        </AdminButton>
      </div>
      <SettingsCard password={password} />
      {services === null ? (
        <EmptyRow>Loading services...</EmptyRow>
      ) : services.length === 0 ? (
        <EmptyRow>No services yet. Add your first one.</EmptyRow>
      ) : (
        services.map((s) => (
          <ServiceCard
            key={s.id}
            password={password}
            service={s}
            onChange={(n) => setServices(services.map((x) => (x.id === n.id ? n : x)))}
            onDelete={() => void remove(s.id)}
          />
        ))
      )}
    </div>
  );
}
