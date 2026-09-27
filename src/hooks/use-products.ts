// Live shop products from the database (admin-managed). Only active products are visible here
// thanks to the "Public can view active products" RLS policy - sold out / hidden ones never
// reach the browser unless the admin explicitly marked them active. Each product's extra photos
// (from product_images, managed in Admin > Shop) are attached as `images`, main photo first.
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  images: string[];
  stock: number | null;
  soldOut: boolean;
  category: string | null;
  ingredients: string | null;
  sizeInfo: string | null;
};

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

type ImageRow = { product_id: string; image_url: string };

export function useProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setProducts([]);
      return;
    }
    void Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
      supabase.from("product_images").select("product_id,image_url").order("sort_order", { ascending: true }),
    ]).then(([productsRes, imagesRes]) => {
      const rows = (productsRes.data as Row[] | null) ?? [];
      const imageRows = (imagesRes.data as ImageRow[] | null) ?? [];
      setProducts(
        rows.map((r) => {
          const extra = imageRows.filter((img) => img.product_id === r.id).map((img) => img.image_url);
          return {
            id: r.id,
            slug: r.slug,
            name: r.name,
            description: r.description,
            price: r.price,
            compareAtPrice: r.compare_at_price,
            imageUrl: r.image_url,
            images: [r.image_url, ...extra].filter((url): url is string => !!url),
            stock: r.stock,
            soldOut: r.sold_out,
            category: r.category,
            ingredients: r.ingredients,
            sizeInfo: r.size_info,
          };
        }),
      );
    });
  }, []);

  return products;
}
