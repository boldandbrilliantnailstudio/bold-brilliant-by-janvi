// Public endpoint for the website booking form.
//   GET  /api/booking?date=YYYY-MM-DD -> { slots: ["10:00", ...] } free slots for that day
//   POST /api/booking                 -> creates the booking (customer must be signed in)
// The service must be an active service from Admin > Services, and the time must be a free
// slot from Admin > Booking Settings. A coupon code (general or a personal one issued to this
// customer, scope "booking" or "both") can be attached - the discount is shown as a note for
// the studio to apply manually, since bookings don't take online payment. The coupon is only
// actually marked "used" (a coupon_redemptions row inserted) once the studio marks this booking
// Completed (see api/admin.ts) - not here at creation time - so a Cancelled booking never burns
// the customer's one-time coupon. Env vars: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL,
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
  couponCode?: string;
};

type CouponRow = {
  id: string;
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  max_discount: number | null;
  is_active: boolean;
  user_id: string | null;
  scope: "shop" | "booking" | "both";
  starts_at: string | null;
  expires_at: string | null;
};

const nowIst = () => new Date(Date.now() + 330 * 60 * 1000);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validates a coupon for use on a booking: must exist, be active, in scope, in date range, and
// - if personal - belong to this customer. Bookings have no price to discount from server-side
// (studio sets prices per-service), so this just returns a human note for the studio to see.
// Does NOT insert a coupon_redemptions row - that only happens once the booking is marked
// Completed (api/admin.ts), so a coupon isn't burned by a booking that's later cancelled.
async function resolveBookingCoupon(
  env: { supabaseUrl: string; serviceKey: string },
  code: string,
  userId: string,
): Promise<{ code: string; note: string } | { error: string }> {
  const r = await dbFetch(env.supabaseUrl, env.serviceKey, `coupons?code=eq.${encodeURIComponent(code)}&select=*`);
  const coupon = ((await r.json()) as CouponRow[])[0];
  if (!coupon || !coupon.is_active) return { error: "That coupon code isn't valid." };
  if (coupon.user_id && coupon.user_id !== userId) return { error: "That coupon code isn't valid." };
  if (coupon.scope === "shop") return { error: "That coupon can only be used in the shop, not for bookings." };
  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) return { error: "That coupon isn't active yet." };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) return { error: "That coupon has expired." };

  if (coupon.user_id) {
    const usedRes = await dbFetch(
      env.supabaseUrl, env.serviceKey,
      `coupon_redemptions?coupon_id=eq.${coupon.id}&user_id=eq.${userId}&select=id`,
      { headers: { Prefer: "count=exact", Range: "0-0" } },
    );
    const used = parseInt(usedRes.headers.get("content-range")?.split("/")[1] ?? "0", 10) || 0;
    if (used >= 1) return { error: "You've already used this coupon." };
  }

  const note = coupon.discount_type === "percent" ? `${coupon.discount_value}% off` : `₹${coupon.discount_value} off`;
  return { code: coupon.code, note: `Coupon ${coupon.code}: ${note}${coupon.max_discount ? ` (max ₹${coupon.max_discount})` : ""} - apply at the studio.` };
}

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

    let couponCode: string | null = null;
    let discountNote: string | null = null;
    let couponError: string | null = null;
    if (typeof b.couponCode === "string" && b.couponCode.trim()) {
      const result = await resolveBookingCoupon(env, b.couponCode.trim().toUpperCase(), userId);
      if ("error" in result) couponError = result.error;
      else {
        couponCode = result.code;
        discountNote = result.note;
      }
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
    // Link the booking to the signed-in customer (used later for reviews and profiles), and
    // attach the coupon note if one was applied. The coupon itself is only redeemed (counted as
    // used) once the studio marks this booking Completed - see redeemBookingCouponIfCompleted
    // in api/admin.ts - so a Cancelled booking never burns the customer's one-time coupon.
    await dbFetch(env.supabaseUrl, env.serviceKey, `bookings?booking_number=eq.${bookingNumber}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: userId, coupon_code: couponCode, discount_note: discountNote }),
    });

    await sendTemplateEmail(env, "admin_new_booking", null, bookingVars({
      booking_number: bookingNumber, name, phone, service: b.service, preferred_date: b.date, preferred_time: time, message,
    }));
    res.status(200).json({ bookingNumber, couponApplied: couponCode, couponError });
  } catch {
    res.status(500).json({ error: "Could not send your booking request. Please try again." });
  }
}
