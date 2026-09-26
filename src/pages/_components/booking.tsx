import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarCheck, CheckCircle2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import Reveal, { SectionHeading } from "@/components/reveal.tsx";
import { toast } from "sonner";
import { useSiteSettings } from "@/hooks/use-site-settings.tsx";

const SERVICES = ["Classic Nail Art", "French Nails", "3D Nail Art", "Bridal Nails", "Luxury Nail Art", "Custom Design"] as const;
const LOCATION_TYPES = ["studio", "home"] as const;

const schema = z
  .object({
    name: z.string().trim().min(2, "Please enter your name"),
    phone: z.string().trim().regex(/^\+?[0-9\s-]{10,15}$/, "Enter a valid WhatsApp number"),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]).optional(),
    date: z.string().min(1, "Choose a date"),
    time: z.string().min(1, "Choose a time"),
    service: z.enum(SERVICES, { message: "Select a service" }),
    message: z.string().max(500).optional(),
    locationType: z.enum(LOCATION_TYPES, { message: "Select a location" }),
    locationAddress: z.string().trim().max(300).optional(),
  })
  .refine((d) => d.locationType !== "home" || (d.locationAddress?.trim().length ?? 0) >= 5, {
    message: "Please enter your address for a home visit",
    path: ["locationAddress"],
  });
type FormValues = z.infer<typeof schema>;
type Confirmed = FormValues & { bookingNumber: number };

const FIELD = "h-12 rounded-xl bg-background/70";

