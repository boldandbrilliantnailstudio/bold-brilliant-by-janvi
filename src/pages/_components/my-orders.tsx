// Shows the customer's own past orders, their status, live courier shipment journey, and lets
// them download their invoice once the order is dispatched. Reads orders directly from Supabase
// (RLS-protected), then fetches live tracking from /api/track-shipment by order id.
import { useEffect, useState } from "react";
import { Download, LogIn, PackageSearch, Star, Truck } from "lucide-react";
import { toast } from "sonner";
import Reveal, { SectionHeading } from "@/components/reveal.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { useCustomerAuth } from "@/hooks/use-customer-auth.ts";
import { useProfile } from "@/hooks/use-profile.ts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";
import ShipmentJourney from "./shipment-journey.tsx";
import WriteReviewDialog from "./write-review-dialog.tsx";

type Order = {
  id: string;
  product_name: string;
  amount: number;
  status: string;
  tracking_number: string | null;
  dispatched_at: string | null;
  created_at: string;
};

export default function MyOrders() {
  const { user, isSignedIn, loading } = useCustomerAuth();
  const { profile, openProfile } = useProfile();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<string[]>([]);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!supabase || !user) {
      setOrders(null);
      setReviewedOrderIds([]);
      return;
    }
    supabase
      .from("orders")
      .select("id, product_name, amount, status, tracking_number, dispatched_at, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders((data as Order[] | null) ?? []));
    supabase
      .from("reviews")
      .select("order_id")
      .not("order_id", "is", null)
      .then(({ data }) => {
        const rows = data as { order_id: string }[] | null;
        setReviewedOrderIds((rows ?? []).map((r) => r.order_id));
      });
  }, [user]);

  // The sign-in token goes in a header, never in the URL (URLs end up in history and logs).
  const downloadInvoice = async (orderId: string) => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const tab = window.open("", "_blank");
    const res = await fetch(`/api/invoice?orderId=${encodeURIComponent(orderId)}&print=1`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (!res) {
      tab?.close();
      toast.error("Could not load the invoice. Please try again.");
      return;
    }
    const html = await res.text();
    if (!tab) {
      toast.error("Please allow pop-ups to download the invoice.");
      return;
    }
    tab.document.write(html);
    tab.document.close();
  };

  if (!isSupabaseConfigured) return null;

  return (
    <section className="px-5 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="My Account" title="My Orders" sub="See your order status, live delivery journey and invoice here, automatically." />

        <Reveal>
          {loading ? (
            <Skeleton className="h-32 w-full rounded-3xl" />
          ) : !isSignedIn ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LogIn />
                </EmptyMedia>
                <EmptyTitle>Sign in to see your orders</EmptyTitle>
                <EmptyDescription>Sign in with the email you used while ordering to see your order status here.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <button onClick={() => openProfile()} className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105">
                  Sign In
                </button>
              </EmptyContent>
            </Empty>
          ) : orders === null ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-3xl" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <PackageSearch />
                </EmptyMedia>
                <EmptyTitle>No orders yet</EmptyTitle>
                <EmptyDescription>Once you place an order, it will show up here with live delivery status.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => {
                const reviewed = reviewedOrderIds.includes(o.id);
                return (
                  <div key={o.id} className="flex flex-col gap-3 rounded-3xl border bg-card/70 p-5 backdrop-blur">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-serif text-lg">{o.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          ₹{o.amount} · {new Date(o.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
                          <Truck className="size-4" /> {o.status}
                        </div>
                        {o.dispatched_at && (
                          <button
                            onClick={() => void downloadInvoice(o.id)}
                            title="Download invoice"
                            aria-label="Download invoice"
                            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border bg-background transition-colors hover:bg-secondary"
                          >
                            <Download className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {o.tracking_number && <ShipmentJourney orderId={o.id} />}
                    {o.status === "Delivered" && (
                      <div className="pt-1">
                        {reviewed ? (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Star className="size-3.5 fill-primary text-primary" /> You reviewed this order
                          </p>
                        ) : (
                          <button
                            onClick={() => setReviewOrder(o)}
                            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition-colors hover:bg-secondary"
                          >
                            <Star className="size-3.5" /> Write a Review
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Reveal>
      </div>

      {reviewOrder && user && (
        <WriteReviewDialog
          open
          onClose={() => setReviewOrder(null)}
          orderId={reviewOrder.id}
          productName={reviewOrder.product_name}
          customerName={profile?.fullName ?? user.email ?? "Customer"}
          onSubmitted={() => {
            setReviewedOrderIds((prev) => [...prev, reviewOrder.id]);
            setReviewOrder(null);
          }}
        />
      )}
    </section>
  );
}
