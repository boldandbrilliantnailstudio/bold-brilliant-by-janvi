// Single endpoint every customer review goes through - product reviews (from the product page),
// order reviews and booking reviews (from My Orders / My Bookings). Verifies the customer
// actually has a matching Delivered order or Completed booking before writing anything, then
// publishes instantly. 1-2 star reviews also alert the studio owner on Telegram.
// Env vars: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL (falls back to VITE_SUPABASE_URL),
// TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (optional, for low-rating alerts).
import { dbFetch, getEnv, getUserId, type ApiRequest, type ApiResponse } from "./_lib/db.js";
import { notifyLowRatingReview } from "./_lib/telegram.js";

type Body = {
  rating?: unknown;
  body?: unknown;
  customerName?: unknown;
  photos?: unknown; // data URLs, up to 3
  productId?: unknown;
  orderId?: unknown;
  bookingId?: unknown;
};

const MIME_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_PHOTOS = 3;

async function uploadPhoto(env: { supabaseUrl: string; serviceKey: string }, userId: string, dataUrl: string): Promise<string | null> {
  const match = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(dataUrl);
  const mime = match?.[1].toLowerCase();
  const ext = mime ? MIME_EXT[mime] : undefined;
  if (!match || !mime || !ext) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_PHOTO_BYTES) return null;
  const path = `review-photos/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const r = await fetch(`${env.supabaseUrl}/storage/v1/object/site-media/${path}`, {
    method: "POST",
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`, "Content-Type": mime },
    body: buffer,
  });
  return r.ok ? `${env.supabaseUrl}/storage/v1/object/public/site-media/${path}` : null;
}

type Env = { supabaseUrl: string; serviceKey: string };

// Confirms the customer actually has a Delivered order containing this product, and that they
// haven't already reviewed it. Returns a friendly error string, or null if the review may proceed.
async function checkProductEligible(env: Env, userId: string, productId: string): Promise<string | null> {
  const existingRes = await dbFetch(env.supabaseUrl, env.serviceKey, `reviews?product_id=eq.${productId}&user_id=eq.${userId}&select=id`);
  if (((await existingRes.json()) as unknown[]).length > 0) return "You've already reviewed this product.";

  const productRes = await dbFetch(env.supabaseUrl, env.serviceKey, `products?id=eq.${productId}&select=name`);
  const product = ((await productRes.json()) as { name: string }[])[0];
  if (!product) return "This product no longer exists.";

  const ordersRes = await dbFetch(
    env.supabaseUrl, env.serviceKey,
    `orders?user_id=eq.${userId}&status=eq.Delivered&select=items`,
  );
  const orders = (await ordersRes.json()) as { items: { name: string }[] | null }[];
  const bought = orders.some((o) => (o.items ?? []).some((i) => i.name === product.name));
  return bought ? null : "You can review a product only after it's delivered to you.";
}

async function checkOrderEligible(env: Env, userId: string, orderId: string): Promise<string | null> {
  const existingRes = await dbFetch(env.supabaseUrl, env.serviceKey, `reviews?order_id=eq.${orderId}&select=id`);
  if (((await existingRes.json()) as unknown[]).length > 0) return "You've already reviewed this order.";

  const orderRes = await dbFetch(env.supabaseUrl, env.serviceKey, `orders?id=eq.${orderId}&user_id=eq.${userId}&select=status`);
  const order = ((await orderRes.json()) as { status: string }[])[0];
  if (!order) return "This order was not found.";
  return order.status === "Delivered" ? null : "You can review an order only after it's delivered.";
}

async function checkBookingEligible(env: Env, userId: string, bookingId: string): Promise<string | null> {
  const existingRes = await dbFetch(env.supabaseUrl, env.serviceKey, `reviews?booking_id=eq.${bookingId}&select=id`);
  if (((await existingRes.json()) as unknown[]).length > 0) return "You've already reviewed this appointment.";

  const bookingRes = await dbFetch(env.supabaseUrl, env.serviceKey, `bookings?id=eq.${bookingId}&user_id=eq.${userId}&select=status`);
  const booking = ((await bookingRes.json()) as { status: string }[])[0];
  if (!booking) return "This appointment was not found.";
  return booking.status === "Completed" ? null : "You can review an appointment only after it's completed.";
}

