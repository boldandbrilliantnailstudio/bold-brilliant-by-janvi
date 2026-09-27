-- Hissa 7: personal (per-customer) coupons. Extends the existing general coupon system
-- (supabase/admin-features.sql) rather than replacing it - a coupon with user_id set can only
-- ever be redeemed by that one customer; user_id null keeps working exactly as before (a
-- public/general code anyone can use, subject to per_user_limit as today).
-- Run after supabase/admin-features.sql. Safe to run again.

alter table public.coupons
  add column if not exists user_id uuid references auth.users (id) on delete cascade,
  add column if not exists scope text not null default 'both' check (scope in ('shop', 'booking', 'both'));
create index if not exists coupons_user_idx on public.coupons (user_id) where user_id is not null;

-- Coupon Settings: defaults the "New Coupon" and "Send Coupon" forms start from, so the studio
-- owner doesn't have to re-type the same discount/expiry every time. Singleton row (id=1).
create table if not exists public.coupon_settings (
  id integer primary key default 1 check (id = 1),
  default_discount_type text not null default 'percent' check (default_discount_type in ('percent', 'flat')),
  default_discount_value numeric(10,2) not null default 10 check (default_discount_value > 0),
  default_scope text not null default 'both' check (default_scope in ('shop', 'booking', 'both')),
  default_validity_days integer not null default 7 check (default_validity_days > 0),
  updated_at timestamptz not null default now()
);
insert into public.coupon_settings (id) values (1) on conflict (id) do nothing;
drop trigger if exists coupon_settings_updated_at on public.coupon_settings;
create trigger coupon_settings_updated_at before update on public.coupon_settings
  for each row execute function public.set_updated_at();

alter table public.coupon_settings enable row level security;
revoke all on public.coupon_settings from anon, authenticated;
grant all on public.coupon_settings to service_role;

-- Bookings don't take online payment, but a personal coupon can still be redeemed against one
-- (recorded here for "one-time per customer" enforcement) - shown to the studio as a discount
-- to apply manually/at the door. Exactly one of order_id/booking_id must be set per redemption.
alter table public.coupon_redemptions
  alter column order_id drop not null,
  add column if not exists booking_id uuid references public.bookings (id) on delete cascade;
create unique index if not exists coupon_redemptions_booking_key on public.coupon_redemptions (booking_id) where booking_id is not null;
alter table public.coupon_redemptions add constraint coupon_redemptions_one_target check (
  (case when order_id is not null then 1 else 0 end) + (case when booking_id is not null then 1 else 0 end) = 1
);

alter table public.bookings
  add column if not exists coupon_code text,
  add column if not exists discount_note text;
