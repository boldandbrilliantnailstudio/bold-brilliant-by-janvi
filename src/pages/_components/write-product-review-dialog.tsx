// Lets any signed-in customer write a review for a specific shop product, optionally with a
// "worn it" photo. Saved hidden (is_published = false) - only shows on the product page after
// the studio owner approves it from Admin > Reviews. One review per customer per product.
import { useState } from "react";
import { Loader2, Star, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { supabase } from "@/lib/supabase.ts";

type Props = {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  customerName: string;
  userId: string;
  onSubmitted: () => void;
};

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

export default function WriteProductReviewDialog({ open, onClose, productId, productName, customerName, userId, onSubmitted }: Props) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Photo is too large. Please use a file under 3MB.");
      return;
    }
    setError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (body.trim().length < 5) {
      setError("Please write a few words about your experience.");
      return;
    }
    if (!supabase) return;
    setError(null);
    setSaving(true);

    let photoUrl: string | null = null;
    if (photoFile) {
      const ext = photoFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `review-photos/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("site-media").upload(path, photoFile, { contentType: photoFile.type });
      if (uploadError) {
        setSaving(false);
        setError("Could not upload your photo. Please try again.");
        return;
      }
      photoUrl = supabase.storage.from("site-media").getPublicUrl(path).data.publicUrl;
    }

    const { error: dbError } = await supabase.from("reviews").insert({
      customer_name: customerName,
      rating,
      body: body.trim(),
      photo_url: photoUrl,
      product_id: productId,
      user_id: userId,
      is_published: false,
    });
    setSaving(false);
    if (dbError) {
      setError(dbError.message.includes("duplicate") ? "You've already reviewed this product." : "Could not submit your review. Please try again.");
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
          <div>
            <p className="pb-2 text-sm font-medium">Add a Photo (optional)</p>
            {photoPreview ? (
              <div className="relative size-20">
                <img src={photoPreview} alt="Your photo" className="size-20 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                  }}
                  aria-label="Remove photo"
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <label className="inline-flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed text-muted-foreground hover:bg-muted">
                <Camera className="size-6" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) pickPhoto(file);
                  }}
                />
              </label>
            )}
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
