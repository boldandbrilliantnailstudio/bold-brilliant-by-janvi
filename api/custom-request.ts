// Public endpoint for the Shop > Custom Sets request form. Saves the request (optionally with a
// reference photo), links it to the signed-in customer if any, and alerts the owner on Telegram.
// Env vars (Vercel): SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (optional).
import { dbFetch, getEnv, getUserId, type ApiRequest, type ApiResponse } from "./_lib/db.js";
import { notifyNewRequest, type CustomRequestRow } from "./_lib/telegram.js";

type Body = { name?: string; whatsapp?: string; email?: string; setName?: string; details?: string; photo?: string };

const MIME_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

// Uploads the customer's reference photo to the public site-media bucket. Returns null if invalid.
async function uploadPhoto(env: { supabaseUrl: string; serviceKey: string }, dataUrl: string): Promise<string | null> {
  const match = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(dataUrl);
  const mime = match?.[1].toLowerCase();
  const ext = mime ? MIME_EXT[mime] : undefined;
  if (!match || !mime || !ext) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_PHOTO_BYTES) return null;
  const path = `custom-requests/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const r = await fetch(`${env.supabaseUrl}/storage/v1/object/site-media/${path}`, {
    method: "POST",
    headers: { apikey: env.serviceKey, Authorization: `Bearer ${env.serviceKey}`, "Content-Type": mime },
    body: buffer,
  });
  return r.ok ? `${env.supabaseUrl}/storage/v1/object/public/site-media/${path}` : null;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const env = getEnv();
  if (!env) {
    res.status(500).json({ error: "Requests are not available right now." });
    return;
  }

  const b = (req.body ?? {}) as Body;
  const name = b.name?.trim() ?? "";
  const whatsapp = b.whatsapp?.trim() ?? "";
  const email = b.email?.trim().toLowerCase() || null;
  const setName = b.setName?.trim() ?? "";
  const details = b.details?.trim() ?? "";
  if (name.length < 2 || name.length > 80 || !/^\+?[0-9\s-]{10,15}$/.test(whatsapp)) {
    res.status(400).json({ error: "Please check your name and WhatsApp number." });
    return;
  }
  if (email && (email.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    res.status(400).json({ error: "Please enter a valid email." });
    return;
  }
  if (!setName || setName.length > 60 || details.length < 5 || details.length > 1000) {
    res.status(400).json({ error: "Please tell us a little about the design you want." });
    return;
  }

  try {
    const [userId, referenceUrl] = await Promise.all([
      getUserId(req, env.supabaseUrl, env.serviceKey),
      b.photo ? uploadPhoto(env, b.photo) : Promise.resolve(null),
    ]);
    if (b.photo && !referenceUrl) {
      res.status(400).json({ error: "Could not upload your photo. Please try a smaller JPG or PNG." });
      return;
    }

    const r = await dbFetch(env.supabaseUrl, env.serviceKey, "custom_requests", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ user_id: userId, name, whatsapp, email, set_name: setName, details, reference_url: referenceUrl }),
    });
    const rows = (await r.json().catch(() => null)) as CustomRequestRow[] | null;
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!r.ok || !row) {
      res.status(400).json({ error: "Could not send your request. Please try again." });
      return;
    }
    await notifyNewRequest(row);
    res.status(200).json({ requestNumber: row.request_number });
  } catch {
    res.status(500).json({ error: "Could not send your request. Please try again." });
  }
}
