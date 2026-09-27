import { checkAdminPassword, dbFetch, getEnv, q, rejectWrongPassword, type ApiRequest, type ApiResponse } from "./_lib/db.js";
import { bookingVars, sendTemplateEmail } from "./_lib/email.js";
import { connectTelegram } from "./_lib/telegram.js";
import { slugify } from "../src/lib/slug.js";

type Resource = {
  table: string;
  order?: string;
  // Columns a POST/PATCH may write. Keeps the endpoint from writing unexpected columns.
  writable: string[];
  singleton?: boolean; // always row id=1
  keyColumn?: string; // e.g. "key" for site_content instead of "id"
  allowInsert?: boolean;
  allowDelete?: boolean;
};

const RESOURCES: Record<string, Resource> = {
  products: {
    table: "products",
    order: "sort_order.asc",
    writable: [
      "name", "slug", "description", "price", "compare_at_price", "image_url", "stock",
      "sold_out", "is_active", "sort_order", "category", "ingredients", "size_info",
    ],
    allowInsert: true,
    allowDelete: true,
  },
  custom_sets: {
    table: "custom_sets",
    order: "sort_order.asc",
    writable: ["name", "price_label", "description", "image_url", "is_active", "sort_order"],
    allowInsert: true,
    allowDelete: true,
  },
  product_images: {
    table: "product_images",
    order: "sort_order.asc",
    writable: ["product_id", "image_url", "sort_order"],
    allowInsert: true,
    allowDelete: true,
  },
  coupons: {
    table: "coupons",
    order: "created_at.desc",
    writable: [
      "code", "discount_type", "discount_value", "max_discount", "min_order_amount",
      "usage_limit", "per_user_limit", "starts_at", "expires_at", "is_active", "user_id", "scope",
    ],
    allowInsert: true,
    allowDelete: true,
  },
  coupon_settings: {
    table: "coupon_settings",
    writable: ["default_discount_type", "default_discount_value", "default_scope", "default_validity_days"],
    singleton: true,
  },
  promo_banners: {
    table: "promo_banners",
    order: "sort_order.asc",
    writable: ["title", "kind", "image_url", "html", "link_url", "coupon_id", "placement", "is_active", "starts_at", "ends_at", "sort_order"],
    allowInsert: true,
    allowDelete: true,
  },
  reviews: {
    table: "reviews",
    order: "sort_order.asc",
    writable: ["customer_name", "rating", "body", "photo_url", "service_name", "verified", "is_published", "sort_order"],
    allowInsert: true,
    allowDelete: true,
  },
  bookings: {
    table: "bookings",
    order: "created_at.desc",
    // Admin can create bookings (any date/time, even blocked slots) and reschedule them.
    writable: [
      "status", "admin_note", "preferred_date", "preferred_time", "service",
      "name", "phone", "email", "location_type", "location_address", "message", "created_by_admin",
    ],
    allowInsert: true,
  },
  services: {
    table: "services",
    order: "sort_order.asc",
    writable: ["name", "price", "duration_minutes", "image_url", "is_active", "allow_home_visit", "show_price", "sort_order"],
    allowInsert: true,
    allowDelete: true,
  },
  booking_settings: {
    table: "booking_settings",
    writable: ["working_days", "open_time", "close_time", "slot_minutes", "per_slot", "holidays", "show_prices", "hidden_price_text"],
    singleton: true,
  },
  custom_requests: {
    table: "custom_requests",
    order: "created_at.desc",
    writable: ["status", "admin_note"], // the customer's request itself is never edited
  },
  site_settings: {
    table: "site_settings",
    writable: [
      "brand", "byline", "logo_url", "founder_photo_url", "whatsapp_number", "phone", "email",
      "instagram_user", "instagram_url", "facebook_url", "youtube_url", "x_url", "telegram_url",
      "maps_url", "address", "hours", "delivery_note", "hero_video_url", "showcase_video_url",
      "poster_url", "gstin", "show_whatsapp", "show_instagram", "show_facebook", "show_youtube",
      "show_x", "show_telegram", "booking_confirm_message",
      "show_footer_email", "show_footer_whatsapp", "show_footer_phone", "show_footer_address",
      "show_footer_maps", "show_footer_hours",
    ],
    singleton: true,
  },
  site_content: {
    table: "site_content",
    keyColumn: "key",
    writable: ["title", "body", "format"],
  },
  invoice_template: {
    table: "invoice_template",
    writable: ["html", "prefix"],
    singleton: true,
  },
  email_templates: {
    table: "email_templates",
    order: "sort_order.asc",
    keyColumn: "key",
    writable: ["subject", "html", "enabled"],
  },
};

