// Hissa 8: ad-hoc messaging from Admin > Customers - send a one-off email or log a WhatsApp
// message to a specific customer, plus manage the reusable template library (separate from the
// fixed automatic order/booking emails in Admin > Emails).
//
//   GET    /api/admin-send-message?resource=templates&channel=email|whatsapp -> list templates
//   POST   /api/admin-send-message?resource=templates   body: { channel, name, subject?, body }
//   PATCH  /api/admin-send-message?resource=templates   body: { id, name?, subject?, body }
//   DELETE /api/admin-send-message?resource=templates&id=<uuid>
//   POST   /api/admin-send-message?action=send-email     body: { userId, subject, html }
//   POST   /api/admin-send-message?action=log-whatsapp   body: { userId, body }
import { checkAdminPassword, dbFetch, getEnv, q, rejectWrongPassword, type ApiRequest, type ApiResponse } from "./_lib/db.js";
import { getUserEmail, sendRawEmail } from "./_lib/email.js";

type Env = { supabaseUrl: string; serviceKey: string };
type MessageTemplate = { id: string; channel: "email" | "whatsapp"; name: string; subject: string | null; body: string; sort_order: number };

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

async function handleSendEmail(env: Env, req: ApiRequest, res: ApiResponse): Promise<void> {
  const body = (req.body ?? {}) as { userId?: string; subject?: string; html?: string };
  if (!body.userId || !body.subject?.trim() || !body.html?.trim()) {
    res.status(400).json({ error: "Missing userId, subject or message." });
    return;
  }
  const email = await getUserEmail(env, body.userId);
  if (!email) {
    res.status(400).json({ error: "This customer has no email on file (they may have signed in with phone/social only)." });
    return;
  }
  const error = await sendRawEmail(email, body.subject, body.html);
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
