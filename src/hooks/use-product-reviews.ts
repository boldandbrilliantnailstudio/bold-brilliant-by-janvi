// Product-specific reviews (separate from the homepage Testimonials, which are studio-wide).
// Only reviews tied to a product_id are shown here - always published instantly by
// /api/submit-review, so no is_published filter is needed on the read side.
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

export type ProductReview = { id: string; name: string; rating: number; text: string; photoUrls: string[] };

type Row = { id: string; customer_name: string; rating: number; body: string; photo_urls: string[] | null };

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
      .select("id,customer_name,rating,body,photo_urls")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = data as Row[] | null;
        setReviews((rows ?? []).map((r) => ({ id: r.id, name: r.customer_name, rating: r.rating, text: r.body, photoUrls: r.photo_urls ?? [] })));
      });
  }, [productId]);

  return reviews;
}
