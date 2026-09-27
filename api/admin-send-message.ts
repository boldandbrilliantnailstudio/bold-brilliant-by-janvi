// Hissa 8: ad-hoc messaging from Admin > Customers - send a one-off email or log a WhatsApp
// message to a specific customer, plus manage the reusable template library (separate from the
// fixed automatic order/booking emails in Admin > Emails). Also exposes the admin_send_log
// history so the studio can see what was sent to whom (Admin > Send History).
//
//   GET    /api/admin-send-message?resource=templates&channel=email|whatsapp -> list templates
//   POST   /api/admin-send-message?resource=templates   body: { channel, name, subject?, body }
//   PATCH  /api/admin-send-message?resource=templates   body: { id, name?, subject?, body }
//   DELETE /api/admin-send-message?resource=templates&id=<uuid>
//   GET    /api/admin-send-message?resource=log         -> { log: SendLogRow[] } (most recent 200)
//   POST   /api/admin-send-message?action=send-email     body: { userId, subject, html, fromAddress? }
//   POST   /api/admin-send-message?action=log-whatsapp   body: { userId, body }
import { checkAdminPassword, dbFetch, getEnv, q, rejectWrongPassword, type ApiRequest, type ApiResponse } from "./_lib/db.js";
import { getUserEmail, sendRawEmail } from "./_lib/email.js";

type Env = { supabaseUrl: string; serviceKey: string };
type MessageTemplate = { id: string; channel: "email" | "whatsapp"; name: string; subject: string | null; body: string; sort_order: number };
type SendLogRow = { id: string; user_id: string; channel: "email" | "whatsapp"; subject: string | null; body: string; sent_at: string };

