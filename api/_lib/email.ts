// Sends transactional emails through Resend using admin-editable HTML templates stored in the
// email_templates table (Admin > Emails). Each template can be switched on/off.
// Also supports one-off ad-hoc emails (Hissa 8: Admin > Customers > Send Email) using the
// message_templates library, and raw sends for custom text.
// Env vars (Vercel): RESEND_API_KEY (required to send), EMAIL_FROM (e.g. "Bold & Brilliant <hello@yourdomain.com>",
// needs a domain verified in Resend), ADMIN_NOTIFY_EMAIL (optional, else site_settings.email).
// Failures never break the order/booking flow - emails are best-effort.
import { dbFetch, escapeHtml } from "./db.js";

type Env = { supabaseUrl: string; serviceKey: string };
type Vars = Record<string, string | number | null | undefined>;
type Template = { subject: string; html: string; enabled: boolean; audience: "customer" | "admin" };

export type EmailKey =
  | "order_placed"
  | "order_dispatched"
  | "order_delivered"
  | "order_cancelled"
  | "booking_confirmed"
  | "booking_cancelled"
  | "admin_new_order"
  | "admin_new_booking";

function fill(text: string, vars: Vars, escape: boolean): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!(key in vars)) return match;
    const value = String(vars[key] ?? "");
    return escape ? escapeHtml(value) : value;
  });
}

// Fills {{name}}, {{coupon}}, and any other placeholder into a subject/body for ad-hoc sends
// (Hissa 8). Exported so admin-send-message.ts can preview/send with the same substitution logic.
export function fillTemplate(text: string, vars: Vars, escape: boolean): string {
  return fill(text, vars, escape);
}

export async function sendTemplateEmail(env: Env, key: EmailKey, to: string | null | undefined, vars: Vars): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    const [tplRes, settingsRes] = await Promise.all([
      dbFetch(env.supabaseUrl, env.serviceKey, `email_templates?key=eq.${key}&select=subject,html,enabled,audience`),
      dbFetch(env.supabaseUrl, env.serviceKey, "site_settings?id=eq.1&select=brand,email"),
    ]);
    const tpl = ((await tplRes.json()) as Template[])[0];
    if (!tpl?.enabled) return;
    const settings = ((await settingsRes.json()) as { brand?: string; email?: string | null }[])[0];
    const recipient = tpl.audience === "admin" ? process.env.ADMIN_NOTIFY_EMAIL || settings?.email : to;
    if (!recipient) return;

    const all: Vars = { brand: settings?.brand ?? "Bold & Brilliant", ...vars };
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Bold & Brilliant <onboarding@resend.dev>",
        to: [recipient],
        subject: fill(tpl.subject, all, false),
        html: fill(tpl.html, all, true),
      }),
    });
  } catch {
    // Best-effort: never fail the main request because of an email.
  }
}

// Sends a one-off email that isn't one of the fixed automatic templates (Hissa 8: ad-hoc emails
// from Admin > Customers). Returns an error string on failure, or null on success.
export async function sendRawEmail(to: string, subject: string, html: string): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "Email is not set up yet. Add RESEND_API_KEY in Vercel env vars.";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "Bold & Brilliant <onboarding@resend.dev>", to: [to], subject, html }),
    });
    if (!r.ok) {
      const data = (await r.json().catch(() => null)) as { message?: string } | null;
      return data?.message ?? "Resend rejected this email.";
    }
    return null;
  } catch {
    return "Could not reach the email service.";
  }
}

type OrderLike = {
  id: string;
  customer_name: string;
  phone: string;
  product_name: string;
  amount: number;
  courier?: string | null;
  tracking_number?: string | null;
};

export function orderVars(o: OrderLike): Vars {
  return {
    order_id: o.id.slice(0, 8).toUpperCase(),
    customer_name: o.customer_name,
    phone: o.phone,
    product_name: o.product_name,
    total: o.amount,
    courier: o.courier ?? "",
    tracking_number: o.tracking_number ?? "",
  };
}

type BookingLike = { booking_number: number; name: string; phone: string; service: string; preferred_date: string; preferred_time: string; message?: string | null };

export function bookingVars(b: BookingLike): Vars {
  return {
    booking_number: b.booking_number,
    name: b.name,
    phone: b.phone,
    service: b.service,
    date: new Date(`${b.preferred_date}T00:00:00+05:30`).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }),
    time: new Date(`1970-01-01T${b.preferred_time}`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
    message: b.message ?? "",
  };
}

// Looks up a customer's sign-in email (server only, needs the service role key).
export async function getUserEmail(env: Env, userId: string): Promise<string | null> {
  try {
    const r = await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}` },
    });
    if (!r.ok) return null;
    const user = (await r.json()) as { email?: string };
    return user.email ?? null;
  } catch {
    return null;
  }
}
