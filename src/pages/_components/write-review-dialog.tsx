// Lets a signed-in customer write a studio review for one of their own Delivered orders or
// Completed bookings (pass exactly one of orderId/bookingId). Goes through /api/submit-review,
// which checks it really is Delivered/Completed and belongs to this customer before saving -
// it then publishes instantly and shows in the homepage Testimonials. Supports up to 3 photos,
// same as the product review dialog (Hissa 5: review popup with photos).
import { useState } from "react";
import { Loader2, Star, Camera, X } from "lucide-react";
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

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_PHOTOS = 3;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export default function WriteReviewDialog({ open, onClose, orderId, bookingId, productName, customerName, onSubmitted }: Props) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Photo is too large. Please use a file under 3MB.");
      return;
    }
    if (photos.length >= MAX_PHOTOS) return;
    setError(null);
    setPhotos((prev) => [...prev, { file, preview: URL.createObjectURL(file) }]);
  };

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

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

    const photoDataUrls = await Promise.all(photos.map((p) => readAsDataUrl(p.file)));
    const res = await fetch("/api/submit-review", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating, body: body.trim(), customerName, orderId, bookingId, photos: photoDataUrls }),
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
          <div>
            <p className="pb-2 text-sm font-medium">Add Photos (optional, up to {MAX_PHOTOS})</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative size-20">
                  <img src={p.preview} alt="Your photo" className="size-20 rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label="Remove photo"
                    className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="inline-flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed text-muted-foreground hover:bg-muted">
                  <Camera className="size-6" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) addPhoto(file);
                    }}
                  />
                </label>
              )}
            </div>
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
