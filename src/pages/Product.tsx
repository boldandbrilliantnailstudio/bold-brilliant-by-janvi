// Full product page - its own URL (/shop/<slug>), shareable on WhatsApp etc. (see api/shop-meta.ts
// for the link preview). Big swipeable + zoomable photo gallery up top, full description in the
// middle, and this product's own reviews at the bottom (separate from the homepage Testimonials).
import { useEffect, useState } from "react";
import { ShoppingBasket, Star, X, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import Header from "./_components/header.tsx";
import Footer from "./_components/footer.tsx";
import BackToTop from "./_components/back-to-top.tsx";
import BottomNav from "./_components/bottom-nav.tsx";
import PromoBanner from "./_components/promo-banner.tsx";
import CheckoutDialog from "./_components/checkout-dialog.tsx";
import WriteProductReviewDialog from "./_components/write-product-review-dialog.tsx";
import Carousel from "@/components/carousel.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { useProductBySlug } from "@/hooks/use-product-by-slug.ts";
import { useProductReviews } from "@/hooks/use-product-reviews.ts";
import { useCart } from "@/hooks/use-cart.tsx";
import { useCustomerAuth } from "@/hooks/use-customer-auth.ts";
import { useProfile } from "@/hooks/use-profile.ts";
import { supabase } from "@/lib/supabase.ts";
import type { Product } from "@/hooks/use-products.ts";
import type { CheckoutOrder } from "@/lib/catalog.ts";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1610992015762-45dca7fa3a85?fm=webp&q=70&fit=crop&w=500&h=625";

// Full-screen zoomed view of one photo. Swiping/arrow-clicking moves to the next photo too, so
// the visitor never has to close and reopen to see the rest of the gallery.
function ZoomDialog({ images, index, onClose }: { images: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">Photo {i + 1}</DialogTitle>
        <button
          onClick={onClose}
          aria-label="Close zoomed photo"
          className="absolute -top-3 right-0 z-10 grid size-9 place-items-center rounded-full bg-background text-foreground shadow-lg"
        >
          <X className="size-4" />
        </button>
        <Carousel itemClassName="w-full">
          {images.map((src, j) => (
            <img key={j} src={src} alt={`Photo ${j + 1}`} onLoad={() => setI(j)} className="max-h-[85vh] w-full rounded-2xl object-contain" />
          ))}
        </Carousel>
      </DialogContent>
    </Dialog>
  );
}

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const shown = images.length > 0 ? images : [FALLBACK_IMG];

  return (
    <>
      <div className="relative">
        {shown.length > 1 ? (
          <Carousel itemClassName="w-full">
            {shown.map((src, i) => (
              <button key={i} onClick={() => setZoomIndex(i)} className="block aspect-square w-full cursor-zoom-in overflow-hidden rounded-3xl bg-muted">
                <img src={src} alt={`${name} photo ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </Carousel>
        ) : (
          <button onClick={() => setZoomIndex(0)} className="block aspect-square w-full cursor-zoom-in overflow-hidden rounded-3xl bg-muted">
            <img src={shown[0]} alt={name} className="h-full w-full object-cover" />
          </button>
        )}
        <span className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
          <ZoomIn className="size-3.5" /> Tap to zoom
        </span>
      </div>
      {zoomIndex !== null && <ZoomDialog images={shown} index={zoomIndex} onClose={() => setZoomIndex(null)} />}
    </>
  );
}

// Small average-rating line shown right under the product title, above the price.
function ProductRatingSummary({ productId }: { productId: string }) {
  const reviews = useProductReviews(productId);
  if (!reviews || reviews.length === 0) return null;
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return (
    <div className="flex items-center gap-1.5 pt-2">
      <div className="flex gap-0.5 text-primary">
        {Array.from({ length: 5 }).map((_, j) => (
          <Star key={j} className="size-4" fill={j < Math.round(avg) ? "currentColor" : "none"} />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        {avg.toFixed(1)} ({reviews.length} review{reviews.length === 1 ? "" : "s"})
      </span>
    </div>
  );
}

function ReviewsSection({ product }: { product: Product }) {
  const { user, isSignedIn } = useCustomerAuth();
  const { profile, openProfile } = useProfile();
  const reviews = useProductReviews(product.id);
  const [writing, setWriting] = useState(false);
  const [myReviewStatus, setMyReviewStatus] = useState<"none" | "pending" | "published">("none");

  useEffect(() => {
    if (!supabase || !user) {
      setMyReviewStatus("none");
      return;
    }
    supabase
      .from("reviews")
      .select("is_published")
      .eq("product_id", product.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { is_published: boolean } | null;
        setMyReviewStatus(row ? (row.is_published ? "published" : "pending") : "none");
      });
  }, [product.id, user]);

  const avgRating = reviews && reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  const startReview = () => {
    if (!isSignedIn) {
      openProfile();
      return;
    }
    setWriting(true);
  };

  return (
    <>
      <div className="border-t pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl">Customer Reviews</h2>
            {avgRating !== null && (
              <div className="flex items-center gap-1.5 pt-1">
                <div className="flex gap-0.5 text-primary">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="size-4" fill={j < Math.round(avgRating) ? "currentColor" : "none"} />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">
                  {avgRating.toFixed(1)} ({reviews?.length} review{reviews?.length === 1 ? "" : "s"})
                </span>
              </div>
            )}
          </div>
          {myReviewStatus === "none" ? (
            <button onClick={startReview} className="text-sm font-medium text-primary hover:underline">
              Write a Review
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {myReviewStatus === "pending" ? "Your review is awaiting approval" : "You reviewed this"}
            </span>
          )}
        </div>

        <div className="pt-5">
          {reviews === null ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet. Be the first to share your experience!</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl border bg-card/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{r.name}</p>
                    <div className="flex gap-0.5 text-primary">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star key={j} className="size-3.5" fill={j < r.rating ? "currentColor" : "none"} />
                      ))}
                    </div>
                  </div>
                  <p className="pt-1.5 text-sm text-muted-foreground">{r.text}</p>
                  {r.photoUrl && <img src={r.photoUrl} alt={`${r.name}'s photo`} className="mt-2 h-28 w-28 rounded-xl object-cover" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {writing && user && (
        <WriteProductReviewDialog
          open
          onClose={() => setWriting(false)}
          productId={product.id}
          productName={product.name}
          customerName={profile?.fullName ?? user.email ?? "Customer"}
          userId={user.id}
          onSubmitted={() => {
            setWriting(false);
            setMyReviewStatus("pending");
          }}
        />
      )}
    </>
  );
}

export default function ProductPage({ slug }: { slug: string }) {
  const product = useProductBySlug(slug);
  const { add } = useCart();
  const [checkout, setCheckout] = useState<CheckoutOrder | null>(null);

  const addToBasket = () => {
    if (!product || product.soldOut) return;
    add({ name: product.name, price: product.price, img: product.imageUrl ?? FALLBACK_IMG });
    toast.success(`${product.name} added to your basket`);
  };

  const buyNow = () => {
    if (!product || product.soldOut) return;
    setCheckout({ items: [{ name: product.name, qty: 1, price: product.price, img: product.imageUrl ?? FALLBACK_IMG }], title: product.name, total: product.price });
  };

  return (
    <>
      <PromoBanner placement="top_bar" className="rounded-none" />
      <Header />
      <main className="pb-16 pt-24 md:pb-0 md:pt-28">
        <div className="mx-auto max-w-4xl px-5 py-10">
          {product === undefined ? (
            <div className="grid gap-8 md:grid-cols-2">
              <Skeleton className="aspect-square w-full rounded-3xl" />
              <div className="space-y-3 pt-2">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          ) : product === null ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShoppingBasket />
                </EmptyMedia>
                <EmptyTitle>Product not found</EmptyTitle>
                <EmptyDescription>This nail set may have been removed or is no longer available.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <a href="/shop" className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground">
                  Back to Shop
                </a>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="space-y-10">
              <div className="grid gap-8 md:grid-cols-2 md:gap-10">
                <Gallery images={product.images} name={product.name} />

                <div className="flex flex-col">
                  {product.category && <p className="pb-1.5 text-xs font-medium uppercase tracking-[0.2em] text-primary">{product.category}</p>}
                  <h1 className="font-serif text-3xl font-semibold leading-tight text-balance">{product.name}</h1>

                  <ProductRatingSummary productId={product.id} />

                  <p className="pt-3 text-2xl font-medium text-primary">
                    ₹{product.price}
                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                      <span className="ml-2 text-base text-muted-foreground line-through">₹{product.compareAtPrice}</span>
                    )}
                  </p>

                  {product.soldOut && (
                    <span className="mt-3 inline-flex w-fit rounded-full bg-foreground px-3 py-1 text-xs font-semibold uppercase tracking-wide text-background">
                      Sold Out
                    </span>
                  )}

                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={buyNow}
                      disabled={product.soldOut}
                      className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                    >
                      {product.soldOut ? "Sold Out" : "Buy Now"}
                    </button>
                    <button
                      aria-label="Add to basket"
                      title="Add to basket"
                      onClick={addToBasket}
                      disabled={product.soldOut}
                      className="grid size-12 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShoppingBasket className="size-5" />
                    </button>
                  </div>

                  {(product.ingredients || product.sizeInfo) && (
                    <dl className="mt-6 grid gap-2 border-t pt-5 text-sm">
                      {product.sizeInfo && (
                        <div className="flex gap-2">
                          <dt className="shrink-0 font-medium">Size:</dt>
                          <dd className="text-muted-foreground">{product.sizeInfo}</dd>
                        </div>
                      )}
                      {product.ingredients && (
                        <div className="flex gap-2">
                          <dt className="shrink-0 font-medium">Ingredients:</dt>
                          <dd className="text-muted-foreground">{product.ingredients}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                </div>
              </div>

              {product.description && (
                <div className="border-t pt-8">
                  <h2 className="font-serif text-2xl">Description</h2>
                  <p className="pt-3 whitespace-pre-line text-muted-foreground">{product.description}</p>
                </div>
              )}

              <ReviewsSection product={product} />
            </div>
          )}
        </div>
      </main>
      <Footer />
      <BackToTop />
      <BottomNav />

      {checkout && <CheckoutDialog order={checkout} onClose={() => setCheckout(null)} />}
    </>
  );
}
