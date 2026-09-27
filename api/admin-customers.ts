// Hissa 6: Customer profiles admin. Lists every customer who has a profile, with their spend,
// order/booking/review counts, tags and private admin notes - and a detail view with their full
// address, order/booking/review (with photos) history, and coupons issued/used. Search matches
// name, phone, OR email. Protected by the shared admin password.
//
//   GET   /api/admin-customers                        -> { customers: CustomerSummary[] }
//   GET   /api/admin-customers?search=<text>           -> filtered by name/phone/email
//   GET   /api/admin-customers?id=<uuid>                -> { customer: CustomerDetail }
//   PATCH /api/admin-customers  body: { id, adminNotes?, tags?, marketingOptOut? }
import { checkAdminPassword, dbFetch, getEnv, q, rejectWrongPassword, type ApiRequest, type ApiResponse } from "./_lib/db.js";

type ProfileRow = {
  id: string;
  customer_number: number;
  full_name: string;
  phone: string;
  pincode: string;
  address_line1: string;
  address_line2: string;
  landmark: string | null;
  city: string;
  state: string;
  admin_notes: string | null;
  tags: string[];
  marketing_opt_out: boolean;
  updated_at: string;
};

type AuthUser = { id: string; email?: string };

async function getEmail(env: { supabaseUrl: string; serviceKey: string }, userId: string): Promise<string | null> {
  const r = await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${userId}`, {
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` },
  }).catch(() => null);
  if (!r?.ok) return null;
  const data = (await r.json().catch(() => null)) as { email?: string } | null;
  return data?.email ?? null;
}

