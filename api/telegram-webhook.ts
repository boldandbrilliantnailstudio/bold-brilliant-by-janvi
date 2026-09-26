// Receives updates from the studio's Telegram bot:
// - "/start" -> replies with the chat ID to put in TELEGRAM_CHAT_ID (or confirms it's connected)
// - "Mark Replied / Done" buttons under a request alert -> updates the request status
// Only accepts calls carrying the secret set by "Connect Telegram" in the admin panel, and only
// button presses from the owner's own chat.
import { dbFetch, getEnv, type ApiRequest, type ApiResponse } from "./_lib/db.js";
import { requestKeyboard, telegramConfig, tg, webhookSecret, type CustomRequestRow } from "./_lib/telegram.js";

type TgUpdate = {
  message?: { text?: string; chat: { id: number } };
  callback_query?: { id: string; data?: string; message?: { message_id: number; chat: { id: number } } };
};

const BUTTON_STATUSES = ["Replied", "Done"];

async function handleStart(cfg: { token: string; chatId: string | null }, chatId: string) {
  if (cfg.chatId && cfg.chatId !== chatId) return; // someone else found the bot - stay quiet
  const text =
    cfg.chatId === chatId
      ? "Connected! New custom set requests will appear here."
      : `Your chat ID is <code>${chatId}</code>\n\nAdd it in Vercel as TELEGRAM_CHAT_ID, then Redeploy and click "Connect Telegram" again in the admin panel.`;
  await tg(cfg.token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}

async function handleStatusButton(cfg: { token: string; chatId: string | null }, cb: NonNullable<TgUpdate["callback_query"]>) {
  const answer = (text: string) => tg(cfg.token, "answerCallbackQuery", { callback_query_id: cb.id, text });
  const chatId = cb.message ? String(cb.message.chat.id) : null;
  if (!chatId || chatId !== cfg.chatId) {
    await answer("Not allowed.");
    return;
  }
  const [, id, status] = (cb.data ?? "").split(":");
  const env = getEnv();
  if (!env || !id || !BUTTON_STATUSES.includes(status)) {
    await answer("Something went wrong.");
    return;
  }
  const r = await dbFetch(env.supabaseUrl, env.serviceKey, `custom_requests?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status }),
  });
  const row = ((await r.json().catch(() => [])) as CustomRequestRow[])[0];
  if (!r.ok || !row) {
    await answer("Request not found.");
    return;
  }
  await tg(cfg.token, "editMessageReplyMarkup", { chat_id: chatId, message_id: cb.message?.message_id, reply_markup: requestKeyboard(row) });
  await answer(`Marked ${status}`);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const cfg = telegramConfig();
  if (req.method !== "POST" || !cfg) {
    res.status(200).json({ ok: true });
    return;
  }
  const raw = req.headers?.["x-telegram-bot-api-secret-token"];
  const secret = Array.isArray(raw) ? raw[0] : raw;
  if (secret !== webhookSecret(cfg.token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const update = (req.body ?? {}) as TgUpdate;
  try {
    if (update.message?.text?.startsWith("/start")) await handleStart(cfg, String(update.message.chat.id));
    if (update.callback_query?.data?.startsWith("cr:")) await handleStatusButton(cfg, update.callback_query);
  } catch {
    // Always answer 200 so Telegram doesn't keep retrying the same update.
  }
  res.status(200).json({ ok: true });
}
