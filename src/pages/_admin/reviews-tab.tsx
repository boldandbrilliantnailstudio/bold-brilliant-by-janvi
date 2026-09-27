// Customer reviews admin tab: add reviews yourself, and approve/reject reviews customers
// wrote themselves - either for a specific product (src/pages/_components/write-product-review-dialog.tsx)
// or for a delivered order/completed booking (src/pages/_components/write-review-dialog.tsx).
// Reviews are split into two tabs - Studio Reviews (order/booking, shown on homepage
// Testimonials) and Product Reviews (shown on the product page) - each with its own
// rating and date filters, since the two lists can grow large and mean different things.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Package, Plus, Star, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { adminApi } from "./api.ts";
import { AdminButton, AdminCard, EmptyRow, FIELD, LABEL, Spinner, Toggle } from "./ui.tsx";

type Review = {
  id: string;
  customer_name: string;
  rating: number;
  body: string;
  photo_url: string | null;
  service_name: string | null;
  is_published: boolean;
  user_id: string | null;
  product_id: string | null;
  created_at: string;
};

type Product = { id: string; name: string };

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-primary">
      {Array.from({ length: 5 }).map((_, j) => (
        <Star key={j} className="size-3.5" fill={j < rating ? "currentColor" : "none"} />
      ))}
    </div>
  );
}

type Filters = { rating: string; from: string; to: string };
const EMPTY_FILTERS: Filters = { rating: "all", from: "", to: "" };

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className={LABEL}>Rating</label>
        <select className={FIELD} value={filters.rating} onChange={(e) => onChange({ ...filters, rating: e.target.value })}>
          <option value="all">All ratings</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>{n} star</option>
          ))}
        </select>
      </div>
      <div>
        <label className={LABEL}>From</label>
        <input type="date" className={FIELD} value={filters.from} onChange={(e) => onChange({ ...filters, from: e.target.value })} />
      </div>
      <div>
        <label className={LABEL}>To</label>
        <input type="date" className={FIELD} value={filters.to} onChange={(e) => onChange({ ...filters, to: e.target.value })} />
      </div>
      {(filters.rating !== "all" || filters.from || filters.to) && (
        <AdminButton variant="secondary" onClick={() => onChange(EMPTY_FILTERS)}>Clear filters</AdminButton>
      )}
    </div>
  );
}

function applyFilters(reviews: Review[], filters: Filters): Review[] {
  return reviews.filter((r) => {
    if (filters.rating !== "all" && r.rating !== Number(filters.rating)) return false;
    const day = r.created_at.slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    return true;
  });
}

export default function ReviewsTab({ password }: { password: string }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"studio" | "product">("studio");
  const [studioFilters, setStudioFilters] = useState<Filters>(EMPTY_FILTERS);
  const [productFilters, setProductFilters] = useState<Filters>(EMPTY_FILTERS);

  const load = () => {
    void adminApi.list<Review>(password, "reviews").then(({ ok, data }) => {
      if (ok) setReviews(data.rows ?? []);
      else toast.error(data.error ?? "Could not load reviews");
    });
  };
  useEffect(load, [password]);
  useEffect(() => {
    void adminApi.list<Product>(password, "products").then(({ ok, data }) => {
      if (ok) setProducts(data.rows ?? []);
    });
  }, [password]);

  const productName = (id: string | null) => (id ? products.find((p) => p.id === id)?.name ?? "a product" : null);

  const studioReviews = useMemo(() => reviews?.filter((r) => !r.product_id) ?? [], [reviews]);
  const productReviews = useMemo(() => reviews?.filter((r) => !!r.product_id) ?? [], [reviews]);

  const pending = (list: Review[]) => list.filter((r) => !r.is_published && r.user_id);
  const published = (list: Review[]) => list.filter((r) => !(!r.is_published && r.user_id));

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

  const activeList = tab === "studio" ? studioReviews : productReviews;
  const activeFilters = tab === "studio" ? studioFilters : productFilters;
  const setActiveFilters = tab === "studio" ? setStudioFilters : setProductFilters;
  const filteredPending = applyFilters(pending(activeList), activeFilters);
  const filteredPublished = applyFilters(published(activeList), activeFilters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Customer Reviews</h2>
        <AdminButton onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Add Review
        </AdminButton>
      </div>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab("studio")}
          className={`px-4 py-2 text-sm font-medium ${tab === "studio" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
        >
          Studio Reviews {reviews !== null && `(${studioReviews.length})`}
        </button>
        <button
          onClick={() => setTab("product")}
          className={`px-4 py-2 text-sm font-medium ${tab === "product" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
        >
          Product Reviews {reviews !== null && `(${productReviews.length})`}
        </button>
      </div>

      {reviews === null ? (
        <EmptyRow>Loading reviews...</EmptyRow>
      ) : (
        <>
          <FilterBar filters={activeFilters} onChange={setActiveFilters} />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Approval {filteredPending.length > 0 && `(${filteredPending.length})`}
            </h3>
            {filteredPending.length === 0 ? (
              <EmptyRow>No reviews waiting for approval.</EmptyRow>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPending.map((r) => (
                  <AdminCard key={r.id} className="space-y-2 border-primary/30">
                    {r.product_id && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        <Package className="size-3.5" /> {productName(r.product_id)}
                      </p>
                    )}
                    {r.service_name && <p className="text-xs font-medium text-primary">{r.service_name}</p>}
                    <Stars rating={r.rating} />
                    <p className="text-sm text-muted-foreground">&ldquo;{r.body}&rdquo;</p>
                    {r.photo_url && <img src={r.photo_url} alt="Customer photo" className="h-20 w-20 rounded-xl object-cover" />}
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
            {filteredPublished.length === 0 ? (
              <EmptyRow>No reviews match these filters.</EmptyRow>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPublished.map((r) => (
                  <AdminCard key={r.id} className="space-y-2">
                    {r.product_id && (
                      <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        <Package className="size-3.5" /> {productName(r.product_id)}
                      </p>
                    )}
                    {r.service_name && <p className="text-xs font-medium text-primary">{r.service_name}</p>}
                    <Stars rating={r.rating} />
                    <p className="text-sm text-muted-foreground">&ldquo;{r.body}&rdquo;</p>
                    {r.photo_url && <img src={r.photo_url} alt="Customer photo" className="h-20 w-20 rounded-xl object-cover" />}
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
  const [serviceName, setServiceName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || !body.trim()) {
      setError("Please fill in the customer name and review text.");
      return;
    }
    setSaving(true);
    const { ok, data } = await adminApi.create(password, "reviews", {
      customer_name: name.trim(),
      rating,
      body: body.trim(),
      service_name: serviceName.trim() || null,
      is_published: true,
      sort_order: 0,
    });
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
            <label className={LABEL}>Service (optional)</label>
            <input className={FIELD} value={serviceName} onChange={(e) => setServiceName(e.target.value)} placeholder="Gel Extensions" />
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
