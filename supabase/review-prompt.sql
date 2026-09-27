-- Hissa 5: review nudge popup. After an order is Delivered or a booking is Completed, the
-- customer sees a "please review" popup the next time they visit - up to 2 times total, and
-- never again once they've actually written the review. Run after supabase/reviews-v2.sql.
-- Safe to run again.

alter table public.orders
  add column if not exists review_prompt_shown_count integer not null default 0;
alter table public.bookings
  add column if not exists review_prompt_shown_count integer not null default 0;

-- /api/review-prompt (service role) reads the customer's own Delivered orders / Completed
-- bookings to find one to nudge about, then increments the shown count. It authenticates the
-- customer itself (getUserId), so no new customer-facing RLS policy is needed here - orders and
-- bookings already have "view own rows" policies from supabase/schema.sql and reviews-v2.sql.