const formatDate = (d: string) => new Date(`${d}T00:00`).toLocaleDateString("en-IN", { dateStyle: "medium" });
const formatTime = (t: string) => new Date(`1970-01-01T${t}`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

function BookingSummary({ booking, studioAddress, onDone }: { booking: Confirmed; studioAddress: string; onDone: () => void }) {
  const rows = [
    { label: "Booking No.", value: `#${booking.bookingNumber}` },
    { label: "Name", value: booking.name },
    { label: "WhatsApp", value: booking.phone },
    { label: "Email", value: booking.email?.trim() || "-" },
    { label: "Service", value: booking.service },
    { label: "Date", value: formatDate(booking.date) },
    { label: "Time", value: formatTime(booking.time) },
    { label: "Location", value: booking.locationType === "home" ? `Home visit - ${booking.locationAddress?.trim()}` : `At our studio - ${studioAddress}` },
    { label: "Message", value: booking.message?.trim() || "-" },
  ];
  return (
    <div className="rounded-[2rem] border bg-card/60 p-6 shadow-2xl shadow-primary/10 backdrop-blur-sm md:p-10">
      <div className="flex flex-col items-center gap-2 pb-6 text-center">
        <CheckCircle2 className="size-12 text-primary" />
        <h3 className="font-serif text-2xl">Booking Details</h3>
        <p className="text-sm text-muted-foreground">We'll confirm your appointment on WhatsApp soon.</p>
      </div>
      <dl className="divide-y rounded-2xl border bg-background/60">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="text-right font-medium break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
      <button onClick={onDone} className="mt-6 h-12 w-full rounded-full bg-primary font-medium text-primary-foreground transition-transform hover:scale-[1.02]">
        Done
      </button>
    </div>
  );
}

export default function Booking() {
  const today = new Date().toISOString().slice(0, 10);
  const settings = useSiteSettings();
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { locationType: "studio" } });
  const locationType = watch("locationType");

  // Booking goes to /api/booking, which saves it to Admin > Bookings and emails the owner.
  const onSubmit = async (d: FormValues) => {
    const res = await fetch("/api/booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...d,
        email: d.email?.trim() || undefined,
        message: d.message ?? "",
        locationAddress: d.locationType === "home" ? d.locationAddress?.trim() : undefined,
      }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { bookingNumber?: number; error?: string } | undefined;
    if (!res?.ok || typeof data?.bookingNumber !== "number") {
      toast.error(data?.error ?? "Could not send your booking request. Please try again.");
      return;
    }
    setConfirmed({ ...d, bookingNumber: data.bookingNumber });
    reset();
  };

  const err = (k: keyof FormValues) => errors[k] && <p className="pt-1 text-xs text-destructive">{errors[k]?.message}</p>;

  return (
    <section className="relative overflow-hidden px-5 py-16 md:py-24">
      <div className="absolute -right-32 top-20 h-80 w-80 rounded-full bg-primary/20 blur-[70px]" />
      <div className="absolute -left-32 bottom-10 h-80 w-80 rounded-full bg-accent/30 blur-[70px]" />
      <div className="relative mx-auto max-w-3xl">
        <SectionHeading eyebrow="Appointments" title="Book Your Nail Appointment" sub="Fill in your details and we'll confirm your slot." />
        <Reveal>
          {confirmed ? (
            <BookingSummary booking={confirmed} studioAddress={settings.address} onDone={() => setConfirmed(null)} />
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-5 rounded-[2rem] border bg-card/60 p-6 shadow-2xl shadow-primary/10 backdrop-blur-sm sm:grid-cols-2 md:p-10">
              <div>
                <Label htmlFor="name" className="pb-2">Full Name</Label>
                <Input id="name" placeholder="Priya Shah" className={FIELD} {...register("name")} />
                {err("name")}
              </div>
              <div>
                <Label htmlFor="phone" className="pb-2">WhatsApp Number</Label>
                <Input id="phone" type="tel" inputMode="tel" placeholder="+91 98765 43210" className={FIELD} {...register("phone")} />
                {err("phone")}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="email" className="pb-2">Email (optional)</Label>
                <Input id="email" type="email" placeholder="priya@gmail.com" className={FIELD} {...register("email")} />
                {err("email")}
              </div>
              <div>
                <Label htmlFor="date" className="pb-2">Preferred Date</Label>
                <Input id="date" type="date" min={today} className={FIELD} {...register("date")} />
                {err("date")}
              </div>
              <div>
                <Label htmlFor="time" className="pb-2">Preferred Time</Label>
                <Input id="time" type="time" className={FIELD} {...register("time")} />
                {err("time")}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="service" className="pb-2">Nail Art Service</Label>
                <select id="service" defaultValue="" className={`${FIELD} w-full cursor-pointer border border-input px-3 text-sm`} {...register("service")}>
                  <option value="" disabled>Select a service</option>
                  {SERVICES.map((s) => <option key={s}>{s}</option>)}
                </select>
                {err("service")}
              </div>
              <div className="sm:col-span-2">
                <Label className="pb-2">Where should we do your nails?</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors ${locationType === "studio" ? "border-primary bg-primary/5" : "border-input bg-background/70"}`}
                  >
                    <input type="radio" value="studio" className="mt-1 accent-primary" {...register("locationType")} />
                    <span>
                      <span className="flex items-center gap-1.5 font-medium"><MapPin className="size-4 text-primary" /> At Our Studio</span>
                      <span className="block pt-1 text-xs text-muted-foreground">{settings.address}</span>
                    </span>
                  </label>
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors ${locationType === "home" ? "border-primary bg-primary/5" : "border-input bg-background/70"}`}
                  >
                    <input type="radio" value="home" className="mt-1 accent-primary" {...register("locationType")} />
                    <span>
                      <span className="flex items-center gap-1.5 font-medium"><MapPin className="size-4 text-primary" /> At My Own Location</span>
                      <span className="block pt-1 text-xs text-muted-foreground">We'll come to your home or venue</span>
                    </span>
                  </label>
                </div>
                {err("locationType")}
              </div>
              {locationType === "home" && (
                <div className="sm:col-span-2">
                  <Label htmlFor="locationAddress" className="pb-2">Your Address</Label>
                  <Textarea id="locationAddress" rows={2} placeholder="House/Flat no., street, area, landmark, city" className="rounded-xl bg-background/70" {...register("locationAddress")} />
                  {err("locationAddress")}
                </div>
              )}
              <div className="sm:col-span-2">
                <Label htmlFor="message" className="pb-2">Message (optional)</Label>
                <Textarea id="message" rows={3} placeholder="Any design ideas or reference?" className="rounded-xl bg-background/70" {...register("message")} />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-primary font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60 sm:col-span-2"
              >
                <CalendarCheck className="size-5" /> {isSubmitting ? "Sending..." : "Book Appointment"}
              </button>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
