// Lets a signed-in customer write a studio review for one of their own Delivered orders or
// Completed bookings (pass exactly one of orderId/bookingId). Goes through /api/submit-review,
// which checks it really is Delivered/Completed and belongs to this customer before saving -
// it then publishes instantly and shows in the homepage Testimonials.
import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { supabase } from "@/lib/supabase.ts";

type Props = {
  open: boolean;
  onClose: () => void;
  orderId?: string;
  bookingId?: string;
  productName: string;
  customerName: string;
  onSubmitted: () => void;
};

export default function WriteReviewDialog({ open, onClose, orderId, bookingId, productName, customerName, onSubmitted }: Props) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (body.trim().length < 5) {
      setError("Please write a few words about your experience.");
      return;
    }
    if (!supabase) return;
    setError(null);
    setSaving(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setSaving(false);
      setError("Please sign in again to continue.");
      return;
    }

    const res = await fetch("/api/submit-review", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating, body: body.trim(), customerName, orderId, bookingId }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { ok?: boolean; error?: string } | undefined;
    setSaving(false);
    if (!res?.ok || !data?.ok) {
      setError(data?.error ?? "Could not submit your review. Please try again.");
      return;
    }
    toast.success("Thank you for your review!");
    onSubmitted();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="font-serif text-2xl">Write a Review</DialogTitle>
        <p className="text-sm text-muted-foreground">Share your experience with {productName}.</p>
        <div className="grid gap-4 pt-2">
          <div>
            <p className="pb-2 text-sm font-medium">Your Rating</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} className="p-1">
                  <Star className={`size-7 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="pb-2 text-sm font-medium">Your Review</p>
            <Textarea rows={4} placeholder="Tell other customers what you loved..." className="rounded-xl bg-background/70" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            onClick={() => void submit()}
            disabled={saving}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />} Submit Review
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
