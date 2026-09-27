// Public endpoint for the website booking form. The customer must be signed in (same login as
// the shop). Saves the request (via the create_booking database function, server-only), links
// it to the customer's account and emails the studio owner.
// Env vars (Vercel): SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, RESEND_API_KEY (optional).
import { dbFetch, getEnv, getUserId, type ApiRequest, type ApiResponse } from "./_lib/db.js";
import { bookingVars, sendTemplateEmail } from "./_lib/email.js";

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

function todayInIndia(): string {
  return new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const env = getEnv();
  if (!env) {
    res.status(500).json({ error: "Booking is not available right now." });
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
  if (!b.date || !/^\d{4}-\d{2}-\d{2}$/.test(b.date) || b.date < todayInIndia() || !b.time || !/^\d{2}:\d{2}/.test(b.time) || !b.service || b.service.length > 60) {
    res.status(400).json({ error: "Please choose a valid date, time and service." });
    return;
  }
  if (locationType === "home" && locationAddress.length < 5) {
    res.status(400).json({ error: "Please enter your address for a home visit." });
    return;
  }

  try {
    const r = await dbFetch(env.supabaseUrl, env.serviceKey, "rpc/create_booking", {
      method: "POST",
      body: JSON.stringify({
        p_name: name,
        p_phone: phone,
        p_date: b.date,
        p_time: b.time,
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
      booking_number: bookingNumber, name, phone, service: b.service, preferred_date: b.date, preferred_time: b.time, message,
    }));
    res.status(200).json({ bookingNumber });
  } catch {
    res.status(500).json({ error: "Could not send your booking request. Please try again." });
  }
}
