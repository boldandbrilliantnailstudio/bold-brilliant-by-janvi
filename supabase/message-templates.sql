-- Hissa 8: reusable message templates (email + WhatsApp) the studio owner can write once and
-- reuse when messaging a specific customer from Admin > Customers, plus a log of what was sent
-- to whom. Separate from the fixed automatic email_templates (order/booking confirmations) -
-- those are unchanged. Run after supabase/personal-coupons.sql. Safe to run again.

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'whatsapp')),
  name text not null,
  subject text, -- email only, null for whatsapp
  body text not null, -- HTML for email, plain text for whatsapp. Supports {{name}}, {{coupon}}
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists message_templates_channel_idx on public.message_templates (channel, sort_order);

alter table public.message_templates enable row level security;
revoke all on public.message_templates from anon, authenticated;
grant all on public.message_templates to service_role;

-- A record of every ad-hoc message an admin sent to a customer, so the studio can see who was
-- messaged, when, and with what - never shown to the customer, admin-only history.
create table if not exists public.admin_send_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  subject text,
  body text not null,
  sent_at timestamptz not null default now()
);
create index if not exists admin_send_log_user_idx on public.admin_send_log (user_id, sent_at desc);

alter table public.admin_send_log enable row level security;
revoke all on public.admin_send_log from anon, authenticated;
grant all on public.admin_send_log to service_role;

-- A couple of starter templates so the library isn't empty on first use.
insert into public.message_templates (channel, name, subject, body, sort_order)
select 'email', 'Personal discount', 'A little something for you, {{name}}!',
  '<p>Hi {{name}},</p><p>Here''s a coupon just for you: <strong>{{coupon}}</strong></p><p>Use it on your next order or booking. See you soon!</p>', 0
where not exists (select 1 from public.message_templates where name = 'Personal discount');

insert into public.message_templates (channel, name, subject, body, sort_order)
select 'whatsapp', 'Personal discount', null,
  'Hi {{name}}! Here''s a coupon just for you: {{coupon}}. Use it on your next order or booking. See you soon!', 0
where not exists (select 1 from public.message_templates where name = 'Personal discount' and channel = 'whatsapp');

insert into public.message_templates (channel, name, subject, body, sort_order)
select 'whatsapp', 'We miss you', null,
  'Hi {{name}}, it''s been a while! We''d love to see you again for your next nail appointment. Reply here to book a slot.', 1
where not exists (select 1 from public.message_templates where name = 'We miss you' and channel = 'whatsapp');
