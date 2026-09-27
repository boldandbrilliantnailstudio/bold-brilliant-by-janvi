// Loads bookable services and booking settings (public read) for the booking form, plus the
// free slots for a chosen date from /api/booking.
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase.ts";

export type PublicService = {
  id: string;
  name: string;
  price: number | null;
  duration_minutes: number;
  image_url: string | null;
  allow_home_visit: boolean;
  show_price: boolean;
};

type PriceSettings = { show_prices: boolean; hidden_price_text: string };

export function useBookingServices() {
  const [services, setServices] = useState<PublicService[] | null>(null);
  const [price, setPrice] = useState<PriceSettings>({ show_prices: true, hidden_price_text: "Price on request" });

  useEffect(() => {
    if (!supabase) {
      setServices([]);
      return;
    }
    void supabase
      .from("services")
      .select("id,name,price,duration_minutes,image_url,allow_home_visit,show_price")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setServices((data as PublicService[] | null) ?? []));
    void supabase
      .from("booking_settings")
      .select("show_prices,hidden_price_text")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => data && setPrice(data as PriceSettings));
  }, []);

  // Price text for a service: the real price, or the admin's "hidden" text.
  const priceLabel = (s: PublicService) =>
    price.show_prices && s.show_price && s.price != null ? `₹${s.price.toLocaleString("en-IN")}` : price.hidden_price_text;

  return { services, priceLabel };
}

export function useFreeSlots(date: string) {
  const [slots, setSlots] = useState<string[] | null>(null);
  useEffect(() => {
    if (!date) {
      setSlots(null);
      return;
    }
    let cancelled = false;
    setSlots(null);
    void fetch(`/api/booking?date=${date}`)
      .then((r) => r.json())
      .then((d: { slots?: string[] }) => !cancelled && setSlots(d.slots ?? []))
      .catch(() => !cancelled && setSlots([]));
    return () => {
      cancelled = true;
    };
  }, [date]);
  return slots;
}
