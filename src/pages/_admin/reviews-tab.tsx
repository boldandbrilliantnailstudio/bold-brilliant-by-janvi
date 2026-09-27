// Customer reviews admin tab: add reviews yourself, and approve/reject reviews customers
// wrote themselves after a delivered order (src/pages/_components/write-review-dialog.tsx).
// Customer-submitted reviews land here hidden (is_published = false) until approved; approving
// publishes them on the site (src/hooks/use-reviews.ts), rejecting deletes them for good.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Star, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { adminApi } from "./api.ts";
import { AdminButton, AdminCard, EmptyRow, FIELD, LABEL, Spinner, Toggle } from "./ui.tsx";

type Review = {
  id: string;
  customer_name: string;
  rating: number;
  body: string;
  photo_url: string | null;
  is_published: boolean;
  user_id: string | null;
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-primary">
      {Array.from({ length: 5 }).map((_, j) => (
        <Star key={j} className="size-3.5" fill={j < rating ? "currentColor" : "none"} />
      ))}
    </div>
  );
}

export default function ReviewsTab({ password }: { password: string }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    void adminApi.list<Review>(password, "reviews").then(({ ok, data }) => {
      if (ok) setReviews(data.rows ?? []);
      else toast.error(data.error ?? "Could not load reviews");
    });
  };
  useEffect(load, [password]);

  const pending = reviews?.filter((r) => !r.is_published && r.user_id) ?? [];
  const published = reviews?.filter((r) => !(!r.is_published && r.user_id)) ?? [];

  const approve = async (r: Review) => {
    setBusyId(r.id);
    const { ok, data } = await adminApi.update<Review>(password, "reviews", { id: r.id, is_published: true });
    setBusyId(null);
    if (!ok) {
      toast.error(data.error ?? "Could not approve review");
      return;
    }
    toast.success("Review approved and published");
    setReviews((prev) => prev?.map((x) => (x.id === r.id ? { ...x, is_published: true } : x)) ?? null);
  };

  const reject = async (r: Review) => {
    if (!confirm(`Reject and delete this review from "${r.customer_name}"? This cannot be undone.`)) return;
    setBusyId(r.id);
    const { ok, data } = await adminApi.remove(password, "reviews", r.id);
    setBusyId(null);
    if (!ok) {
      toast.error(data.error ?? "Could not reject review");
      return;
    }
    toast.success("Review rejected");
    setReviews((prev) => prev?.filter((x) => x.id !== r.id) ?? null);
  };

  const togglePublished = async (r: Review, value: boolean) => {
    const { ok, data } = await adminApi.update<Review>(password, "reviews", { id: r.id, is_published: value });
    if (!ok) {
      toast.error(data.error ?? "Could not update review");
      return;
    }
    setReviews((prev) => prev?.map((x) => (x.id === r.id ? { ...x, is_published: value } : x)) ?? null);
  };

  const remove = async (r: Review) => {
    if (!confirm(`Delete review from "${r.customer_name}"?`)) return;
    const { ok, data } = await adminApi.remove(password, "reviews", r.id);
    if (!ok) {
      toast.error(data.error ?? "Could not delete review");
      return;
    }
    setReviews((prev) => prev?.filter((x) => x.id !== r.id) ?? null);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl">Customer Reviews</h2>
        <AdminButton onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Add Review
        </AdminButton>
      </div>

      {reviews === null ? (
        <EmptyRow>Loading reviews...</EmptyRow>
      ) : (
        <>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Approval {pending.length > 0 && `(${pending.length})`}
            </h3>
            {pending.length === 0 ? (
              <EmptyRow>No reviews waiting for approval.</EmptyRow>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((r) => (
                  <AdminCard key={r.id} className="space-y-2 border-primary/30">
                    <Stars rating={r.rating} />
                    <p className="text-sm text-muted-foreground">&ldquo;{r.body}&rdquo;</p>
                    <p className="text-sm font-medium">{r.customer_name}</p>
                    <div className="flex gap-2 pt-1">
                      <AdminButton onClick={() => void approve(r)} disabled={busyId === r.id} className="flex-1">
                        {busyId === r.id ? <Spinner /> : <Check className="size-3.5" />} Approve
                      </AdminButton>
                      <AdminButton variant="danger" onClick={() => void reject(r)} disabled={busyId === r.id} className="flex-1">
                        <Trash2 className="size-3.5" /> Reject
                      </AdminButton>
                    </div>
                  </AdminCard>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Published & Hidden Reviews</h3>
            {published.length === 0 ? (
              <EmptyRow>No reviews yet.</EmptyRow>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {published.map((r) => (
                  <AdminCard key={r.id} className="space-y-2">
                    <Stars rating={r.rating} />
                    <p className="text-sm text-muted-foreground">&ldquo;{r.body}&rdquo;</p>
                    <p className="text-sm font-medium">{r.customer_name}</p>
                    <Toggle checked={r.is_published} onChange={(v) => void togglePublished(r, v)} label={r.is_published ? "Published" : "Hidden"} />
                    <AdminButton variant="danger" onClick={() => void remove(r)} className="w-full">
                      <Trash2 className="size-3.5" /> Delete
                    </AdminButton>
                  </AdminCard>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {creating && (
        <ReviewFormDialog
          password={password}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function ReviewFormDialog({ password, onClose, onSaved }: { password: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || !body.trim()) {
      setError("Please fill in the customer name and review text.");
      return;
    }
    setSaving(true);
    const { ok, data } = await adminApi.create(password, "reviews", { customer_name: name.trim(), rating, body: body.trim(), is_published: true, sort_order: 0 });
    setSaving(false);
    if (!ok) {
      setError(data.error ?? "Could not save review");
      return;
    }
    toast.success("Review added");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="font-serif text-2xl">Add Review</DialogTitle>
        <div className="grid gap-4 pt-2">
          <div>
            <label className={LABEL}>Customer Name</label>
            <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Shah" />
          </div>
          <div>
            <label className={LABEL}>Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className="p-1">
                  <Star className={`size-6 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={LABEL}>Review Text</label>
            <textarea className={`${FIELD} h-24 py-2`} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <AdminButton variant="secondary" onClick={onClose} className="flex-1">Cancel</AdminButton>
            <AdminButton onClick={() => void save()} disabled={saving} className="flex-1">
              {saving && <Spinner />} Save
            </AdminButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