type BookingRow = {
  id: string; booking_number: number; name: string; phone: string; email: string | null;
  service: string; preferred_date: string; preferred_time: string; message: string | null; status: string;
};

function firstHeader(req: ApiRequest, key: string): string | undefined {
  const v = req.headers?.[key];
  return Array.isArray(v) ? v[0] : v;
}

async function emailBooking(env: { supabaseUrl: string; serviceKey: string }, id: string, res: ApiResponse) {
  if (!process.env.RESEND_API_KEY) {
    res.status(400).json({ error: "Email is not set up yet. Add RESEND_API_KEY in Vercel." });
    return;
  }
  const r = await dbFetch(env.supabaseUrl, env.serviceKey, `bookings?id=eq.${encodeURIComponent(id)}&select=*`);
  const booking = ((await r.json()) as BookingRow[])[0];
  if (!booking) {
    res.status(404).json({ error: "Booking not found." });
    return;
  }
  if (!booking.email) {
    res.status(400).json({ error: "This customer did not give an email." });
    return;
  }
  const key = booking.status === "Cancelled" ? "booking_cancelled" : booking.status === "Confirmed" ? "booking_confirmed" : null;
  if (!key) {
    res.status(400).json({ error: "Accept or decline the booking first." });
    return;
  }
  const tplRes = await dbFetch(env.supabaseUrl, env.serviceKey, `email_templates?key=eq.${key}&select=enabled`);
  if (!((await tplRes.json()) as { enabled: boolean }[])[0]?.enabled) {
    res.status(400).json({ error: "This email is switched off in Admin > Emails." });
    return;
  }
  await sendTemplateEmail(env, key, booking.email, bookingVars(booking));
  res.status(200).json({ ok: true });
}

