// Custom set request popup (Shop > Custom Sets). Replaces the old "Enquire on WhatsApp" link:
// the request is saved for the studio (Admin > Custom Requests + Telegram alert) and the customer
// is told when the manager will contact them on WhatsApp. Signed-in customers get their name,
// WhatsApp number and email filled in automatically.
import { useEffect, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, ImagePlus, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import { useProfile } from "@/hooks/use-profile.ts";
import { useCustomerAuth } from "@/hooks/use-customer-auth.ts";
import { supabase } from "@/lib/supabase.ts";
import { replyPromise } from "@/lib/custom-request.ts";
import { fileToDataUrl } from "@/pages/_admin/api.ts";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  whatsapp: z.string().trim().regex(/^\+?[0-9\s-]{10,15}$/, "Enter a valid WhatsApp number"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  details: z.string().trim().min(5, "Tell us a little about the design you want").max(1000),
});
type FormValues = z.infer<typeof schema>;

const FIELD = "h-12 rounded-xl bg-background/70";

function Sent({ requestNumber, whatsapp, onDone }: { requestNumber: number; whatsapp: string; onDone: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <CheckCircle2 className="size-14 text-primary" />
      <DialogTitle className="font-serif text-2xl font-normal">Request #{requestNumber} received</DialogTitle>
      <p className="text-sm text-muted-foreground">Thank you! {replyPromise()}</p>
      <p className="rounded-2xl border bg-background/60 px-4 py-3 text-sm">
        We'll message you at <span className="font-medium">{whatsapp}</span>
      </p>
      <button onClick={onDone} className="mt-2 h-12 w-full cursor-pointer rounded-full bg-primary font-medium text-primary-foreground transition-transform hover:scale-[1.02]">
        Done
      </button>
    </div>
  );
}

export default function CustomRequestDialog({ setName, onClose }: { setName: string; onClose: () => void }) {
  const { profile } = useProfile();
  const { user } = useCustomerAuth();
  const [photo, setPhoto] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [sent, setSent] = useState<{ requestNumber: number; whatsapp: string } | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: profile?.fullName ?? "", whatsapp: profile?.phone ?? "", email: user?.email ?? "", details: "" },
  });

  // Sign-in and profile load in the background - fill any still-empty field once they arrive.
  useEffect(() => {
    const fill = (key: "name" | "whatsapp" | "email", value: string | undefined) => {
      if (value && !getValues(key)) setValue(key, value);
    };
    fill("name", profile?.fullName);
    fill("whatsapp", profile?.phone);
    fill("email", user?.email);
  }, [profile?.fullName, profile?.phone, user?.email, getValues, setValue]);

  const pickPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPreparingPhoto(true);
    try {
      setPhoto(await fileToDataUrl(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not use this photo.");
    } finally {
      setPreparingPhoto(false);
    }
  };

  const onSubmit = async (d: FormValues) => {
    // Sends the sign-in token (if any) so the request is linked to the customer's account.
    const session = supabase ? (await supabase.auth.getSession()).data.session : null;
    const res = await fetch("/api/custom-request", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify({ ...d, email: d.email.trim() || undefined, setName, photo: photo ?? undefined }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { requestNumber?: number; error?: string } | undefined;
    if (!res?.ok || typeof data?.requestNumber !== "number") {
      toast.error(data?.error ?? "Could not send your request. Please try again.");
      return;
    }
    setSent({ requestNumber: data.requestNumber, whatsapp: d.whatsapp });
  };

  const err = (k: keyof FormValues) => errors[k] && <p className="pt-1 text-xs text-destructive">{errors[k]?.message}</p>;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:max-w-lg md:p-8">
        {sent ? (
          <Sent requestNumber={sent.requestNumber} whatsapp={sent.whatsapp} onDone={onClose} />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
            <div>
              <DialogTitle className="font-serif text-2xl font-normal">{setName}</DialogTitle>
              <p className="pt-1 text-sm text-muted-foreground">Tell us your idea. Our manager will contact you on WhatsApp with the design and price.</p>
            </div>
            <div>
              <Label htmlFor="cr-name" className="pb-2">Full Name</Label>
              <Input id="cr-name" placeholder="Priya Shah" className={FIELD} {...register("name")} />
              {err("name")}
            </div>
            <div>
              <Label htmlFor="cr-whatsapp" className="pb-2">WhatsApp Number</Label>
              <Input id="cr-whatsapp" type="tel" inputMode="tel" placeholder="+91 98765 43210" className={FIELD} {...register("whatsapp")} />
              {err("whatsapp")}
            </div>
            <div>
              <Label htmlFor="cr-email" className="pb-2">Email (optional)</Label>
              <Input id="cr-email" type="email" placeholder="priya@gmail.com" className={FIELD} {...register("email")} />
              {err("email")}
            </div>
            <div>
              <Label htmlFor="cr-details" className="pb-2">Your Design Idea</Label>
              <Textarea
                id="cr-details"
                rows={4}
                placeholder="Shape, length, colours, occasion, date you need it by..."
                className="rounded-xl bg-background/70"
                {...register("details")}
              />
              {err("details")}
            </div>
            <div>
              <Label className="pb-2">Reference Photo (optional)</Label>
              {photo ? (
                <div className="relative w-fit">
                  <img src={photo} alt="Your reference" className="h-28 w-28 rounded-2xl object-cover ring-1 ring-border" />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    aria-label="Remove photo"
                    className="absolute -right-2 -top-2 grid size-7 cursor-pointer place-items-center rounded-full bg-foreground text-background"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-input bg-background/60 text-sm text-muted-foreground transition-colors hover:border-primary/50">
                  {preparingPhoto ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5 text-primary" />}
                  {preparingPhoto ? "Preparing photo..." : "Add a photo or screenshot"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void pickPhoto(e)} />
                </label>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting || preparingPhoto}
              className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary font-medium text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {isSubmitting ? "Sending..." : "Send Request"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
