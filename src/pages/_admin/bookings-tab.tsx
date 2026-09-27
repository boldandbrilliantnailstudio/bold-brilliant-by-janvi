// Bookings admin tab: appointment requests from the website. Accept a booking, then send the
// customer a WhatsApp confirmation (opens their chat with the message pre-filled - just tap
// Send) and/or an email (uses the "Booking accepted/declined" template in Admin > Emails).
// Admin can also create a booking directly and reschedule any booking.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CalendarPlus, Check, Clock, Mail, MapPin, Save, X } from "lucide-react";
import { WhatsappLogo } from "@phosphor-icons/react";
import { adminApi } from "./api.ts";
import { AdminButton, AdminCard, EmptyRow, FIELD, LABEL, Spinner } from "./ui.tsx";
import { NewBookingForm, RescheduleForm } from "./booking-tools.tsx";

type Booking = {
  id: string;
  booking_number: number;
  name: string;
  phone: string;
  email: string | null;
  preferred_date: string;
  preferred_time: string;
  service: string;
  message: string | null;
  status: "New" | "Confirmed" | "Completed" | "Cancelled";
  created_at: string;
  location_type: "studio" | "home";
  location_address: string | null;
  created_by_admin?: boolean;
};

const STATUSES: Booking["status"][] = ["New", "Confirmed", "Completed", "Cancelled"];
const STATUS_COLOR: Record<Booking["status"], string> = {
  New: "bg-blue-500/10 text-blue-600",
  Confirmed: "bg-primary/10 text-primary",
  Completed: "bg-emerald-500/10 text-emerald-600",
  Cancelled: "bg-destructive/10 text-destructive",
};
const PLACEHOLDERS = "{name} {booking_number} {service} {date} {time}";

