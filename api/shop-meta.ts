// Renders minimal HTML with Open Graph tags for social link previews (WhatsApp, Facebook,
// Telegram, etc.) when they crawl a product's shop URL. Vercel only routes here for known bot
// user agents (see the "has" rule in vercel.json) - real visitors always get the normal SPA at
// the same /shop/<slug> URL.
import { dbFetch, escapeHtml, getEnv, q, type ApiRequest, type ApiResponse } from "./_lib/db.js";

type ProductRow = { name: string; description: string | null; price: number; image_url: string | null };

function firstHeader(req: ApiRequest, key: string): string | undefined {
  const v = req.headers?.[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const slug = q(req, "slug");
  const env = getEnv();
  if (!slug || !env) {
    res.status(404).send("Not found");
    return;
  }

  const r = await dbFetch(
    env.supabaseUrl,
    env.serviceKey,
    `products?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=name,description,price,image_url`,
  );
  const rows = (await r.json().catch(() => [])) as ProductRow[];
  const product = rows[0];

  const host = firstHeader(req, "x-forwarded-host") ?? firstHeader(req, "host") ?? "";
  const proto = firstHeader(req, "x-forwarded-proto") ?? "https";
  const url = `${proto}://${host}/shop/${encodeURIComponent(slug)}`;

  const title = product ? `${product.name} | Bold & Brilliant` : "Bold & Brilliant";
  const description = product
    ? product.description?.trim() || `₹${product.price} - Shop this nail set from Bold & Brilliant.`
    : "Premium nail art studio in Rajkot.";
  const image = product?.image_url || `${proto}://${host}/logo.jpg`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  res.send(`<!doctype html>
<html lang="en-IN">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${escapeHtml(url)}" />
<meta property="og:type" content="product" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:url" content="${escapeHtml(url)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>
<p>${escapeHtml(title)}</p>
<script>location.href=${JSON.stringify(url)};</script>
</body>
</html>`);
}
