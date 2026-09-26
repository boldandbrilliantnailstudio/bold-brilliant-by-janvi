// Custom set options for Shop > Custom Sets (admin-managed in Admin > Custom Sets). Only active
// ones reach the browser thanks to the "Public can view active custom sets" RLS policy.
import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";

export type CustomSet = { id: string; name: string; priceLabel: string; description: string; imageUrl: string | null };

type Row = { id: string; name: string; price_label: string; description: string; image_url: string | null };

export function useCustomSets() {
  const [sets, setSets] = useState<CustomSet[] | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setSets([]);
      return;
    }
    supabase
      .from("custom_sets")
      .select("id,name,price_label,description,image_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) =>
        setSets(
          ((data as Row[] | null) ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            priceLabel: r.price_label,
            description: r.description,
            imageUrl: r.image_url,
          })),
        ),
      );
  }, []);

  return sets;
}
