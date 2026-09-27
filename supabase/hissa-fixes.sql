-- Hissa 6-8 fixes. Run after all previous supabase/*.sql files. Safe to run again.
--
-- 1) Customer search by email needs no schema change (email lives in auth.users, looked up
--    live via the Admin API in api/admin-customers.ts) - nothing to add here for that.
--
-- 2) Personal coupon start date/time: coupons.starts_at already exists (supabase/admin-features.sql).
--    Nothing to add - the "Send Coupon" dialog just needed to expose the existing column.
--
-- 3) Booking coupon marked used only when Completed: no schema change, just application logic
--    (api/booking.ts no longer inserts coupon_redemptions at creation time; api/admin.ts inserts
--    it when a booking's status is set to "Completed" instead).
--
-- 4) Sender address picker: lets the admin choose which verified "from" address an email goes
--    out from (e.g. support@ vs offers@), per automatic email template.
alter table public.site_settings
  add column if not exists sender_addresses jsonb not null default '[]'::jsonb;
alter table public.email_templates
  add column if not exists from_address text;

-- 5) Unsubscribe: customers can opt out of promotional/ad-hoc emails (Admin > Customers > Send
--    Message). Automatic order/booking emails are transactional and always still send.
alter table public.profiles
  add column if not exists marketing_opt_out boolean not null default false;
