// Admin-only booking tools: create a booking for a customer (any date/time, even blocked
// slots) and reschedule an existing one. After a reschedule the admin can notify the customer
// on WhatsApp with a pre-filled, editable message.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Save, X } from "lucide-react";
import { adminApi } from "./api.ts";
import { AdminButton, AdminCard, FIELD, LABEL, Spinner } from "./ui.tsx";

export type AdminBooking = {
  id: string;
  booking_number: number;
  name: string;
  phone: string;
  email: string | null;
  preferred_date: string;
  preferred_time: string;
  service: string;
};

const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, "").replace(/^0+/, "");
  return d.length === 10 ? `91${d}` : d;
};

function useServiceNames(password: string) {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    void adminApi.list<{ name: string }>(password, "services").then(({ ok, data }) => ok && setNames((data.rows ?? []).map((s) => s.name)));
  }, [password]);
  return names;
}

export function NewBookingForm({ password, onCreated, onClose }: { password: string; onCreated: (b: AdminBooking) => void; onClose: () => void }) {
  const services = useServiceNames(password);
  const [f, setF] = useState({ name: "", phone: "", email: "", service: "", preferred_date: "", preferred_time: "", message: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });

  const save = async () => {
    if (f.name.trim().length < 2 || f.phone.replace(/\D/g, "").length < 10 || !f.service || !f.preferred_date || !f.preferred_time) {
      toast.error("Please fill name, phone, service, date and time");
      return;
    }
    setSaving(true);
    const { ok, data } = await adminApi.create<AdminBooking>(password, "bookings", {
      ...f,
      name: f.name.trim(),
      phone: f.phone.trim(),
      email: f.email.trim().toLowerCase() || null,
      message: f.message.trim() || null,
      status: "Confirmed",
      location_type: "studio",
      created_by_admin: true,
    });
    setSaving(false);
    if (!ok || !data.row) {
      toast.error(data.error ?? "Could not create booking");
      return;
    }
    toast.success(`Booking #${data.row.booking_number} created`);
    onCreated(data.row);
  };

  return (
    <AdminCard className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-medium">New Booking</p>
        <button onClick={onClose} aria-label="Close" className="cursor-pointer"><X className="size-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={LABEL}>Name</label><input className={FIELD} placeholder="Priya Shah" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label className={LABEL}>Phone</label><input className={FIELD} placeholder="+91 98765 43210" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><label className={LABEL}>Email (optional)</label><input className={FIELD} value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div>
          <label className={LABEL}>Service</label>
          <select className={FIELD} value={f.service} onChange={(e) => set("service", e.target.value)}>
            <option value="" disabled>Select</option>
            {services.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label className={LABEL}>Date</label><input type="date" className={FIELD} value={f.preferred_date} onChange={(e) => set("preferred_date", e.target.value)} /></div>
        <div><label className={LABEL}>Time</label><input type="time" className={FIELD} value={f.preferred_time} onChange={(e) => set("preferred_time", e.target.value)} /></div>
      </div>
      <input className={FIELD} placeholder="Note (optional)" value={f.message} onChange={(e) => set("message", e.target.value)} />
      <AdminButton onClick={() => void save()} disabled={saving}>
        {saving ? <Spinner /> : <CalendarPlus className="size-4" />} Create Booking
      </AdminButton>
    </AdminCard>
  );
}

export function RescheduleForm({ password, booking, onSaved }: { password: string; booking: AdminBooking; onSaved: (b: AdminBooking) => void }) {
  const [date, setDate] = useState(booking.preferred_date);
  const [time, setTime] = useState(booking.preferred_time.slice(0, 5));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { ok, data } = await adminApi.update<AdminBooking>(password, "bookings", { id: booking.id, preferred_date: date, preferred_time: time });
    setSaving(false);
    if (!ok || !data.row) {
      toast.error(data.error ?? "Could not reschedule");
      return;
    }
    onSaved(data.row);
    toast.success("Rescheduled. Notify the customer on WhatsApp.");
    const when = `${new Date(`${date}T00:00`).toLocaleDateString("en-IN", { dateStyle: "medium" })} at ${new Date(`1970-01-01T${time}`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
    const text = `Hi ${booking.name}, your ${booking.service} appointment (#${booking.booking_number}) has been rescheduled to ${when}. See you soon!`;
    window.open(`https://wa.me/${waNumber(booking.phone)}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border p-3">
      <div><label className={LABEL}>New Date</label><input type="date" className={FIELD} value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <div><label className={LABEL}>New Time</label><input type="time" className={FIELD} value={time} onChange={(e) => setTime(e.target.value)} /></div>
      <AdminButton onClick={() => void save()} disabled={saving}>
        {saving ? <Spinner /> : <Save className="size-4" />} Save & Notify
      </AdminButton>
    </div>
  );
}