const formatDate = (d: string) => new Date(`${d}T00:00`).toLocaleDateString("en-IN", { dateStyle: "medium" });
const formatTime = (t: string) => new Date(`1970-01-01T${t}`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

// Customer number as WhatsApp needs it: digits only, with India code if they typed 10 digits.
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

function fillMessage(template: string, b: Booking): string {
  const values: Record<string, string> = {
    name: b.name,
    booking_number: String(b.booking_number),
    service: b.service,
    date: formatDate(b.preferred_date),
    time: formatTime(b.preferred_time),
  };
  return template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

function MessageEditor({ password, template, onChange }: { password: string; template: string; onChange: (t: string) => void }) {
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { ok, data } = await adminApi.update(password, "site_settings", { booking_confirm_message: template });
    setSaving(false);
    if (ok) toast.success("Confirmation message saved");
    else toast.error(data.error ?? "Could not save message");
  };
  return (
    <AdminCard className="space-y-2">
      <label className={LABEL}>WhatsApp confirmation message</label>
      <textarea className={`${FIELD} h-40 py-2 text-sm`} value={template} onChange={(e) => onChange(e.target.value)} />
      <p className="text-xs text-muted-foreground">These words are filled in automatically: {PLACEHOLDERS}</p>
      <AdminButton onClick={() => void save()} disabled={saving}>
        {saving ? <Spinner /> : <Save className="size-4" />} Save Message
      </AdminButton>
    </AdminCard>
  );
}

export default function BookingsTab({ password }: { password: string }) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [template, setTemplate] = useState("");
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);

  useEffect(() => {
    void adminApi.list<Booking>(password, "bookings").then(({ ok, data }) => {
      if (ok) setBookings(data.rows ?? []);
      else toast.error(data.error ?? "Could not load bookings");
    });
    void adminApi.list(password, "site_settings").then(({ ok, data }) => {
      const row = (data as unknown as { row?: { booking_confirm_message?: string } }).row;
      if (ok) setTemplate(row?.booking_confirm_message ?? "");
    });
  }, [password]);

  const replace = (b: Partial<Booking> & { id: string }) =>
    setBookings((prev) => prev?.map((x) => (x.id === b.id ? { ...x, ...b } : x)) ?? null);

  const updateStatus = async (b: Booking, status: Booking["status"]) => {
    const { ok, data } = await adminApi.update<Booking>(password, "bookings", { id: b.id, status });
    if (!ok) {
      toast.error(data.error ?? "Could not update booking");
      return;
    }
    replace({ id: b.id, status });
    toast.success(status === "Confirmed" ? "Booking accepted. Now send WhatsApp or email." : "Booking updated");
  };

  const sendWhatsapp = (b: Booking) => {
    const url = `https://wa.me/${waNumber(b.phone)}?text=${encodeURIComponent(fillMessage(template, b))}`;
    window.open(url, "_blank", "noopener");
  };

  const sendEmail = async (b: Booking) => {
    setEmailingId(b.id);
    const { ok, data } = await adminApi.emailBooking(password, b.id);
    setEmailingId(null);
    if (ok) toast.success(`Email sent to ${b.email}`);
    else toast.error(data.error ?? "Could not send email");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl">Bookings</h2>
        {!creating && (
          <AdminButton onClick={() => setCreating(true)}>
            <CalendarPlus className="size-4" /> New Booking
          </AdminButton>
        )}
      </div>
      {creating && (
        <NewBookingForm
          password={password}
          onClose={() => setCreating(false)}
          onCreated={(b) => {
            setBookings((prev) => [b as Booking, ...(prev ?? [])]);
            setCreating(false);
          }}
        />
      )}
      <MessageEditor password={password} template={template} onChange={setTemplate} />

      {bookings === null ? (
        <EmptyRow>Loading bookings...</EmptyRow>
      ) : bookings.length === 0 ? (
        <EmptyRow>No appointment requests yet.</EmptyRow>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <AdminCard key={b.id} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <CalendarClock className="mt-1 size-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">#{b.booking_number} · {b.name} · {b.phone}</p>
                    {b.email && <p className="text-sm text-muted-foreground">{b.email}</p>}
                    <p className="text-sm text-muted-foreground">
                      {b.service} · {formatDate(b.preferred_date)} at {formatTime(b.preferred_time)}
                    </p>
                    <p className="flex items-start gap-1 pt-1 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" />
                      {b.location_type === "home" ? `Home visit - ${b.location_address ?? "-"}` : "At the studio"}
                    </p>
                    {b.message && <p className="pt-1 text-sm text-muted-foreground">{b.message}</p>}
                    <p className="pt-1 text-xs text-muted-foreground">
                      {b.created_by_admin ? "Added by admin" : "Requested"} {new Date(b.created_at).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
                <select
                  value={b.status}
                  onChange={(e) => void updateStatus(b, e.target.value as Booking["status"])}
                  className={`${FIELD} w-auto ${STATUS_COLOR[b.status]}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {b.status === "New" && (
                  <>
                    <AdminButton onClick={() => void updateStatus(b, "Confirmed")}>
                      <Check className="size-4" /> Accept
                    </AdminButton>
                    <AdminButton variant="danger" onClick={() => void updateStatus(b, "Cancelled")}>
                      <X className="size-4" /> Decline
                    </AdminButton>
                  </>
                )}
                {b.status === "Confirmed" && (
                  <button
                    onClick={() => sendWhatsapp(b)}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-medium text-white hover:opacity-90"
                  >
                    <WhatsappLogo size={18} weight="fill" /> Share on WhatsApp
                  </button>
                )}
                {(b.status === "Confirmed" || b.status === "Cancelled") && b.email && (
                  <AdminButton variant="secondary" onClick={() => void sendEmail(b)} disabled={emailingId === b.id}>
                    {emailingId === b.id ? <Spinner /> : <Mail className="size-4" />} Send Email
                  </AdminButton>
                )}
                {(b.status === "New" || b.status === "Confirmed") && (
                  <AdminButton variant="secondary" onClick={() => setRescheduleId(rescheduleId === b.id ? null : b.id)}>
                    <Clock className="size-4" /> Reschedule
                  </AdminButton>
                )}
              </div>
              {rescheduleId === b.id && (
                <RescheduleForm
                  password={password}
                  booking={b}
                  onSaved={(n) => {
                    replace(n);
                    setRescheduleId(null);
                  }}
                />
              )}
            </AdminCard>
          ))}
        </div>
      )}
    </div>
  );
}
