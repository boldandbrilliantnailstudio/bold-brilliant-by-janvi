-- Custom set options shown in Shop > Custom Sets, managed from Admin > Custom Sets.
-- Run in the Supabase SQL editor AFTER schema.sql. Safe to run again.

create table if not exists public.custom_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 60),
  price_label text not null default '' check (length(price_label) <= 40),
  description text not null default '' check (length(description) <= 300),
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists custom_sets_updated_at on public.custom_sets;
create trigger custom_sets_updated_at before update on public.custom_sets
  for each row execute function public.set_updated_at();

alter table public.custom_sets enable row level security;
drop policy if exists "Public can view active custom sets" on public.custom_sets;
create policy "Public can view active custom sets" on public.custom_sets
  for select to anon, authenticated using (is_active = true);
grant select on public.custom_sets to anon, authenticated;
grant all on public.custom_sets to service_role;

-- Starting options (only inserted when the table is empty).
insert into public.custom_sets (name, price_label, description, sort_order)
select * from (values
  ('Custom Everyday Set', 'Starts at ₹699', 'Your choice of shape, length and 1-2 colours.', 1),
  ('Custom 3D / Charm Set', 'Starts at ₹1,299', 'Hand-placed charms, chrome, or 3D detailing.', 2),
  ('Custom Bridal Set', 'Starts at ₹1,999', 'Fully personalised bridal design with trial option.', 3)
) as s(name, price_label, description, sort_order)
where not exists (select 1 from public.custom_sets);
