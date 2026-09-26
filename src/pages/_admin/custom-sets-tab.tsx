// Custom Sets admin tab: add, edit, delete, show/hide and reorder the options customers see in
// Shop > Custom Sets (src/hooks/use-custom-sets.ts). Customer requests for these arrive in the
// Custom Requests tab.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { adminApi, fileToDataUrl } from "./api.ts";
import { AdminButton, AdminCard, EmptyRow, FIELD, LABEL, Spinner, Toggle } from "./ui.tsx";

type CustomSet = {
  id: string;
  name: string;
  price_label: string;
  description: string;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

type FormState = { name: string; priceLabel: string; description: string; imageUrl: string; isActive: boolean; sortOrder: string };

export default function CustomSetsTab({ password }: { password: string }) {
  const [sets, setSets] = useState<CustomSet[] | null>(null);
  const [editing, setEditing] = useState<CustomSet | "new" | null>(null);

  const load = () => {
    void adminApi.list<CustomSet>(password, "custom_sets").then(({ ok, data }) => {
      if (ok) setSets(data.rows ?? []);
      else {
        setSets([]);
        toast.error(data.error ?? "Could not load custom sets");
      }
    });
  };
  useEffect(load, [password]);

  const toggleActive = async (s: CustomSet, value: boolean) => {
    const { ok, data } = await adminApi.update(password, "custom_sets", { id: s.id, is_active: value });
    if (!ok) {
      toast.error(data.error ?? "Could not update");
      return;
    }
    setSets((prev) => prev?.map((x) => (x.id === s.id ? { ...x, is_active: value } : x)) ?? null);
  };

  const remove = async (s: CustomSet) => {
    if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    const { ok, data } = await adminApi.remove(password, "custom_sets", s.id);
    if (!ok) {
      toast.error(data.error ?? "Could not delete");
      return;
    }
    setSets((prev) => prev?.filter((x) => x.id !== s.id) ?? null);
    toast.success("Custom set deleted");
  };

  const nextOrder = (sets ?? []).reduce((max, s) => Math.max(max, s.sort_order), 0) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">Custom Sets</h2>
        <AdminButton onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Add Custom Set
        </AdminButton>
      </div>
      <p className="text-sm text-muted-foreground">These options appear in Shop &gt; Custom Sets. Customer requests for them arrive in Custom Requests.</p>

      {sets === null ? (
        <EmptyRow>Loading custom sets...</EmptyRow>
      ) : sets.length === 0 ? (
        <EmptyRow>No custom sets yet. Add your first option.</EmptyRow>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => (
            <AdminCard key={s.id} className="flex flex-col gap-3">
              <div className="flex gap-3">
                {s.image_url ? (
                  <img src={s.image_url} alt={s.name} className="size-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Sparkles className="size-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-sm text-primary">{s.price_label}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Toggle checked={s.is_active} onChange={(v) => void toggleActive(s, v)} label={s.is_active ? "Visible" : "Hidden"} />
                <span className="text-xs text-muted-foreground">Position {s.sort_order}</span>
              </div>
              <div className="flex gap-2">
                <AdminButton variant="secondary" onClick={() => setEditing(s)} className="flex-1">
                  <Pencil className="size-3.5" /> Edit
                </AdminButton>
                <AdminButton variant="danger" onClick={() => void remove(s)}>
                  <Trash2 className="size-3.5" />
                </AdminButton>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {editing && (
        <CustomSetFormDialog
          password={password}
          set={editing === "new" ? null : editing}
          defaultOrder={nextOrder}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function CustomSetFormDialog({
  password,
  set,
  defaultOrder,
  onClose,
  onSaved,
}: {
  password: string;
  set: CustomSet | null;
  defaultOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    set
      ? { name: set.name, priceLabel: set.price_label, description: set.description, imageUrl: set.image_url ?? "", isActive: set.is_active, sortOrder: String(set.sort_order) }
      : { name: "", priceLabel: "", description: "", imageUrl: "", isActive: true, sortOrder: String(defaultOrder) },
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { ok, data } = await adminApi.upload(password, dataUrl, "custom-sets");
      if (!ok || !data.url) throw new Error(data.error ?? "Upload failed");
      const url = data.url;
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const name = form.name.trim();
    if (name.length < 2 || name.length > 60) {
      setError("Please enter a name (2-60 characters).");
      return;
    }
    if (form.priceLabel.trim().length > 40 || form.description.trim().length > 300) {
      setError("Price text must be under 40 characters and description under 300.");
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      name,
      price_label: form.priceLabel.trim(),
      description: form.description.trim(),
      image_url: form.imageUrl || null,
      is_active: form.isActive,
      sort_order: Number.parseInt(form.sortOrder, 10) || 0,
    };
    const { ok, data } = set
      ? await adminApi.update(password, "custom_sets", { id: set.id, ...body })
      : await adminApi.create(password, "custom_sets", body);
    setSaving(false);
    if (!ok) {
      setError(data.error ?? "Could not save");
      return;
    }
    toast.success(set ? "Custom set updated" : "Custom set added");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle className="font-serif text-2xl">{set ? "Edit Custom Set" : "Add Custom Set"}</DialogTitle>
        <div className="grid gap-4 pt-2">
          <div>
            <label className={LABEL}>Photo (optional)</label>
            <div className="flex items-center gap-3">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="Preview" className="size-16 rounded-xl object-cover" />
              ) : (
                <div className="grid size-16 place-items-center rounded-xl bg-muted">
                  <Sparkles className="size-6 text-muted-foreground" />
                </div>
              )}
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border bg-background px-4 text-sm font-medium hover:bg-muted">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                {uploading ? "Uploading..." : "Upload Photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void handleUpload(file);
                  }}
                />
              </label>
              {form.imageUrl && (
                <AdminButton variant="secondary" onClick={() => setForm({ ...form, imageUrl: "" })}>
                  Remove
                </AdminButton>
              )}
            </div>
          </div>
          <div>
            <label className={LABEL}>Name</label>
            <input className={FIELD} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Custom Bridal Set" />
          </div>
          <div>
            <label className={LABEL}>Price text</label>
            <input className={FIELD} value={form.priceLabel} onChange={(e) => setForm({ ...form, priceLabel: e.target.value })} placeholder="Starts at ₹1,999" />
          </div>
          <div>
            <label className={LABEL}>Description</label>
            <textarea
              className={`${FIELD} h-20 py-2`}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Fully personalised bridal design with trial option."
            />
          </div>
          <div>
            <label className={LABEL}>Position (1 shows first)</label>
            <input type="number" min="0" className={FIELD} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
          </div>
          <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={form.isActive ? "Visible on site" : "Hidden"} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <AdminButton variant="secondary" onClick={onClose} className="flex-1">Cancel</AdminButton>
            <AdminButton onClick={() => void save()} disabled={saving || uploading} className="flex-1">
              {saving && <Spinner />} Save
            </AdminButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
