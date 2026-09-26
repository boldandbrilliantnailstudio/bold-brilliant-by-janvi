-- Custom set requests (Shop > Custom Sets). Run in the Supabase SQL editor AFTER schema.sql and
-- admin-features.sql. Safe to run again.
--
-- Customers submit through /api/custom-request (server, service role key). The admin panel reads
-- and updates through /api/admin?resource=custom_requests. No public access on purpose.

create table if not exists public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity (start with 1001) unique,
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (length(name) between 2 and 80),
  whatsapp text not null check (whatsapp ~ '^\+?[0-9\s-]{10,15}$'),
  email text check (email is null or length(email) <= 120),
  set_name text not null check (length(set_name) <= 60),
  details text not null check (length(details) between 5 and 1000),
  reference_url text,
  status text not null default 'New' check (status in ('New','Replied','Done','Cancelled')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists custom_requests_created_idx on public.custom_requests (created_at desc);

drop trigger if exists custom_requests_updated_at on public.custom_requests;
create trigger custom_requests_updated_at before update on public.custom_requests
  for each row execute function public.set_updated_at();

alter table public.custom_requests enable row level security;
revoke all on public.custom_requests from anon, authenticated;
grant all on public.custom_requests to service_role;
