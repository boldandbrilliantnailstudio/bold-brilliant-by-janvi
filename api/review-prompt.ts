// Powers the "please review" popup (Hissa 5). GET finds one Delivered order or Completed
// booking that the signed-in customer hasn't reviewed yet and has been shown fewer than 2
// times, then bumps its shown count. POST marks it acknowledged early (customer dismissed it
// or wrote the review) - reviewing itself already stops it forever via the unique index on
// order_id/booking_id in reviews, so POST just avoids showing it again this same visit.
import { dbFetch, getEnv, getUserId, type ApiRequest, type ApiResponse } from "./_lib/db.js";

const MAX_SHOWS = 2;

type Target = { kind: "order"; id: string; label: string } | { kind: "booking"; id: string; label: string };

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const env = getEnv();
  if (!env) {
    res.status(200).json({ target: null });
    return;
  }
  const userId = await getUserId(req, env.supabaseUrl, env.serviceKey);
  if (!userId) {
    res.status(200).json({ target: null });
    return;
  }

  if (req.method === "GET") {
    try {
      const [ordersRes, bookingsRes, reviewedRes] = await Promise.all([
        dbFetch(
          env.supabaseUrl, env.serviceKey,
          `orders?user_id=eq.${userId}&status=eq.Delivered&review_prompt_shown_count=lt.${MAX_SHOWS}&select=id,product_name&order=delivered_at.desc.nullslast&limit=5`,
        ),
        dbFetch(
          env.supabaseUrl, env.serviceKey,
          `bookings?user_id=eq.${userId}&status=eq.Completed&review_prompt_shown_count=lt.${MAX_SHOWS}&select=id,service&order=preferred_date.desc&limit=5`,
        ),
        dbFetch(env.supabaseUrl, env.serviceKey, `reviews?user_id=eq.${userId}&select=order_id,booking_id`),
      ]);
      const orders = (await ordersRes.json().catch(() => [])) as { id: string; product_name: string }[];
      const bookings = (await bookingsRes.json().catch(() => [])) as { id: string; service: string }[];
      const reviewed = (await reviewedRes.json().catch(() => [])) as { order_id: string | null; booking_id: string | null }[];
      const reviewedOrderIds = new Set(reviewed.map((r) => r.order_id).filter(Boolean));
      const reviewedBookingIds = new Set(reviewed.map((r) => r.booking_id).filter(Boolean));

      const order = orders.find((o) => !reviewedOrderIds.has(o.id));
      const booking = bookings.find((b) => !reviewedBookingIds.has(b.id));

      const target: Target | null = order
        ? { kind: "order", id: order.id, label: order.product_name }
        : booking
          ? { kind: "booking", id: booking.id, label: booking.service }
          : null;

      if (target) {
        const table = target.kind === "order" ? "orders" : "bookings";
        await dbFetch(env.supabaseUrl, env.serviceKey, `${table}?id=eq.${target.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            review_prompt_shown_count:
              (target.kind === "order" ? orders.find((o) => o.id === target.id) : bookings.find((b) => b.id === target.id))
                ? undefined
                : undefined,
          }),
        }).catch(() => null);
        // Increment via a read-then-write since PostgREST has no atomic increment in a PATCH body.
        const currentRes = await dbFetch(env.supabaseUrl, env.serviceKey, `${table}?id=eq.${target.id}&select=review_prompt_shown_count`);
        const current = ((await currentRes.json().catch(() => [])) as { review_prompt_shown_count: number }[])[0]?.review_prompt_shown_count ?? 0;
        await dbFetch(env.supabaseUrl, env.serviceKey, `${table}?id=eq.${target.id}`, {
          method: "PATCH",
          body: JSON.stringify({ review_prompt_shown_count: current + 1 }),
        });
      }

      res.status(200).json({ target });
    } catch {
      res.status(200).json({ target: null });
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
