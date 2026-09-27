// Public endpoint for the website booking form.
//   GET  /api/booking?date=YYYY-MM-DD -> { slots: ["10:00", ...] } free slots for that day
//   POST /api/booking                 -> creates the booking (customer must be signed in)
// The service must be an active service from Admin > Services, and the time must be a free
// slot from Admin > Booking Settings. Env vars: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL,
// RESEND_API_KEY (optional).
import { dbFetch, getEnv, getUserId, q, type ApiRequest, type ApiResponse } from "./_lib/db.js";
import { bookingVars, sendTemplateEmail } from "./_lib/email.js";
import { freeSlots, loadSettings } from "./_lib/slots.js";

type Body = {
  name?: string;
  phone?: string;
  email?: string;
  date?: string;
  time?: string;
  service?: string;
  message?: string;
  locationType?: string;
  locationAddress?: string;
};

const nowIst = () => new Date(Date.now() + 330 * 60 * 1000);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const env = getEnv();
  if (!env) {
    res.status(500).json({ error: "Booking is not available right now." });
    return;
  }

  if (req.method === "GET") {
    const date = q(req, "date") ?? "";
    const settings = await loadSettings(env);
    if (!DATE_RE.test(date) || !settings) {
      res.status(200).json({ slots: [] });
      return;
    }
    res.status(200).json({ slots: await freeSlots(env, settings, date, nowIst()) });
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const userId = await getUserId(req, env.supabaseUrl, env.serviceKey);
  if (!userId) {
    res.status(401).json({ error: "Please sign in to book an appointment." });
    return;
  }

  const b = (req.body ?? {}) as Body;
  const name = b.name?.trim() ?? "";
  const phone = b.phone?.trim() ?? "";
  const email = b.email?.trim().toLowerCase() || null;
  const message = (b.message ?? "").trim().slice(0, 500);
  const locationType = b.locationType === "home" ? "home" : "studio";
  const locationAddress = (b.locationAddress ?? "").trim().slice(0, 300);
  if (name.length < 2 || name.length > 80 || !/^\+?[0-9\s-]{10,15}$/.test(phone)) {
    res.status(400).json({ error: "Please check your name and WhatsApp number." });
    return;
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ error: "Please enter a valid email." });
    return;
  }
  if (!b.date || !DATE_RE.test(b.date) || !b.time || !/^\d{2}:\d{2}/.test(b.time) || !b.service) {
    res.status(400).json({ error: "Please choose a valid date, time and service." });
    return;
  }
  if (locationType === "home" && locationAddress.length < 5) {
    res.status(400).json({ error: "Please enter your address for a home visit." });
    return;
  }

  try {
    const svcRes = await dbFetch(
      env.supabaseUrl,
      env.serviceKey,
      `services?name=eq.${encodeURIComponent(b.service)}&is_active=eq.true&select=allow_home_visit`,
    );
    const svc = ((await svcRes.json()) as { allow_home_visit: boolean }[])[0];
    if (!svc) {
      res.status(400).json({ error: "This service is not available. Please pick another." });
      return;
    }
    if (locationType === "home" && !svc.allow_home_visit) {
      res.status(400).json({ error: "Home visit is not available for this service." });
      return;
    }
    const settings = await loadSettings(env);
    const time = b.time.slice(0, 5);
    if (!settings || !(await freeSlots(env, settings, b.date, nowIst())).includes(time)) {
      res.status(409).json({ error: "This slot is no longer free. Please pick another time." });
      return;
    }

    const r = await dbFetch(env.supabaseUrl, env.serviceKey, "rpc/create_booking", {
      method: "POST",
      body: JSON.stringify({
        p_name: name,
        p_phone: phone,
        p_date: b.date,
        p_time: time,
        p_service: b.service,
        p_message: message,
        p_email: email,
        p_location_type: locationType,
        p_location_address: locationType === "home" ? locationAddress : null,
      }),
    });
    const bookingNumber = (await r.json()) as unknown;
    if (!r.ok || typeof bookingNumber !== "number") {
      res.status(400).json({ error: "Could not send your booking request. Please try again." });
      return;
    }
    // Link the booking to the signed-in customer (used later for reviews and profiles).
    await dbFetch(env.supabaseUrl, env.serviceKey, `bookings?booking_number=eq.${bookingNumber}`, {
      method: "PATCH",
      body: JSON.stringify({ user_id: userId }),
    });
    await sendTemplateEmail(env, "admin_new_booking", null, bookingVars({
      booking_number: bookingNumber, name, phone, service: b.service, preferred_date: b.date, preferred_time: time, message,
    }));
    res.status(200).json({ bookingNumber });
  } catch {
    res.status(500).json({ error: "Could not send your booking request. Please try again." });
  }
}
