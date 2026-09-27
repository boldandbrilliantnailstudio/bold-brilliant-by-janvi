// Single product looked up by its shop slug (/shop/<slug>), for the full product page.
// Returns undefined while loading, null when no active product matches the slug.
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";
import type { Product } from "./use-products.ts";

type Row = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  stock: number | null;
  sold_out: boolean;
  category: string | null;
  ingredients: string | null;
  size_info: string | null;
};

export function useProductBySlug(slug: string): Product | null | undefined {
  const [product, setProduct] = useState<Product | null | undefined>(undefined);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setProduct(null);
      return;
    }
    let active = true;
    setProduct(undefined);
    void supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle()
      .then(async ({ data }) => {
        const row = data as Row | null;
        if (!row) {
          if (active) setProduct(null);
          return;
        }
        const { data: imageRows } = await supabase!
          .from("product_images")
          .select("image_url")
          .eq("product_id", row.id)
          .order("sort_order", { ascending: true });
        const extra = ((imageRows as { image_url: string }[] | null) ?? []).map((i) => i.image_url);
        if (!active) return;
        setProduct({
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: row.description,
          price: row.price,
          compareAtPrice: row.compare_at_price,
          imageUrl: row.image_url,
          images: [row.image_url, ...extra].filter((url): url is string => !!url),
          stock: row.stock,
          soldOut: row.sold_out,
          category: row.category,
          ingredients: row.ingredients,
          sizeInfo: row.size_info,
        });
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return product;
}
