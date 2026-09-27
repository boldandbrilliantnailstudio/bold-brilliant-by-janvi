// Product-specific reviews (separate from the homepage Testimonials, which are studio-wide).
// Only published reviews tied to a product_id are shown here - reviews publish instantly via
// /api/submit-review, but the admin can still hide one later (Admin > Reviews > Product Reviews).
// Reviews with at least one photo are shown first (photo-first sorting), then newest first.
// "verified" is true whenever the review came through /api/submit-review's purchase check
// (order_id or product_id set on write) rather than being added manually in Admin > Reviews.
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

export type ProductReview = { id: string; name: string; rating: number; text: string; photoUrls: string[]; createdAt: string; verified: boolean };

type Row = { id: string; customer_name: string; rating: number; body: string; photo_urls: string[] | null; created_at: string; verified: boolean | null };

export function useProductReviews(productId: string) {
  const [reviews, setReviews] = useState<ProductReview[] | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setReviews([]);
      return;
    }
    setReviews(null);
    supabase
      .from("reviews")
      .select("id,customer_name,rating,body,photo_urls,created_at,verified")
      .eq("product_id", productId)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = data as Row[] | null;
        const mapped = (rows ?? []).map((r) => ({
          id: r.id,
          name: r.customer_name,
          rating: r.rating,
          text: r.body,
          photoUrls: r.photo_urls ?? [],
          createdAt: r.created_at,
          verified: r.verified ?? false,
        }));
        // Photo-first: reviews with photos before those without, newest first within each group.
        mapped.sort((a, b) => {
          const photoDiff = (b.photoUrls.length > 0 ? 1 : 0) - (a.photoUrls.length > 0 ? 1 : 0);
          return photoDiff !== 0 ? photoDiff : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        setReviews(mapped);
      });
  }, [productId]);

  return reviews;
}
