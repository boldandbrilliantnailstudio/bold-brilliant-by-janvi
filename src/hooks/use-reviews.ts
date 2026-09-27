// Live customer reviews for the homepage Testimonials, fully managed from Admin > Reviews.
// Excludes product-specific reviews (product_id set) - those show on their own product page
// instead (see use-product-reviews.ts), so the same review isn't shown twice.
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

export type Review = { id: string; name: string; rating: number; text: string; photoUrl: string | null };

export function useReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    supabase
      .from("reviews")
      .select("id,customer_name,rating,body,photo_url")
      .eq("is_published", true)
      .is("product_id", null)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        const rows = data as { id: string; customer_name: string; rating: number; body: string; photo_url: string | null }[] | null;
        setReviews((rows ?? []).map((r) => ({ id: r.id, name: r.customer_name, rating: r.rating, text: r.body, photoUrl: r.photo_url })));
      });
  }, []);

  return reviews;
}
