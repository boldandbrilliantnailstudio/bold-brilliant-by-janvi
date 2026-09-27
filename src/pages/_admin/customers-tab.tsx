// Customer profiles admin tab (Hissa 6): search customers, see their spend/order/booking/review
// history at a glance, and open a detail view with private admin notes and tags. Backed by
// api/admin-customers.ts (separate from the generic adminApi since it aggregates across tables).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Star, Tag, User, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { AdminButton, AdminCard, EmptyRow, FIELD, LABEL, Spinner } from "./ui.tsx";

type CustomerSummary = {
  id: string;
  customerId: string;
  fullName: string;
  phone: string;
  city: string;
  state: string;
  tags: string[];
  adminNotes: string | null;
  totalSpend: number;
  orderCount: number;
  bookingCount: number;
  reviewCount: number;
};

type CustomerDetail = {
  profile: { id: string; customer_number: number; full_name: string; phone: string; city: string; state: string; admin_notes: string | null; tags: string[] };
  email: string | null;
  orders: { id: string; product_name: string; amount: number; status: string; created_at: string }[];
  bookings: { id: string; service: string; status: string; preferred_date: string }[];
  reviews: { id: string; rating: number; body: string; created_at: string }[];
};

const SUGGESTED_TAGS = ["VIP", "Regular", "New", "At Risk"];

async function callCustomers<T>(password: string, query: string, init?: RequestInit): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(`/api/admin-customers${query}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), "x-admin-password": password, "Content-Type": "application/json" },
  });
  return { ok: res.ok, data: (await res.json()) as T };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function CustomersTab({ password }: { password: string }) {
  const [customers, setCustomers] = useState<CustomerSummary[] | null>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    void callCustomers<{ customers?: CustomerSummary[]; error?: string }>(password, `?${params.toString()}`).then(({ ok, data }) => {
      if (ok) setCustomers(data.customers ?? []);
      else toast.error(data.error ?? "Could not load customers");
    });
  };
  useEffect(load, [password, debouncedSearch]);

  return (
    <div className="space-y-4">
      <h2 className="font-serif text-2xl">Customers</h2>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input className={`${FIELD} pl-9`} placeholder="Search by name or phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {customers === null ? (
        <EmptyRow>Loading customers...</EmptyRow>
      ) : customers.length === 0 ? (
        <EmptyRow>No customers found.</EmptyRow>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <button key={c.id} onClick={() => setOpenId(c.id)} className="text-left">
              <AdminCard className="h-full space-y-2 transition-colors hover:border-primary/40">
                <div className="flex items-center gap-2">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <User className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.fullName}</p>
                    <p className="text-xs text-muted-foreground">#{c.customerId} · {c.phone}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{c.city}, {c.state}</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Tag className="size-2.5" /> {t}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 border-t pt-2 text-center text-xs">
                  <div>
                    <p className="font-semibold text-foreground">₹{c.totalSpend}</p>
                    <p className="text-muted-foreground">Spend</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{c.orderCount + c.bookingCount}</p>
                    <p className="text-muted-foreground">Orders/Bookings</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{c.reviewCount}</p>
                    <p className="text-muted-foreground">Reviews</p>
                  </div>
                </div>
              </AdminCard>
            </button>
          ))}
        </div>
      )}

      {openId && (
        <CustomerDetailDialog
          password={password}
          id={openId}
          onClose={() => setOpenId(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function CustomerDetailDialog({ password, id, onClose, onSaved }: { password: string; id: string; onClose: () => void; onSaved: () => void }) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void callCustomers<{ customer?: CustomerDetail; error?: string }>(password, `?id=${encodeURIComponent(id)}`).then(({ ok, data }) => {
      if (ok && data.customer) {
        setDetail(data.customer);
        setNotes(data.customer.profile.admin_notes ?? "");
        setTags(data.customer.profile.tags ?? []);
      } else {
        toast.error(data.error ?? "Could not load customer");
      }
    });
  }, [password, id]);

  const toggleTag = (tag: string) => setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  const addCustomTag = () => {
    const t = customTag.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag("");
  };

  const save = async () => {
    setSaving(true);
    const { ok, data } = await callCustomers<{ error?: string }>(password, "", { method: "PATCH", body: JSON.stringify({ id, adminNotes: notes, tags }) });
    setSaving(false);
    if (!ok) {
      toast.error(data.error ?? "Could not save");
      return;
    }
    toast.success("Saved");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle className="font-serif text-2xl">Customer Details</DialogTitle>
        {!detail ? (
          <EmptyRow>Loading...</EmptyRow>
        ) : (
          <div className="grid gap-5 pt-2">
            <div>
              <p className="font-medium">{detail.profile.full_name}</p>
              <p className="text-sm text-muted-foreground">#{String(detail.profile.customer_number).padStart(6, "0")} · {detail.profile.phone}</p>
              {detail.email && <p className="text-sm text-muted-foreground">{detail.email}</p>}
              <p className="text-sm text-muted-foreground">{detail.profile.city}, {detail.profile.state}</p>
            </div>

            <div>
              <label className={LABEL}>Tags</label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_TAGS.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${tags.includes(t) ? "border-primary bg-primary/10 text-primary" : "bg-background"}`}
                  >
                    {t}
                  </button>
                ))}
                {tags.filter((t) => !SUGGESTED_TAGS.includes(t)).map((t) => (
                  <button key={t} onClick={() => toggleTag(t)} className="flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {t} <X className="size-3" />
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <input className={FIELD} placeholder="Add a custom tag" value={customTag} onChange={(e) => setCustomTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustomTag()} />
                <AdminButton variant="secondary" onClick={addCustomTag}>Add</AdminButton>
              </div>
            </div>

            <div>
              <label className={LABEL}>Private Admin Notes (customer never sees this)</label>
              <textarea className={`${FIELD} h-24 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Prefers gel over acrylic, allergic to X..." />
            </div>

            <div>
              <p className={LABEL}>Orders ({detail.orders.length})</p>
              {detail.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.orders.map((o) => (
                    <div key={o.id} className="flex justify-between text-sm">
                      <span className="truncate">{o.product_name}</span>
                      <span className="shrink-0 text-muted-foreground">₹{o.amount} · {o.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className={LABEL}>Bookings ({detail.bookings.length})</p>
              {detail.bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {detail.bookings.map((b) => (
                    <div key={b.id} className="flex justify-between text-sm">
                      <span className="truncate">{b.service}</span>
                      <span className="shrink-0 text-muted-foreground">{b.preferred_date} · {b.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className={LABEL}>Reviews ({detail.reviews.length})</p>
              {detail.reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">No reviews yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.reviews.map((r) => (
                    <div key={r.id} className="rounded-xl border p-2 text-sm">
                      <div className="flex gap-0.5 text-primary">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Star key={j} className="size-3" fill={j < r.rating ? "currentColor" : "none"} />
                        ))}
                      </div>
                      <p className="pt-1 text-muted-foreground">{r.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <AdminButton variant="secondary" onClick={onClose} className="flex-1">Close</AdminButton>
              <AdminButton onClick={() => void save()} disabled={saving} className="flex-1">
                {saving && <Spinner />} Save
              </AdminButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
