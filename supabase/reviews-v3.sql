-- Run after supabase/reviews-v2.sql. Two additions for Hissa 4:
-- 1) service_name: so a studio review written after a completed booking can show which
--    service it was about (e.g. "Gel Extensions") on the homepage Testimonials section.
-- 2) verified: true only for reviews that came through /api/submit-review's purchase/visit
--    check (order_id, booking_id, or product_id was set at insert time). Reviews added
--    manually from Admin > Reviews default to false, since there's no purchase to verify.
--    Shown as a "Verified Buyer" badge on the product page.
-- Safe to run again.

alter table public.reviews
  add column if not exists service_name text,
  add column if not exists verified boolean not null default false;

-- Backfill any existing booking-linked reviews that predate service_name.
update public.reviews r
set service_name = b.service
from public.bookings b
where r.booking_id = b.id and r.service_name is null;

-- Backfill verified for existing reviews that are clearly tied to a real purchase/visit
-- (product_id, order_id, or booking_id set) but were inserted before this column existed.
update public.reviews
set verified = true
where verified = false and (product_id is not null or order_id is not null or booking_id is not null);

-- Admin-added reviews (/api/admin resource=reviews) can also set service_name and verified
-- directly, so the studio owner can tag or verify a manually-entered review if needed.
