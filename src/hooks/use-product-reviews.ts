// Product-specific reviews (separate from the homepage Testimonials, which are studio-wide).
// Only approved (is_published = true) reviews tied to a product_id are shown here.
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

export type ProductReview = { id: string; name: string; rating: number; text: string; photoUrl: string | null };

type Row = { id: string; customer_name: string; rating: number; body: string; photo_url: string | null };

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
      .select("id,customer_name,rating,body,photo_url")
      .eq("product_id", productId)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const rows = data as Row[] | null;
        setReviews((rows ?? []).map((r) => ({ id: r.id, name: r.customer_name, rating: r.rating, text: r.body, photoUrl: r.photo_url })));
      });
  }, [productId]);

  return reviews;
}