// Looks up auth.users by email so search can match a customer's sign-in email too (Supabase's
// REST API has no email filter on profiles - email lives only in auth.users). Returns matching
// user ids, or null if the search text isn't email-like enough to bother (keeps name/phone-only
// searches fast and avoids scanning every user for a 2-letter query).
async function findUserIdsByEmail(env: { supabaseUrl: string; serviceKey: string }, search: string): Promise<string[]> {
  if (!search.includes("@") && search.length < 4) return [];
  const r = await fetch(`${env.supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` },
  }).catch(() => null);
  if (!r?.ok) return [];
  const data = (await r.json().catch(() => null)) as { users?: AuthUser[] } | null;
  const needle = search.toLowerCase();
  return (data?.users ?? []).filter((u) => u.email?.toLowerCase().includes(needle)).map((u) => u.id);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const env = getEnv();
  if (!env || !process.env.ADMIN_PASSWORD) {
    res.status(500).json({ error: "Admin panel is not set up yet. Add ADMIN_PASSWORD in Vercel env vars." });
    return;
  }
  if (!checkAdminPassword(req)) {
    await rejectWrongPassword(res);
    return;
  }
  const { supabaseUrl, serviceKey } = env;

  if (req.method === "GET") {
    const id = q(req, "id");
    try {
      if (id) {
        const profRes = await dbFetch(supabaseUrl, serviceKey, `profiles?id=eq.${encodeURIComponent(id)}&select=*`);
        const profile = ((await profRes.json()) as ProfileRow[])[0];
        if (!profile) {
          res.status(404).json({ error: "Customer not found." });
          return;
        }
        const [email, ordersRes, bookingsRes, reviewsRes, couponsRes, redemptionsRes] = await Promise.all([
          getEmail(env, id),
          dbFetch(supabaseUrl, serviceKey, `orders?user_id=eq.${id}&select=id,product_name,amount,status,created_at&order=created_at.desc`),
          dbFetch(supabaseUrl, serviceKey, `bookings?user_id=eq.${id}&select=id,service,status,preferred_date&order=preferred_date.desc`),
          dbFetch(supabaseUrl, serviceKey, `reviews?user_id=eq.${id}&select=id,rating,body,photo_urls,created_at&order=created_at.desc`),
          dbFetch(supabaseUrl, serviceKey, `coupons?user_id=eq.${id}&select=id,code,discount_type,discount_value,scope,is_active,expires_at,created_at&order=created_at.desc`),
          dbFetch(supabaseUrl, serviceKey, `coupon_redemptions?user_id=eq.${id}&select=coupon_id`),
        ]);
        const orders = await ordersRes.json().catch(() => []);
        const bookings = await bookingsRes.json().catch(() => []);
        const reviews = await reviewsRes.json().catch(() => []);
        const coupons = (await couponsRes.json().catch(() => [])) as { id: string }[];
        const redeemedCouponIds = new Set(((await redemptionsRes.json().catch(() => [])) as { coupon_id: string }[]).map((r) => r.coupon_id));
        const couponsWithUsage = coupons.map((c) => ({ ...c, used: redeemedCouponIds.has(c.id) }));
        res.status(200).json({ customer: { profile, email, orders, bookings, reviews, coupons: couponsWithUsage } });
        return;
      }

      const search = q(req, "search")?.trim();
      const cleanSearch = search?.replace(/[%,()*]/g, "") ?? "";
      const emailUserIds = search ? await findUserIdsByEmail(env, cleanSearch) : [];
      let filter = "";
      if (search) {
        const nameOrPhone = `full_name.ilike.*${encodeURIComponent(cleanSearch)}*,phone.ilike.*${encodeURIComponent(cleanSearch)}*`;
        const emailIds = emailUserIds.length > 0 ? `,id.in.(${emailUserIds.join(",")})` : "";
        filter = `&or=(${nameOrPhone}${emailIds})`;
      }
      const profRes = await dbFetch(supabaseUrl, serviceKey, `profiles?select=*&order=updated_at.desc${filter}&limit=200`);
      const profiles = (await profRes.json()) as ProfileRow[];
      const ids = profiles.map((p) => p.id);
      if (ids.length === 0) {
        res.status(200).json({ customers: [] });
        return;
      }
      const idList = ids.join(",");
      const [ordersRes, bookingsRes, reviewsRes] = await Promise.all([
        dbFetch(supabaseUrl, serviceKey, `orders?user_id=in.(${idList})&status=neq.Cancelled&select=user_id,amount`),
        dbFetch(supabaseUrl, serviceKey, `bookings?user_id=in.(${idList})&select=user_id`),
        dbFetch(supabaseUrl, serviceKey, `reviews?user_id=in.(${idList})&select=user_id`),
      ]);
      const orders = (await ordersRes.json().catch(() => [])) as { user_id: string; amount: number }[];
      const bookings = (await bookingsRes.json().catch(() => [])) as { user_id: string }[];
      const reviews = (await reviewsRes.json().catch(() => [])) as { user_id: string }[];

      const spendByUser = new Map<string, number>();
      const orderCountByUser = new Map<string, number>();
      for (const o of orders) {
        spendByUser.set(o.user_id, (spendByUser.get(o.user_id) ?? 0) + Number(o.amount));
        orderCountByUser.set(o.user_id, (orderCountByUser.get(o.user_id) ?? 0) + 1);
      }
      const bookingCountByUser = new Map<string, number>();
      for (const b of bookings) bookingCountByUser.set(b.user_id, (bookingCountByUser.get(b.user_id) ?? 0) + 1);
      const reviewCountByUser = new Map<string, number>();
      for (const r of reviews) reviewCountByUser.set(r.user_id, (reviewCountByUser.get(r.user_id) ?? 0) + 1);

      const customers = profiles.map((p) => ({
        id: p.id,
        customerId: String(p.customer_number).padStart(6, "0"),
        fullName: p.full_name,
        phone: p.phone,
        city: p.city,
        state: p.state,
        tags: p.tags ?? [],
        adminNotes: p.admin_notes,
        totalSpend: spendByUser.get(p.id) ?? 0,
        orderCount: orderCountByUser.get(p.id) ?? 0,
        bookingCount: bookingCountByUser.get(p.id) ?? 0,
        reviewCount: reviewCountByUser.get(p.id) ?? 0,
      }));
      res.status(200).json({ customers });
    } catch {
      res.status(500).json({ error: "Could not load customers." });
    }
    return;
  }

  if (req.method === "PATCH") {
    const body = (req.body ?? {}) as { id?: string; adminNotes?: string; tags?: string[]; marketingOptOut?: boolean };
    if (!body.id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }
    const patch: Record<string, unknown> = {};
    if (body.adminNotes !== undefined) patch.admin_notes = body.adminNotes;
    if (body.tags !== undefined) patch.tags = body.tags;
    if (body.marketingOptOut !== undefined) patch.marketing_opt_out = body.marketingOptOut;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }
    const r = await dbFetch(supabaseUrl, serviceKey, `profiles?id=eq.${encodeURIComponent(body.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      res.status(400).json({ error: "Could not save." });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