// Looks up the booking's service name so it can be stored on the review (shown alongside
// the studio review on the homepage Testimonials, e.g. "Gel Extensions").
async function getBookingServiceName(env: Env, bookingId: string): Promise<string | null> {
  const r = await dbFetch(env.supabaseUrl, env.serviceKey, `bookings?id=eq.${bookingId}&select=service`);
  return ((await r.json()) as { service: string }[])[0]?.service ?? null;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const env = getEnv();
  if (!env) {
    res.status(500).json({ error: "Reviews are not available right now." });
    return;
  }

  const userId = await getUserId(req, env.supabaseUrl, env.serviceKey);
  if (!userId) {
    res.status(401).json({ error: "Please sign in to write a review." });
    return;
  }

  const b = (req.body ?? {}) as Body;
  const rating = typeof b.rating === "number" ? Math.round(b.rating) : NaN;
  const body = typeof b.body === "string" ? b.body.trim() : "";
  const customerName = typeof b.customerName === "string" ? b.customerName.trim().slice(0, 80) : "Customer";
  const productId = typeof b.productId === "string" ? b.productId : null;
  const orderId = typeof b.orderId === "string" ? b.orderId : null;
  const bookingId = typeof b.bookingId === "string" ? b.bookingId : null;
  const photos = Array.isArray(b.photos) ? b.photos.filter((p): p is string => typeof p === "string").slice(0, MAX_PHOTOS) : [];

  if (rating < 1 || rating > 5) {
    res.status(400).json({ error: "Please choose a rating from 1 to 5 stars." });
    return;
  }
  if (body.length < 5 || body.length > 1000) {
    res.status(400).json({ error: "Please write a few words about your experience." });
    return;
  }
  const targets = [productId, orderId, bookingId].filter(Boolean);
  if (targets.length !== 1) {
    res.status(400).json({ error: "Please pick exactly one thing to review." });
    return;
  }

  try {
    const eligibilityError = productId
      ? await checkProductEligible(env, userId, productId)
      : orderId
        ? await checkOrderEligible(env, userId, orderId)
        : await checkBookingEligible(env, userId, bookingId!);
    if (eligibilityError) {
      res.status(400).json({ error: eligibilityError });
      return;
    }

    const photoUrls: string[] = [];
    for (const dataUrl of photos) {
      const url = await uploadPhoto(env, userId, dataUrl);
      if (url) photoUrls.push(url);
    }

    const serviceName = bookingId ? await getBookingServiceName(env, bookingId) : null;

    const insertRes = await dbFetch(env.supabaseUrl, env.serviceKey, "reviews", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        customer_name: customerName,
        rating,
        body,
        photo_urls: photoUrls,
        photo_url: photoUrls[0] ?? null,
        product_id: productId,
        order_id: orderId,
        booking_id: bookingId,
        service_name: serviceName,
        user_id: userId,
        is_published: true,
      }),
    });
    if (!insertRes.ok) {
      const data = await insertRes.json().catch(() => null);
      const msg = (data as { message?: string } | null)?.message ?? "";
      res.status(400).json({ error: msg.includes("duplicate") ? "You've already reviewed this." : "Could not submit your review. Please try again." });
      return;
    }

    if (rating <= 2) {
      let whatsapp: string | null = null;
      let targetLabel = "studio visit";
      if (productId) {
        const productRes = await dbFetch(env.supabaseUrl, env.serviceKey, `products?id=eq.${productId}&select=name`);
        targetLabel = `product: ${((await productRes.json()) as { name: string }[])[0]?.name ?? "a product"}`;
      } else if (orderId) {
        const orderRes = await dbFetch(env.supabaseUrl, env.serviceKey, `orders?id=eq.${orderId}&select=product_name,phone`);
        const order = ((await orderRes.json()) as { product_name: string; phone: string }[])[0];
        targetLabel = `order: ${order?.product_name ?? "an order"}`;
        whatsapp = order?.phone ?? null;
      } else if (bookingId) {
        const bookingRes = await dbFetch(env.supabaseUrl, env.serviceKey, `bookings?id=eq.${bookingId}&select=service,phone`);
        const booking = ((await bookingRes.json()) as { service: string; phone: string }[])[0];
        targetLabel = `appointment: ${booking?.service ?? "a booking"}`;
        whatsapp = booking?.phone ?? null;
      }
      await notifyLowRatingReview({ customerName, rating, body, targetLabel, whatsapp });
    }

    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "Could not submit your review. Please try again." });
  }
}