// Ensures a product insert/update always has a unique, URL-safe slug: uses the admin-provided
// slug (or derives one from the name), then appends "-2", "-3"... if it collides with another
// product's slug so every product keeps its own /shop/<slug> page.
async function ensureUniqueProductSlug(
  env: { supabaseUrl: string; serviceKey: string },
  body: Record<string, unknown>,
  currentId: string | null,
): Promise<void> {
  const nameOrSlug = typeof body.slug === "string" && body.slug.trim() ? body.slug : typeof body.name === "string" ? body.name : "";
  const base = slugify(nameOrSlug) || "product";
  let candidate = base;
  let suffix = 2;
  for (;;) {
    const filter = currentId
      ? `slug=eq.${encodeURIComponent(candidate)}&id=neq.${encodeURIComponent(currentId)}`
      : `slug=eq.${encodeURIComponent(candidate)}`;
    const r = await dbFetch(env.supabaseUrl, env.serviceKey, `products?${filter}&select=id`);
    const rows = (await r.json().catch(() => [])) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) break;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  body.slug = candidate;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const resourceName = q(req, "resource");
  const resource = resourceName ? RESOURCES[resourceName] : undefined;
  if (!resource) {
    res.status(400).json({ error: "Unknown or missing resource" });
    return;
  }

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

  try {
    if (req.method === "POST" && resourceName === "bookings" && q(req, "action") === "email") {
      const id = (req.body as { id?: unknown } | undefined)?.id;
      if (typeof id !== "string" || !id) {
        res.status(400).json({ error: "Missing id" });
        return;
      }
      await emailBooking(env, id, res);
      return;
    }

    if (req.method === "POST" && resourceName === "custom_requests" && q(req, "action") === "telegram-setup") {
      const result = await connectTelegram(firstHeader(req, "x-forwarded-host") ?? firstHeader(req, "host"));
      if (result.ok) res.status(200).json({ ok: true, message: result.message });
      else res.status(400).json({ error: result.message });
      return;
    }

    if (req.method === "GET") {
      const path = resource.singleton
        ? `${resource.table}?id=eq.1&select=*`
        : `${resource.table}?select=*${resource.order ? `&order=${resource.order}` : ""}`;
      const r = await dbFetch(supabaseUrl, serviceKey, path);
      if (!r.ok) {
        res.status(502).json({ error: "Could not load data." });
        return;
      }
      const rows = (await r.json()) as unknown[];
      res.status(200).json(resource.singleton ? { row: rows[0] ?? null } : { rows });
      return;
    }

    if (req.method === "POST") {
      if (!resource.allowInsert) {
        res.status(405).json({ error: "This resource cannot be created from the admin panel." });
        return;
      }
      const body = pickWritable(req.body, resource.writable);
      if (resourceName === "products") await ensureUniqueProductSlug(env, body, null);
      const r = await dbFetch(supabaseUrl, serviceKey, resource.table, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        res.status(400).json({ error: friendlyDbError(data) });
        return;
      }
      res.status(200).json({ row: Array.isArray(data) ? data[0] : data });
      return;
    }

    if (req.method === "PATCH") {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const updates = pickWritable(body, resource.writable);
      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: "Nothing to update" });
        return;
      }

      // Singletons: upsert row 1, so saving works even if the row was never created.
      if (resource.singleton) {
        const r = await dbFetch(supabaseUrl, serviceKey, `${resource.table}?on_conflict=id`, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=representation" },
          body: JSON.stringify({ id: 1, ...updates }),
        });
        const data = await r.json();
        if (!r.ok) {
          res.status(400).json({ error: friendlyDbError(data) });
          return;
        }
        res.status(200).json({ row: Array.isArray(data) ? data[0] : data });
        return;
      }

      let filter: string;
      if (resource.keyColumn) {
        const key = body[resource.keyColumn];
        if (typeof key !== "string" || !key) {
          res.status(400).json({ error: `Missing ${resource.keyColumn}` });
          return;
        }
        filter = `${resource.keyColumn}=eq.${encodeURIComponent(key)}`;
      } else {
        const id = body.id;
        if (typeof id !== "string" || !id) {
          res.status(400).json({ error: "Missing id" });
          return;
        }
        filter = `id=eq.${encodeURIComponent(id)}`;
        if (resourceName === "products" && "slug" in updates) await ensureUniqueProductSlug(env, updates, id);
      }
      const r = await dbFetch(supabaseUrl, serviceKey, `${resource.table}?${filter}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(updates),
      });
      const data = await r.json();
      if (!r.ok) {
        res.status(400).json({ error: friendlyDbError(data) });
        return;
      }
      // PostgREST returns 200 with [] when nothing matched - report it instead of fake success.
      if (Array.isArray(data) && data.length === 0) {
        res.status(404).json({ error: "This item no longer exists. Please refresh the page." });
        return;
      }
      res.status(200).json({ row: Array.isArray(data) ? data[0] : data });
      return;
    }

    if (req.method === "DELETE") {
      if (!resource.allowDelete) {
        res.status(405).json({ error: "This resource cannot be deleted from the admin panel." });
        return;
      }
      const id = q(req, "id");
      if (!id) {
        res.status(400).json({ error: "Missing id" });
        return;
      }
      const r = await dbFetch(supabaseUrl, serviceKey, `${resource.table}?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Prefer: "return=representation" },
      });
      if (!r.ok) {
        res.status(400).json({ error: "Could not delete." });
        return;
      }
      const deleted = (await r.json().catch(() => [])) as unknown[];
      if (Array.isArray(deleted) && deleted.length === 0) {
        res.status(404).json({ error: "This item was already deleted. Please refresh the page." });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch {
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}

function pickWritable(body: unknown, allowed: string[]): Record<string, unknown> {
  const source = (body ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

function friendlyDbError(data: unknown): string {
  const msg = (data as { message?: string } | undefined)?.message;
  if (!msg) return "Could not save. Please check the values and try again.";
  if (msg.includes("duplicate key")) return "That code or name already exists. Please use a different one.";
  return msg;
}
