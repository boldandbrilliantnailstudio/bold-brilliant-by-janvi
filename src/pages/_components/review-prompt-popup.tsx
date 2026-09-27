// Hissa 5: nudges a signed-in customer to review their delivered order or completed
// appointment. Checks /api/review-prompt once per browser tab session (not on every page),
// which itself enforces "shown at most 2 times ever, per order/booking" server-side and stops
// completely once a review is written for it (see supabase/review-prompt.sql).
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { useCustomerAuth } from "@/hooks/use-customer-auth.ts";
import { useProfile } from "@/hooks/use-profile.ts";
import { supabase } from "@/lib/supabase.ts";
import WriteReviewDialog from "./write-review-dialog.tsx";

const SESSION_KEY = "bb-review-prompt-checked";

type Target = { kind: "order" | "booking"; id: string; label: string };

export default function ReviewPromptPopup() {
  const { user, isSignedIn } = useCustomerAuth();
  const { profile } = useProfile();
  const [target, setTarget] = useState<Target | null>(null);
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !supabase || sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/review-prompt", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      const body = (await res?.json().catch(() => ({}))) as { target?: Target } | undefined;
      if (body?.target) {
        // Small delay so it doesn't compete with the page's own load, popups, etc.
        setTimeout(() => {
          setTarget(body.target ?? null);
          setOpen(true);
        }, 1500);
      }
    };
    void check();
  }, [isSignedIn]);

  if (!target) return null;

  return (
    <>
      <Dialog open={open && !writing} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogTitle className="sr-only">Rate your experience</DialogTitle>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
              <Star className="size-7 fill-primary" />
            </div>
            <h3 className="font-serif text-xl">How was your experience?</h3>
            <p className="text-sm text-muted-foreground">
              {target.kind === "order" ? `Tell us what you thought of ${target.label}.` : `Tell us how your ${target.label} appointment went.`}
            </p>
            <div className="flex w-full gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="h-11 flex-1 rounded-full border text-sm font-medium transition-colors hover:bg-secondary">
                Maybe Later
              </button>
              <button
                onClick={() => setWriting(true)}
                className="h-11 flex-1 rounded-full bg-primary text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                Write a Review
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {writing && user && (
        <WriteReviewDialog
          open
          onClose={() => {
            setWriting(false);
            setOpen(false);
          }}
          orderId={target.kind === "order" ? target.id : undefined}
          bookingId={target.kind === "booking" ? target.id : undefined}
          productName={target.label}
          customerName={profile?.fullName ?? user.email ?? "Customer"}
          onSubmitted={() => {
            setWriting(false);
            setOpen(false);
            toast.success("Thanks for your feedback!");
          }}
        />
      )}
    </>
  );
}
