// Product-specific reviews (separate from the homepage Testimonials, which are studio-wide).
// Only reviews tied to a product_id are shown here - always published instantly by
// /api/submit-review, so no is_published filter is needed on the read side. Reviews with at
// least one photo are shown first (photo-first sorting), then newest first within each group.
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

export type ProductReview = { id: string; name: string; rating: number; text: string; photoUrls: string[]; createdAt: string };

type Row = { id: string; customer_name: string; rating: number; body: string; photo_urls: string[] | null; created_at: string };

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
      .select("id,customer_name,rating,body,photo_urls,created_at")
      .eq("product_id", productId)
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
