// Lets a signed-in customer write a review for one of their own Delivered orders. The review
// is saved hidden (is_published = false) - it only appears on the site (Testimonials) after
// the studio owner approves it from Admin > Reviews.
import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { supabase } from "@/lib/supabase.ts";

type Props = {
  open: boolean;
  onClose: () => void;
  orderId: string;
  productName: string;
  customerName: string;
  userId: string;
  onSubmitted: () => void;
};

export default function WriteReviewDialog({ open, onClose, orderId, productName, customerName, userId, onSubmitted }: Props) {
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
    const { error: dbError } = await supabase.from("reviews").insert({
      customer_name: customerName,
      rating,
      body: body.trim(),
      order_id: orderId,
      user_id: userId,
      is_published: false,
    });
    setSaving(false);
    if (dbError) {
      setError(dbError.message.includes("duplicate") ? "You've already reviewed this order." : "Could not submit your review. Please try again.");
      return;
    }
    toast.success("Thank you! Your review will appear once approved.");
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
