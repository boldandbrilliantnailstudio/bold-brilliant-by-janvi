-- Reviews rework (Hissa 4). Run after supabase/product-page.sql. Safe to run again.
--
-- WHAT CHANGES
-- 1) Up to 3 photos per review (photo_urls), instead of just one.
-- 2) order_id / booking_id columns so a studio review can be tied to the delivered order or
--    completed booking it came from. order_id was referenced by src/pages/_components/
--    write-review-dialog.tsx and src/pages/_components/my-orders.tsx already, but - like
--    product_id before supabase/product-page.sql - the column never actually existed, so every
--    "Write a Review" submission from My Orders was silently failing until this runs.
-- 3) Reviews now publish instantly (no admin approval wait) - customers can only write one in
--    the first place because /api/submit-review checks they actually have a Delivered order or
--    Completed booking for it (or, for a product review, a Delivered order that contains that
--    product) before it ever reaches this table. Direct inserts from the browser are removed;
--    only /api/submit-review (service role) and the admin panel can write here now.
-- 4) 1-2 star reviews trigger a Telegram alert to the studio owner (api/submit-review.ts).

alter table public.reviews
  add column if not exists photo_urls text[] not null default '{}',
  add column if not exists order_id uuid references public.orders (id) on delete cascade,
  add column if not exists booking_id uuid references public.bookings (id) on delete cascade;

alter table public.reviews add constraint reviews_photo_urls_max3
  check (array_length(photo_urls, 1) is null or array_length(photo_urls, 1) <= 3);

-- Carry any existing single photo_url into the new array so old reviews still show their photo.
update public.reviews set photo_urls = array[photo_url] where photo_url is not null and photo_urls = '{}';

-- Instant publish going forward - existing rows keep whatever value they already had.
alter table public.reviews alter column is_published set default true;

-- One review per delivered order / completed booking, same idea as the one-per-product index.
create unique index if not exists reviews_order_key on public.reviews (order_id) where order_id is not null;
create unique index if not exists reviews_booking_key on public.reviews (booking_id) where booking_id is not null;

-- Only one of product_id / order_id / booking_id may be set per review (a review is about one
-- specific product, one specific studio order, or one specific studio visit - never more than one).
alter table public.reviews add constraint reviews_single_target check (
  (case when product_id is not null then 1 else 0 end)
  + (case when order_id is not null then 1 else 0 end)
  + (case when booking_id is not null then 1 else 0 end) <= 1
);

-- Reviews are now written only by /api/submit-review (server, service role) after it has
-- verified the purchase/visit, or by the admin panel. Remove the old direct-insert policies -
-- letting a signed-in browser insert straight into this table made it impossible to check
-- "did this customer actually buy/visit" and skipped the Telegram alert on a bad review.
drop policy if exists "Customers can add their own product review" on public.reviews;
drop policy if exists "Customers can add their own order review" on public.reviews;
revoke insert on public.reviews from authenticated;

-- Customers can still check whether they already reviewed something (their own rows only) -
-- used by the product page and My Orders/My Bookings to show "You reviewed this" instead of
-- the form again.
drop policy if exists "Customers can view their own review" on public.reviews;
create policy "Customers can view their own review" on public.reviews for select to authenticated
  using ((select auth.uid()) = user_id);

-- My Bookings (src/pages/_components/my-bookings.tsx) needs to show the signed-in customer's
-- own bookings, so they can write a studio review after a Completed appointment. Bookings had
-- no customer-facing read policy before (admin/service-role only) - this adds one for just the
-- customer's own rows.
drop policy if exists "Customers can view their own bookings" on public.bookings;
create policy "Customers can view their own bookings" on public.bookings for select to authenticated
  using ((select auth.uid()) = user_id);
grant select on public.bookings to authenticated;
