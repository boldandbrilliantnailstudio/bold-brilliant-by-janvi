// Public unsubscribe link, sent in the footer of promotional ad-hoc emails (Hissa 8). Opening
// it sets profiles.marketing_opt_out so no future promotional/ad-hoc email is sent to this
// customer - automatic transactional emails (order/booking updates) are unaffected.
//   GET /api/unsubscribe?u=<userId> -> confirmation page, sets marketing_opt_out = true
import { dbFetch, getEnv, type ApiRequest, type ApiResponse } from "./_lib/db.js";

function page(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{font-family:Arial,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;text-align:center;color:#333}
    h1{font-size:20px}</style></head>
    <body><h1>${message}</h1></body></html>`;
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const env = getEnv();
  const userId = req.query?.u;
  const id = Array.isArray(userId) ? userId[0] : userId;
  if (!env || !id) {
    res.setHeader("Content-Type", "text/html");
    res.status(400).send(page("This unsubscribe link is invalid."));
    return;
  }
  await dbFetch(env.supabaseUrl, env.serviceKey, `profiles?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ marketing_opt_out: true }),
  }).catch(() => null);
  res.setHeader("Content-Type", "text/html");
  res.status(200).send(page("You've been unsubscribed from promotional emails."));
}
