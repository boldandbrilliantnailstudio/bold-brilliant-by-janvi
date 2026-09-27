// Full product view: swipeable photo gallery, description, price, buy actions, and this
// product's own customer reviews (separate from the homepage Testimonials). Any signed-in
// customer can write one review per product; it goes live once the studio owner approves it.
import { useEffect, useState } from "react";
import { ShoppingBasket, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import Carousel from "@/components/carousel.tsx";
import { useCustomerAuth } from "@/hooks/use-customer-auth.ts";
import { useProfile } from "@/hooks/use-profile.ts";
import { useProductReviews } from "@/hooks/use-product-reviews.ts";
import { useCart } from "@/hooks/use-cart.tsx";
import { supabase } from "@/lib/supabase.ts";
import type { Product } from "@/hooks/use-products.ts";
import WriteProductReviewDialog from "./write-product-review-dialog.tsx";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1610992015762-45dca7fa3a85?fm=webp&q=70&fit=crop&w=500&h=625";

type Props = {
  product: Product;
  onClose: () => void;
  onBuyNow: (p: Product) => void;
};

export default function ProductDetailDialog({ product, onClose, onBuyNow }: Props) {
  const { user, isSignedIn } = useCustomerAuth();
  const { profile, openProfile } = useProfile();
  const { add } = useCart();
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

  const images = product.images.length > 0 ? product.images : [FALLBACK_IMG];
  const avgRating = reviews && reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  const addToBasket = () => {
    if (product.soldOut) return;
    add({ name: product.name, price: product.price, img: images[0] });
    toast.success(`${product.name} added to your basket`);
  };

  const startReview = () => {
    if (!isSignedIn) {
      openProfile();
      return;
    }
    setWriting(true);
  };

  return (
    <>
      <Dialog open={!writing} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogTitle className="font-serif text-2xl">{product.name}</DialogTitle>
          <div className="grid gap-5 pt-2">
            {images.length > 1 ? (
              <Carousel itemClassName="w-full">
                {images.map((src, i) => (
                  <img key={i} src={src} alt={`${product.name} photo ${i + 1}`} className="aspect-square w-full rounded-2xl object-cover" />
                ))}
              </Carousel>
            ) : (
              <img src={images[0]} alt={product.name} className="aspect-square w-full rounded-2xl object-cover" />
            )}

            <div>
              <p className="text-lg font-medium text-primary">
                ₹{product.price}
                {product.compareAtPrice && product.compareAtPrice > product.price && (
                  <span className="ml-2 text-sm text-muted-foreground line-through">₹{product.compareAtPrice}</span>
                )}
              </p>
              {avgRating !== null && (
                <div className="flex items-center gap-1.5 pt-1">
                  <div className="flex gap-0.5 text-primary">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="size-3.5" fill={j < Math.round(avgRating) ? "currentColor" : "none"} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {avgRating.toFixed(1)} ({reviews?.length} review{reviews?.length === 1 ? "" : "s"})
                  </span>
                </div>
              )}
              {product.description && <p className="pt-3 text-sm text-muted-foreground">{product.description}</p>}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => onBuyNow(product)}
                disabled={product.soldOut}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                {product.soldOut ? "Sold Out" : "Buy Now"}
              </button>
              <button
                aria-label={`Add ${product.name} to basket`}
                title="Add to basket"
                onClick={addToBasket}
                disabled={product.soldOut}
                className="grid size-12 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingBasket className="size-5" />
              </button>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg">Customer Reviews</h3>
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

              {reviews === null ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet. Be the first to share your experience!</p>
              ) : (
                <div className="space-y-3">
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
        </DialogContent>
      </Dialog>

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
