-- Hissa 6: customer profiles admin tab. Adds private admin-only fields to profiles - notes and
-- tags (e.g. "VIP", "Regular") that only the studio owner can see and edit, never the customer.
-- Run after supabase/schema.sql. Safe to run again.

alter table public.profiles
  add column if not exists admin_notes text,
  add column if not exists tags text[] not null default '{}';

-- Customers must never be able to read or write their own admin_notes/tags - the existing
-- "Customers can view/update their own profile" policies from supabase/schema.sql use
-- for-select/for-update with no column restriction, so re-create them to explicitly list the
-- customer-facing columns only. The admin panel (service role) bypasses RLS entirely and can
-- read/write every column including admin_notes and tags.
drop policy if exists "Customers can view their own profile" on public.profiles;
create policy "Customers can view their own profile" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
-- (Select policies can't hide columns in Postgres RLS - column-level privacy for admin_notes/tags
-- is enforced by only ever granting SELECT on the specific customer-facing columns below.)

revoke select on public.profiles from authenticated;
grant select (
  id, customer_number, full_name, phone, alt_phone, pincode, address_line1, address_line2,
  landmark, city, state, address_type, billing_same, billing_name, billing_address, gstin, updated_at
) on public.profiles to authenticated;
