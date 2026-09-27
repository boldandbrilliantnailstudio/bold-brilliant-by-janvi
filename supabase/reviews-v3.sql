-- Run after supabase/reviews-v2.sql. Adds a service_name column so a studio review
-- written after a completed booking can show which service it was about (e.g. "Gel
-- Extensions") on the homepage Testimonials section. Safe to run again.

alter table public.reviews
  add column if not exists service_name text;

-- Backfill any existing booking-linked reviews that predate this column.
update public.reviews r
set service_name = b.service
from public.bookings b
where r.booking_id = b.id and r.service_name is null;

-- Admin-added reviews (/api/admin resource=reviews) can also set a service name
-- directly, so the studio owner can tag a manually-entered review with a service too.
