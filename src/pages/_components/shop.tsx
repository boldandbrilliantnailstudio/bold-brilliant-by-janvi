import { useState } from "react";
import { MessageSquareText, ShoppingBasket, Sparkles, Truck } from "lucide-react";
import { toast } from "sonner";
import Reveal, { SectionHeading } from "@/components/reveal.tsx";
import { useSiteSettings } from "@/hooks/use-site-settings.tsx";
import { useProducts, type Product } from "@/hooks/use-products.ts";
import { useCustomSets } from "@/hooks/use-custom-sets.ts";
import { useCart } from "@/hooks/use-cart.tsx";
import type { CheckoutOrder } from "@/lib/catalog.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import CheckoutDialog from "./checkout-dialog.tsx";
import CustomRequestDialog from "./custom-request-dialog.tsx";
import PromoBanner from "./promo-banner.tsx";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1610992015762-45dca7fa3a85?fm=webp&q=70&fit=crop&w=500&h=625";

function CustomSetsGrid({ onRequest }: { onRequest: (name: string) => void }) {
  const sets = useCustomSets();
  if (sets === null) {
    return (
      <div className="grid gap-5 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-3xl" />
        ))}
      </div>
    );
  }
  if (sets.length === 0) {
    return <p className="text-center text-sm text-muted-foreground">Custom sets are coming soon. Please check back later.</p>;
  }
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {sets.map((s, i) => (
        <Reveal key={s.id} delay={i * 0.08}>
          <div className="flex h-full flex-col overflow-hidden rounded-3xl border bg-card/70 backdrop-blur transition-all duration-500 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
            {s.imageUrl && <img src={s.imageUrl} alt={s.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />}
            <div className="flex flex-1 flex-col p-6">
              {!s.imageUrl && (
                <div className="mb-5 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="size-6" />
                </div>
              )}
              <h3 className="font-serif text-2xl">{s.name}</h3>
              {s.priceLabel && <p className="pt-1 text-sm font-medium text-primary">{s.priceLabel}</p>}
              <p className="flex-1 pt-2 text-sm text-muted-foreground">{s.description}</p>
              <button
                onClick={() => onRequest(s.name)}
                className="mt-5 inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                <MessageSquareText className="size-4" /> Request This Design
              </button>
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

export default function Shop() {
  const [tab, setTab] = useState<"ready" | "custom">("ready");
  const [checkout, setCheckout] = useState<CheckoutOrder | null>(null);
  const [customSet, setCustomSet] = useState<string | null>(null);
  const { add } = useCart();
  const products = useProducts();
  const settings = useSiteSettings();

  const addToBasket = (p: Product) => {
    if (p.soldOut) return;
    add({ name: p.name, price: p.price, img: p.imageUrl ?? FALLBACK_IMG });
    toast.success(`${p.name} added to your basket`);
  };

  const buyNow = (p: Product) => {
    if (p.soldOut) return;
    setCheckout({ items: [{ name: p.name, qty: 1, price: p.price, img: p.imageUrl ?? FALLBACK_IMG }], title: p.name, total: p.price });
  };

  return (
    <section id="shop" className="px-5 py-16 md:py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Shop" title="Shop Press-Ons" sub="Reusable press-on nail sets, hand-painted in our Rajkot studio and shipped to your door." />

        <PromoBanner placement="shop" className="mx-auto mb-8 max-w-xl" />

        <Reveal>
          <div className="mx-auto mb-10 flex w-fit items-center gap-2 rounded-full border bg-card p-1.5">
            <button onClick={() => setTab("ready")} className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${tab === "ready" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}>
              Ready-to-Shop Sets
            </button>
            <button onClick={() => setTab("custom")} className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${tab === "custom" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}>
              Custom Sets
            </button>
          </div>
        </Reveal>

        {tab === "ready" ? (
          products === null ? (
            <div className="mx-auto grid max-w-md grid-cols-1 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] w-full rounded-3xl" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No nail sets available right now. Please check back soon.</p>
          ) : (
            <div className="mx-auto grid max-w-md grid-cols-1 gap-6">
              {products.map((p, i) => (
                <Reveal key={p.id} delay={i * 0.06}>
                  <div className="group relative overflow-hidden rounded-3xl border bg-card/70 backdrop-blur transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10">
                    <a
                      href={`/shop/${p.slug}`}
                      aria-label={`View ${p.name} details`}
                      className="relative block aspect-square w-full cursor-pointer overflow-hidden bg-muted"
                    >
                      <img src={p.imageUrl ?? FALLBACK_IMG} alt={`${p.name} press-on nail set`} loading="lazy" className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-110 ${p.soldOut ? "opacity-50" : ""}`} />
                      {p.soldOut && (
                        <span className="absolute left-3 top-3 rounded-full bg-foreground px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-background">
                          Sold Out
                        </span>
                      )}
                    </a>
                    <div className="p-4">
                      <a href={`/shop/${p.slug}`} className="text-left">
                        <h3 className="font-serif text-lg leading-tight hover:underline">{p.name}</h3>
                      </a>
                      <p className="pt-1 text-sm font-medium text-primary">
                        ₹{p.price}
                        {p.compareAtPrice && p.compareAtPrice > p.price && (
                          <span className="ml-2 text-xs text-muted-foreground line-through">₹{p.compareAtPrice}</span>
                        )}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => buyNow(p)}
                          disabled={p.soldOut}
                          className="inline-flex flex-1 items-center justify-center rounded-full bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                        >
                          {p.soldOut ? "Sold Out" : "Buy Now"}
                        </button>
                        <button
                          aria-label={`Add ${p.name} to basket`}
                          title="Add to basket"
                          onClick={() => addToBasket(p)}
                          disabled={p.soldOut}
                          className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ShoppingBasket className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          )
        ) : (
          <CustomSetsGrid onRequest={setCustomSet} />
        )}

        <Reveal delay={0.1}>
          <div className="mx-auto mt-10 flex max-w-xl flex-col items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-6 py-4 text-center sm:flex-row sm:justify-center">
            <Truck className="size-5 text-primary" />
            <p className="text-sm font-medium">{settings.deliveryNote}</p>
          </div>
        </Reveal>
      </div>

      {checkout && <CheckoutDialog order={checkout} onClose={() => setCheckout(null)} />}
      {customSet && <CustomRequestDialog setName={customSet} onClose={() => setCustomSet(null)} />}
    </section>
  );
}
