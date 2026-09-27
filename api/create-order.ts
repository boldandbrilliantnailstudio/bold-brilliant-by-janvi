// Creates a Razorpay order on the server. The amount is calculated here from the live
// `products` table in the database (never taken from the browser), so admins can change prices
// from the admin panel and customers are always charged exactly that price.
// Env vars (Vercel): RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, SUPABASE_SERVICE_ROLE_KEY,
// and SUPABASE_URL (falls back to VITE_SUPABASE_URL).
import { dbFetch, getEnv, getUserId, type ApiRequest, type ApiResponse } from "./_lib/db.js";

const MAX_QTY = 20;

type Item = { name: string; qty: number };
type ProductRow = { name: string; price: number; sold_out: boolean; is_active: boolean; stock: number | null };
type CouponRow = {
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
  scope: "shop" | "booking" | "both";
};

function parseItems(value: unknown): Item[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) return null;
  const items: Item[] = [];
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) return null;
    const { name, qty } = raw as Record<string, unknown>;
    if (typeof name !== "string" || !name) return null;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) return null;
    items.push({ name, qty });
  }
  return items;
}

async function findCoupon(
  supabaseUrl: string,
  serviceKey: string,
  code: string,
  userId: string,
  subtotal: number,
): Promise<{ coupon: CouponRow | null; error: string | null }> {
  const r = await dbFetch(supabaseUrl, serviceKey, `coupons?code=eq.${encodeURIComponent(code)}&select=*`);
  const rows = (await r.json()) as CouponRow[];
  const coupon = rows[0];
  if (!coupon || !coupon.is_active) return { coupon: null, error: "That coupon code isn't valid." };

  // Personal coupons (user_id set) only work for the customer they were issued to.
  if (coupon.user_id && coupon.user_id !== userId) return { coupon: null, error: "That coupon code isn't valid." };
  if (coupon.scope === "booking") return { coupon: null, error: "That coupon can only be used for bookings, not shop orders." };

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) return { coupon: null, error: "That coupon isn't active yet." };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) return { coupon: null, error: "That coupon has expired." };
  if (subtotal < coupon.min_order_amount) return { coupon: null, error: `Add ₹${coupon.min_order_amount - subtotal} more to use this coupon.` };
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) return { coupon: null, error: "That coupon has reached its usage limit." };

  // Personal coupons are always one-time-per-customer, regardless of per_user_limit.
  const effectiveLimit = coupon.user_id ? 1 : coupon.per_user_limit;
  if (effectiveLimit !== null) {
    const usedRes = await dbFetch(
      supabaseUrl,
      serviceKey,
      `coupon_redemptions?coupon_id=eq.${coupon.id}&user_id=eq.${userId}&select=id`,
      { headers: { Prefer: "count=exact", Range: "0-0" } },
    );
    const usedByUser = parseInt(usedRes.headers.get("content-range")?.split("/")[1] ?? "0", 10) || 0;
    if (usedByUser >= effectiveLimit) return { coupon: null, error: "You've already used this coupon the maximum number of times." };
  }

  return { coupon, error: null };
}

function computeDiscount(coupon: CouponRow, subtotal: number): number {
  const raw = coupon.discount_type === "percent" ? subtotal * (coupon.discount_value / 100) : coupon.discount_value;
  const capped = coupon.max_discount ? Math.min(raw, coupon.max_discount) : raw;
  return Math.min(Math.round(capped), subtotal);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const env = getEnv();
  if (!keyId || !keySecret || !env) {
    res.status(500).json({ error: "Online payment is not set up yet. Please contact the studio." });
    return;
  }
  const { supabaseUrl, serviceKey } = env;

  const items = parseItems((req.body as { items?: unknown } | undefined)?.items);
  if (!items) {
    res.status(400).json({ error: "Some items in your basket are no longer available. Please remove them and try again." });
    return;
  }

  try {
    const userId = await getUserId(req, supabaseUrl, serviceKey);
    if (!userId) {
      res.status(401).json({ error: "Please sign in again to continue." });
      return;
    }

    // Price every item from the live database - never trust a price from the browser.
    const namesFilter = items.map((i) => `"${i.name.replace(/"/g, '\\"')}"`).join(",");
    const productsRes = await dbFetch(supabaseUrl, serviceKey, `products?name=in.(${namesFilter})&select=name,price,sold_out,is_active,stock`);
    const products = (await productsRes.json()) as ProductRow[];
    const byName = new Map(products.map((p) => [p.name, p]));

    const priced: { name: string; qty: number; price: number }[] = [];
    for (const item of items) {
      const product = byName.get(item.name);
      if (!product || !product.is_active || product.sold_out) {
        res.status(400).json({ error: `${item.name} is no longer available. Please remove it from your basket.` });
        return;
      }
      if (product.stock !== null && product.stock < item.qty) {
        res.status(400).json({ error: `Only ${product.stock} left of ${item.name}. Please reduce the quantity.` });
        return;
      }
      priced.push({ name: item.name, qty: item.qty, price: product.price });
    }

    const subtotal = priced.reduce((sum, i) => sum + i.price * i.qty, 0);

    const rawCode = (req.body as { couponCode?: unknown } | undefined)?.couponCode;
    let discount = 0;
    let couponApplied: string | null = null;
    let couponError: string | null = null;
    if (typeof rawCode === "string" && rawCode.trim()) {
      const normalized = rawCode.trim().toUpperCase();
      const { coupon, error } = await findCoupon(supabaseUrl, serviceKey, normalized, userId, subtotal);
      if (coupon) {
        discount = computeDiscount(coupon, subtotal);
        couponApplied = coupon.code;
      } else {
        couponError = error;
      }
    }

    const total = Math.max(subtotal - discount, 0);
    const summary = priced.map((i) => (i.qty > 1 ? `${i.name} x${i.qty}` : i.name)).join(", ");

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: total * 100, // Razorpay expects paise
        currency: "INR",
        // Read back in verify-payment to save the order - never trusted from the browser.
        notes: {
          user_id: userId,
          items: JSON.stringify(priced).slice(0, 480),
          summary: summary.slice(0, 220),
          coupon: couponApplied ?? "",
          subtotal: String(subtotal),
          discount: String(discount),
        },
      }),
    });
    const data = (await response.json()) as { id?: string; amount?: number; currency?: string; error?: { description?: string } };

    if (!response.ok || !data.id) {
      res.status(502).json({ error: data.error?.description ?? "Could not start payment. Please try again." });
      return;
    }

    res.status(200).json({
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId,
      couponApplied,
      couponError,
      discount,
    });
  } catch {
    res.status(500).json({ error: "Something went wrong while starting your payment." });
  }
}
