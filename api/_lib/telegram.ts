// Telegram alerts for custom set requests. The studio owner gets every new request in Telegram
// with a "Reply on WhatsApp" button (opens the customer's chat) and "Mark Replied / Done" buttons
// that update the request in Admin > Custom Requests.
// Env vars (Vercel): TELEGRAM_BOT_TOKEN (from @BotFather), TELEGRAM_CHAT_ID (the bot tells you this
// when you send it /start after clicking "Connect Telegram" in the admin panel).
import { createHash } from "node:crypto";
import { escapeHtml } from "./db.js";

export type CustomRequestRow = {
  id: string;
  request_number: number;
  name: string;
  whatsapp: string;
  email: string | null;
  set_name: string;
  details: string;
  reference_url: string | null;
  status: string;
  created_at: string;
};

type TgResult = { ok: boolean; description?: string };

export function telegramConfig(): { token: string; chatId: string | null } | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  return { token, chatId: process.env.TELEGRAM_CHAT_ID?.trim() || null };
}

// Secret Telegram sends back on every webhook call. Derived from the bot token so the owner
// doesn't need to create yet another env var.
export function webhookSecret(token: string): string {
  return createHash("sha256").update(`bb-webhook:${token}`).digest("hex").slice(0, 48);
}

export async function tg(token: string, method: string, body: unknown): Promise<TgResult> {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await r.json().catch(() => ({ ok: false }))) as TgResult;
}

// Customer number as WhatsApp needs it: digits only, with India code if they typed 10 digits.
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export function whatsappReplyLink(r: Pick<CustomRequestRow, "name" | "whatsapp" | "set_name" | "request_number">): string {
  const text = `Hi ${r.name}! This is Bold & Brilliant about your ${r.set_name} request #${r.request_number}.`;
  return `https://wa.me/${waNumber(r.whatsapp)}?text=${encodeURIComponent(text)}`;
}

export function requestKeyboard(r: CustomRequestRow) {
  return {
    inline_keyboard: [
      [{ text: "Reply on WhatsApp", url: whatsappReplyLink(r) }],
      ["Replied", "Done"].map((s) => ({
        text: r.status === s ? `${s} (current)` : `Mark ${s}`,
        callback_data: `cr:${r.id}:${s}`,
      })),
    ],
  };
}

function requestMessage(r: CustomRequestRow): string {
  const lines = [
    `<b>New custom set request #${r.request_number}</b>`,
    "",
    `<b>Set:</b> ${escapeHtml(r.set_name)}`,
    `<b>Name:</b> ${escapeHtml(r.name)}`,
    `<b>WhatsApp:</b> ${escapeHtml(r.whatsapp)}`,
  ];
  if (r.email) lines.push(`<b>Email:</b> ${escapeHtml(r.email)}`);
  lines.push("", escapeHtml(r.details));
  if (r.reference_url) lines.push("", `<a href="${escapeHtml(r.reference_url)}">View reference photo</a>`);
  return lines.join("\n");
}

// Best-effort: a Telegram problem must never fail the customer's request.
export async function notifyNewRequest(r: CustomRequestRow): Promise<void> {
  const cfg = telegramConfig();
  if (!cfg?.chatId) return;
  try {
    await tg(cfg.token, "sendMessage", {
      chat_id: cfg.chatId,
      text: requestMessage(r),
      parse_mode: "HTML",
      reply_markup: requestKeyboard(r),
    });
  } catch {
    // ignore
  }
}

export type LowRatingReviewAlert = {
  customerName: string;
  rating: number;
  body: string;
  targetLabel: string; // e.g. "product: Nude Glaze Set" or "studio visit"
  whatsapp: string | null;
};

// Alerts the studio owner immediately whenever a customer leaves a 1 or 2 star review, so they
// can follow up on WhatsApp before it's seen by other customers (reviews now publish instantly).
export async function notifyLowRatingReview(r: LowRatingReviewAlert): Promise<void> {
  const cfg = telegramConfig();
  if (!cfg?.chatId) return;
  try {
    const stars = "\u2b50".repeat(r.rating);
    const lines = [
      `<b>\u26a0\ufe0f Low rating review (${stars})</b>`,
      "",
      `<b>From:</b> ${escapeHtml(r.customerName)}`,
      `<b>About:</b> ${escapeHtml(r.targetLabel)}`,
      "",
      escapeHtml(r.body),
    ];
    const replyMarkup = r.whatsapp
      ? { inline_keyboard: [[{ text: "Reply on WhatsApp", url: `https://wa.me/${waNumber(r.whatsapp)}` }]] }
      : undefined;
    await tg(cfg.token, "sendMessage", {
      chat_id: cfg.chatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  } catch {
    // ignore - a Telegram problem must never fail the customer's review submission
  }
}

// Called from the admin panel's "Connect Telegram" button: points the bot at this website and,
// once the chat ID is set, sends a test message.
export async function connectTelegram(host: string | undefined): Promise<{ ok: boolean; message: string }> {
  const cfg = telegramConfig();
  if (!cfg) return { ok: false, message: "Add TELEGRAM_BOT_TOKEN in Vercel env vars first, then Redeploy." };
  if (!host) return { ok: false, message: "Could not detect the website address." };

  const hook = await tg(cfg.token, "setWebhook", {
    url: `https://${host}/api/telegram-webhook`,
    secret_token: webhookSecret(cfg.token),
    allowed_updates: ["message", "callback_query"],
  });
  if (!hook.ok) return { ok: false, message: `Telegram said: ${hook.description ?? "invalid bot token"}` };

  if (!cfg.chatId) {
    return {
      ok: true,
      message: "Bot connected. Now open your bot in Telegram and send /start. It will reply with your chat ID - add it in Vercel as TELEGRAM_CHAT_ID and Redeploy.",
    };
  }
  const test = await tg(cfg.token, "sendMessage", {
    chat_id: cfg.chatId,
    text: "Telegram alerts are working. New custom set requests will appear here.",
  });
  if (!test.ok) return { ok: false, message: "Bot connected, but it could not message you. Send /start to your bot and check TELEGRAM_CHAT_ID." };
  return { ok: true, message: "Connected! A test message was sent to your Telegram." };
}
