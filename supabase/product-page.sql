-- Run after supabase/admin-features.sql. Two additions needed for the full product page:
-- 1) Per-product slug/category/ingredients/size for the redesigned admin editor & product page
--    (each product now has its own shareable /shop/<slug> URL).
-- 2) product_id/user_id columns + policies on reviews so a signed-in customer can review a
--    specific product. The app code (src/hooks/use-product-reviews.ts,
--    src/pages/_components/write-product-review-dialog.tsx) already reads/writes these columns,
--    but they were missing from supabase/admin-features.sql, so product reviews could not be
--    saved until this runs.
-- Safe to run again.

alter table public.products
  add column if not exists slug text,
  add column if not exists category text,
  add column if not exists ingredients text,
  add column if not exists size_info text;

-- Backfill slugs for any existing products that don't have one yet (e.g. the seed data).
update public.products
set slug = lower(regexp_replace(regexp_replace(trim(name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
where slug is null or slug = '';

alter table public.products alter column slug set not null;
create unique index if not exists products_slug_key on public.products (slug);

alter table public.reviews
  add column if not exists product_id uuid references public.products (id) on delete cascade,
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

-- One review per customer per product.
create unique index if not exists reviews_product_user_key on public.reviews (product_id, user_id) where product_id is not null;
create index if not exists reviews_product_published_idx on public.reviews (product_id, is_published);

-- Signed-in customers can add their own product review (unpublished until the studio owner
-- approves it from Admin > Reviews). The unique index above stops a second review on the
-- same product.
drop policy if exists "Customers can add their own product review" on public.reviews;
create policy "Customers can add their own product review"
  on public.reviews for insert to authenticated
  with check (product_id is not null and (select auth.uid()) = user_id and is_published = false);

-- Lets a signed-in customer check whether they already reviewed a product (their own row only).
drop policy if exists "Customers can view their own review" on public.reviews;
create policy "Customers can view their own review" on public.reviews for select to authenticated
  using ((select auth.uid()) = user_id);

grant insert (customer_name, rating, body, photo_url, product_id, user_id, is_published) on public.reviews to authenticated;

-- Lets a signed-in customer upload their own "worn it" review photo. Only the public read
-- policy on site-media existed before - there was no insert policy, so this upload silently
-- failed for every customer until now.
drop policy if exists "Customers can upload their own review photos" on storage.objects;
create policy "Customers can upload their own review photos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-media'
    and (storage.foldername(name))[1] = 'review-photos'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
