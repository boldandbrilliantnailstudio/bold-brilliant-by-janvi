// Shows the signed-in customer's own past appointments and lets them write a studio review
// once a booking is Completed. Reads bookings directly from Supabase (RLS-protected, own rows
// only - see supabase/reviews-v2.sql), mirroring src/pages/_components/my-orders.tsx.
import { useEffect, useState } from "react";
import { CalendarClock, Star } from "lucide-react";
import Reveal, { SectionHeading } from "@/components/reveal.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { useCustomerAuth } from "@/hooks/use-customer-auth.ts";
import { useProfile } from "@/hooks/use-profile.ts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase.ts";
import WriteReviewDialog from "./write-review-dialog.tsx";

type Booking = {
  id: string;
  booking_number: number;
  service: string;
  preferred_date: string;
  preferred_time: string;
  status: string;
};

const formatDate = (d: string) => new Date(`${d}T00:00`).toLocaleDateString("en-IN", { dateStyle: "medium" });
const formatTime = (t: string) => new Date(`1970-01-01T${t}`).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export default function MyBookings() {
  const { user, isSignedIn, loading } = useCustomerAuth();
  const { profile } = useProfile();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<string[]>([]);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!supabase || !user) {
      setBookings(null);
      setReviewedBookingIds([]);
      return;
    }
    supabase
      .from("bookings")
      .select("id, booking_number, service, preferred_date, preferred_time, status")
      .order("preferred_date", { ascending: false })
      .then(({ data }) => setBookings((data as Booking[] | null) ?? []));
    supabase
      .from("reviews")
      .select("booking_id")
      .not("booking_id", "is", null)
      .then(({ data }) => {
        const rows = data as { booking_id: string }[] | null;
        setReviewedBookingIds((rows ?? []).map((r) => r.booking_id));
      });
  }, [user]);

  if (!isSupabaseConfigured || !isSignedIn || loading) return null;
  if (bookings === null) {
    return (
      <section className="px-5 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <Skeleton className="h-32 w-full rounded-3xl" />
        </div>
      </section>
    );
  }
  if (bookings.length === 0) return null;

  return (
    <section className="px-5 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="My Account" title="My Bookings" sub="Your past and upcoming appointments." />
        <Reveal>
          {bookings.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarClock />
                </EmptyMedia>
                <EmptyTitle>No appointments yet</EmptyTitle>
                <EmptyDescription>Book your first appointment above.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => {
                const reviewed = reviewedBookingIds.includes(b.id);
                return (
                  <div key={b.id} className="flex flex-col gap-3 rounded-3xl border bg-card/70 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-serif text-lg">{b.service}</p>
                      <p className="text-xs text-muted-foreground">
                        #{b.booking_number} · {formatDate(b.preferred_date)} at {formatTime(b.preferred_time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">{b.status}</span>
                      {b.status === "Completed" && (
                        reviewed ? (
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Star className="size-3.5 fill-primary text-primary" /> Reviewed
                          </p>
                        ) : (
                          <button
                            onClick={() => setReviewBooking(b)}
                            className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition-colors hover:bg-secondary"
                          >
                            <Star className="size-3.5" /> Write a Review
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Reveal>
      </div>

      {reviewBooking && user && (
        <WriteReviewDialog
          open
          onClose={() => setReviewBooking(null)}
          bookingId={reviewBooking.id}
          productName={reviewBooking.service}
          customerName={profile?.fullName ?? user.email ?? "Customer"}
          onSubmitted={() => {
            setReviewedBookingIds((prev) => [...prev, reviewBooking.id]);
            setReviewBooking(null);
          }}
        />
      )}
    </section>
  );
}