async function handleTemplates(env: Env, req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method === "GET") {
    const channel = q(req, "channel");
    const filter = channel ? `&channel=eq.${encodeURIComponent(channel)}` : "";
    const r = await dbFetch(env.supabaseUrl, env.serviceKey, `message_templates?select=*&order=sort_order.asc${filter}`);
    if (!r.ok) {
      res.status(502).json({ error: "Could not load templates." });
      return;
    }
    res.status(200).json({ templates: (await r.json()) as MessageTemplate[] });
    return;
  }

  if (req.method === "POST") {
    const body = (req.body ?? {}) as { channel?: string; name?: string; subject?: string | null; body?: string };
    if (body.channel !== "email" && body.channel !== "whatsapp") {
      res.status(400).json({ error: "Channel must be email or whatsapp." });
      return;
    }
    if (!body.name?.trim() || !body.body?.trim()) {
      res.status(400).json({ error: "Please fill in the name and message." });
      return;
    }
    const r = await dbFetch(env.supabaseUrl, env.serviceKey, "message_templates", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ channel: body.channel, name: body.name.trim(), subject: body.channel === "email" ? (body.subject ?? "").trim() : null, body: body.body }),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(400).json({ error: "Could not save template." });
      return;
    }
    res.status(200).json({ template: Array.isArray(data) ? data[0] : data });
    return;
  }

  if (req.method === "PATCH") {
    const body = (req.body ?? {}) as { id?: string; name?: string; subject?: string | null; body?: string };
    if (!body.id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.subject !== undefined) updates.subject = body.subject;
    if (body.body !== undefined) updates.body = body.body;
    const r = await dbFetch(env.supabaseUrl, env.serviceKey, `message_templates?id=eq.${encodeURIComponent(body.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(updates),
    });
    const data = await r.json().catch(() => []);
    if (!r.ok || (Array.isArray(data) && data.length === 0)) {
      res.status(400).json({ error: "Could not save template." });
      return;
    }
    res.status(200).json({ template: Array.isArray(data) ? data[0] : data });
    return;
  }

  if (req.method === "DELETE") {
    const id = q(req, "id");
    if (!id) {
      res.status(400).json({ error: "Missing id" });
      return;
    }
    const r = await dbFetch(env.supabaseUrl, env.serviceKey, `message_templates?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) {
      res.status(400).json({ error: "Could not delete template." });
      return;
    }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

// Admin > Send History: every ad-hoc email/WhatsApp message ever sent, newest first, with the
// customer's name/phone attached so the list is readable without a second lookup.
async function handleLog(env: Env, res: ApiResponse): Promise<void> {
  const logRes = await dbFetch(env.supabaseUrl, env.serviceKey, "admin_send_log?select=*&order=sent_at.desc&limit=200");
  if (!logRes.ok) {
    res.status(502).json({ error: "Could not load send history." });
    return;
  }
  const log = (await logRes.json()) as SendLogRow[];
  const userIds = Array.from(new Set(log.map((l) => l.user_id)));
  if (userIds.length === 0) {
    res.status(200).json({ log: [] });
    return;
  }
  const profRes = await dbFetch(env.supabaseUrl, env.serviceKey, `profiles?id=in.(${userIds.join(",")})&select=id,full_name,phone`);
  const profiles = (await profRes.json().catch(() => [])) as { id: string; full_name: string; phone: string }[];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  res.status(200).json({
    log: log.map((l) => ({ ...l, customerName: byId.get(l.user_id)?.full_name ?? "Unknown", customerPhone: byId.get(l.user_id)?.phone ?? "" })),
  });
}

async function handleSendEmail(env: Env, req: ApiRequest, res: ApiResponse): Promise<void> {
  const body = (req.body ?? {}) as { userId?: string; subject?: string; html?: string; fromAddress?: string | null };
  if (!body.userId || !body.subject?.trim() || !body.html?.trim()) {
    res.status(400).json({ error: "Missing userId, subject or message." });
    return;
  }

  // Respect unsubscribe: never send a promotional/ad-hoc email to a customer who opted out.
  const profRes = await dbFetch(env.supabaseUrl, env.serviceKey, `profiles?id=eq.${encodeURIComponent(body.userId)}&select=marketing_opt_out`);
  const profile = ((await profRes.json().catch(() => [])) as { marketing_opt_out?: boolean }[])[0];
  if (profile?.marketing_opt_out) {
    res.status(400).json({ error: "This customer has unsubscribed from promotional emails." });
    return;
  }

  const email = await getUserEmail(env, body.userId);
  if (!email) {
    res.status(400).json({ error: "This customer has no email on file (they may have signed in with phone/social only)." });
    return;
  }

  const settingsRes = await dbFetch(env.supabaseUrl, env.serviceKey, "site_settings?id=eq.1&select=brand");
  const brand = ((await settingsRes.json().catch(() => [])) as { brand?: string }[])[0]?.brand ?? "Bold & Brilliant";

  // Unsubscribe link points at this deployment's own /api/unsubscribe endpoint.
  const origin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const unsubUrl = origin ? `${origin}/api/unsubscribe?u=${encodeURIComponent(body.userId)}` : null;

  const error = await sendRawEmail(email, body.subject, body.html, {
    fromAddress: body.fromAddress ?? null,
    unsubscribeUrl: unsubUrl,
    brand,
  });
  if (error) {
    res.status(400).json({ error });
    return;
  }
  await dbFetch(env.supabaseUrl, env.serviceKey, "admin_send_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: body.userId, channel: "email", subject: body.subject, body: body.html }),
  }).catch(() => null);
  res.status(200).json({ ok: true, sentTo: email });
}

async function handleLogWhatsapp(env: Env, req: ApiRequest, res: ApiResponse): Promise<void> {
  const body = (req.body ?? {}) as { userId?: string; body?: string };
  if (!body.userId || !body.body?.trim()) {
    res.status(400).json({ error: "Missing userId or message." });
    return;
  }
  await dbFetch(env.supabaseUrl, env.serviceKey, "admin_send_log", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: body.userId, channel: "whatsapp", subject: null, body: body.body }),
  }).catch(() => null);
  res.status(200).json({ ok: true });
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const env = getEnv();
  if (!env || !process.env.ADMIN_PASSWORD) {
    res.status(500).json({ error: "Admin panel is not set up yet. Add ADMIN_PASSWORD in Vercel env vars." });
    return;
  }
  if (!checkAdminPassword(req)) {
    await rejectWrongPassword(res);
    return;
  }

  try {
    if (q(req, "resource") === "templates") {
      await handleTemplates(env, req, res);
      return;
    }
    if (req.method === "GET" && q(req, "resource") === "log") {
      await handleLog(env, res);
      return;
    }
    if (req.method === "POST" && q(req, "action") === "send-email") {
      await handleSendEmail(env, req, res);
      return;
    }
    if (req.method === "POST" && q(req, "action") === "log-whatsapp") {
      await handleLogWhatsapp(env, req, res);
      return;
    }
    res.status(400).json({ error: "Unknown request." });
  } catch {
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
