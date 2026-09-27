// Shop (Press Ons) admin tab: add, edit, delete products with up to 8 drag-orderable photos
// (any photo can be set as the main photo), name, price, compare-at price, stock, category,
// extra details (ingredients/size), and show/hide (is_active). Prices set here are exactly what
// customers pay - api/create-order.ts always reads the price from this same `products` table.
// Each product also gets its own shareable /shop/<slug> page (see src/pages/Product.tsx) -
// the slug is generated from the name automatically and shown here to copy/share.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, GripVertical, ImagePlus, Loader2, Package, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog.tsx";
import { adminApi, fileToDataUrl } from "./api.ts";
import { AdminButton, AdminCard, EmptyRow, FIELD, LABEL, Spinner, Toggle } from "./ui.tsx";

type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  stock: number | null;
  sold_out: boolean;
  is_active: boolean;
  sort_order: number;
  category: string | null;
  ingredients: string | null;
  size_info: string | null;
};

type ProductImage = { id: string; product_id: string; image_url: string; sort_order: number };

type FormState = {
  name: string;
  description: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  category: string;
  ingredients: string;
  sizeInfo: string;
  imageUrl: string;
  soldOut: boolean;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  price: "",
  compareAtPrice: "",
  stock: "",
  category: "",
  ingredients: "",
  sizeInfo: "",
  imageUrl: "",
  soldOut: false,
  isActive: true,
};
// One main photo + up to 7 extra photos = 8 total, as requested.
const MAX_EXTRA_PHOTOS = 7;

export default function ProductsTab({ password }: { password: string }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<Product | null | "new">(null);

  const load = () => {
    void adminApi.list<Product>(password, "products").then(({ ok, data }) => {
      if (ok) setProducts(data.rows ?? []);
      else toast.error(data.error ?? "Could not load products");
    });
  };

  useEffect(load, [password]);

  const toggleField = async (p: Product, field: "sold_out" | "is_active", value: boolean) => {
    const { ok, data } = await adminApi.update<Product>(password, "products", { id: p.id, [field]: value });
    if (!ok) {
      toast.error(data.error ?? "Could not update product");
      return;
    }
    setProducts((prev) => prev?.map((x) => (x.id === p.id ? { ...x, [field]: value } : x)) ?? null);
  };

  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    const { ok, data } = await adminApi.remove(password, "products", p.id);
    if (!ok) {
      toast.error(data.error ?? "Could not delete product");
      return;
    }
    setProducts((prev) => prev?.filter((x) => x.id !== p.id) ?? null);
    toast.success("Product deleted");
  };

  const copyLink = (p: Product) => {
    const url = `${window.location.origin}/shop/${p.slug}`;
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Product link copied"),
      () => toast.error("Could not copy link"),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-2xl">Shop Products</h2>
        <AdminButton onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Add Product
        </AdminButton>
      </div>

      {products === null ? (
        <EmptyRow>Loading products...</EmptyRow>
      ) : products.length === 0 ? (
        <EmptyRow>No products yet. Add your first nail set.</EmptyRow>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <AdminCard key={p.id} className="flex flex-col gap-3">
              <div className="flex gap-3">
                <img src={p.image_url ?? undefined} alt={p.name} className="size-16 shrink-0 rounded-xl bg-muted object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-sm text-primary">
                    ₹{p.price} {p.compare_at_price && <span className="text-xs text-muted-foreground line-through">₹{p.compare_at_price}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">Stock: {p.stock ?? "Unlimited"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Toggle checked={p.is_active} onChange={(v) => void toggleField(p, "is_active", v)} label={p.is_active ? "Visible" : "Hidden"} />
                <Toggle checked={p.sold_out} onChange={(v) => void toggleField(p, "sold_out", v)} label={p.sold_out ? "Sold Out" : "In Stock"} />
              </div>
              <button
                onClick={() => copyLink(p)}
                className="flex items-center gap-1.5 truncate rounded-lg bg-muted px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                title="Copy shareable link"
              >
                <Copy className="size-3 shrink-0" /> <span className="truncate">/shop/{p.slug}</span>
              </button>
              <div className="flex gap-2">
                <AdminButton variant="secondary" onClick={() => setEditing(p)} className="flex-1">
                  <Pencil className="size-3.5" /> Edit
                </AdminButton>
                <AdminButton variant="danger" onClick={() => void remove(p)}>
                  <Trash2 className="size-3.5" />
                </AdminButton>
              </div>
            </AdminCard>
          ))}
        </div>
      )}

      {editing && (
        <ProductFormDialog
          password={password}
          product={editing === "new" ? null : editing}
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

// Drag-orderable photo grid: the main photo (from products.image_url) plus extra photos
// (product_images) are shown together as one list of up to 8 photos. Dragging a thumbnail
// reorders product_images; clicking the star on any extra photo swaps it with the main photo.
// Native HTML5 drag-and-drop is used here (no extra dependency) since this list is short.
function PhotoManager({ password, productId, mainImageUrl, onMainImageChange }: {
  password: string;
  productId: string;
  mainImageUrl: string;
  onMainImageChange: (url: string) => void;
}) {
  const [images, setImages] = useState<ProductImage[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = () => {
    void adminApi.list<ProductImage>(password, "product_images").then(({ ok, data }) => {
      if (ok) setImages((data.rows ?? []).filter((img) => img.product_id === productId).sort((a, b) => a.sort_order - b.sort_order));
    });
  };
  useEffect(load, [password, productId]);

  const persistOrder = async (ordered: ProductImage[]) => {
    setImages(ordered);
    await Promise.all(
      ordered.map((img, i) =>
        img.sort_order === i ? Promise.resolve() : adminApi.update(password, "product_images", { id: img.id, sort_order: i }),
      ),
    );
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { ok, data } = await adminApi.upload(password, dataUrl, "products");
      if (!ok || !data.url) throw new Error(data.error ?? "Upload failed");
      // No main photo yet - the first upload becomes the main photo directly.
      if (!mainImageUrl) {
        onMainImageChange(data.url);
        setUploading(false);
        return;
      }
      const sortOrder = images?.length ?? 0;
      const created = await adminApi.create<ProductImage>(password, "product_images", { product_id: productId, image_url: data.url, sort_order: sortOrder });
      if (!created.ok) throw new Error(created.data.error ?? "Could not save photo");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setUploading(false);
    }
  };

  const removeExtra = async (img: ProductImage) => {
    const { ok, data } = await adminApi.remove(password, "product_images", img.id);
    if (!ok) {
      toast.error(data.error ?? "Could not remove photo");
      return;
    }
    setImages((prev) => prev?.filter((x) => x.id !== img.id) ?? null);
  };

  // Swaps an extra photo into the main photo slot, moving the previous main photo into that
  // extra photo's row so no photo is lost.
  const makeMain = async (img: ProductImage) => {
    const { ok, data } = await adminApi.update<ProductImage>(password, "product_images", { id: img.id, image_url: mainImageUrl });
    if (!ok) {
      toast.error(data.error ?? "Could not update photo");
      return;
    }
    setImages((prev) => prev?.map((x) => (x.id === img.id ? { ...x, image_url: mainImageUrl } : x)) ?? null);
    onMainImageChange(img.image_url);
    toast.success("Main photo updated");
  };

  const count = images?.length ?? 0;
  const totalCount = count + (mainImageUrl ? 1 : 0);

  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId || !images) return;
    const from = images.findIndex((i) => i.id === dragId);
    const to = images.findIndex((i) => i.id === targetId);
    if (from === -1 || to === -1) return;
    const reordered = [...images];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    void persistOrder(reordered);
    setDragId(null);
  };

  return (
    <div>
      <label className={LABEL}>Photos ({totalCount}/{MAX_EXTRA_PHOTOS + 1}) - drag to reorder, star to set as main</label>
      <div className="flex flex-wrap gap-2">
        {mainImageUrl && (
          <div className="relative size-20 shrink-0">
            <img src={mainImageUrl} alt="Main" className="size-20 rounded-xl object-cover ring-2 ring-primary" />
            <span className="absolute -left-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
              <Star className="size-3" fill="currentColor" />
            </span>
          </div>
        )}
        {images?.map((img) => (
          <div
            key={img.id}
            draggable
            onDragStart={() => setDragId(img.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(img.id)}
            className="group relative size-20 shrink-0 cursor-grab active:cursor-grabbing"
          >
            <img src={img.image_url} alt="Product" className="size-20 rounded-xl object-cover" />
            <span className="absolute left-1 top-1 grid size-5 place-items-center rounded-full bg-background/80 text-muted-foreground">
              <GripVertical className="size-3" />
            </span>
            <button
              onClick={() => void makeMain(img)}
              aria-label="Set as main photo"
              title="Set as main photo"
              className="absolute -left-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-background text-muted-foreground opacity-0 ring-1 ring-border transition-opacity group-hover:opacity-100 hover:text-primary"
            >
              <Star className="size-3" />
            </button>
            <button
              onClick={() => void removeExtra(img)}
              aria-label="Remove photo"
              className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ))}
        {totalCount < MAX_EXTRA_PHOTOS + 1 && (
          <label className="inline-flex size-20 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed text-muted-foreground hover:bg-muted">
            {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload(file);
              }}
            />
          </label>
        )}
      </div>
      <p className="pt-1.5 text-xs text-muted-foreground">The main photo (starred) shows first everywhere. These appear as a swipeable gallery on the product page.</p>
    </div>
  );
}

function ProductFormDialog({ password, product, onClose, onSaved }: { password: string; product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(
    product
      ? {
          name: product.name,
          description: product.description ?? "",
          price: String(product.price),
          compareAtPrice: product.compare_at_price ? String(product.compare_at_price) : "",
          stock: product.stock !== null ? String(product.stock) : "",
          category: product.category ?? "",
          ingredients: product.ingredients ?? "",
          sizeInfo: product.size_info ?? "",
          imageUrl: product.image_url ?? "",
          soldOut: product.sold_out,
          isActive: product.is_active,
        }
      : EMPTY_FORM,
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const { ok, data } = await adminApi.upload(password, dataUrl, "products");
      if (!ok || !data.url) throw new Error(data.error ?? "Upload failed");
      setForm((f) => ({ ...f, imageUrl: data.url! }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const price = Number(form.price);
    if (!form.name.trim() || !Number.isFinite(price) || price < 0) {
      setError("Please enter a name and a valid price.");
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      compare_at_price: form.compareAtPrice ? Number(form.compareAtPrice) : null,
      stock: form.stock ? Number(form.stock) : null,
      category: form.category.trim() || null,
      ingredients: form.ingredients.trim() || null,
      size_info: form.sizeInfo.trim() || null,
      image_url: form.imageUrl || null,
      sold_out: form.soldOut,
      is_active: form.isActive,
    };
    const { ok, data } = product
      ? await adminApi.update(password, "products", { id: product.id, ...body })
      : await adminApi.create(password, "products", body);
    setSaving(false);
    if (!ok) {
      setError(data.error ?? "Could not save product");
      return;
    }
    toast.success(product ? "Product updated" : "Product added");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle className="font-serif text-2xl">{product ? "Edit Product" : "Add Product"}</DialogTitle>
        <div className="grid gap-4 pt-2">
          {product ? (
            <PhotoManager
              password={password}
              productId={product.id}
              mainImageUrl={form.imageUrl}
              onMainImageChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
            />
          ) : (
            <div>
              <label className={LABEL}>Main Photo</label>
              <div className="flex items-center gap-3">
                {form.imageUrl ? (
                  <img src={form.imageUrl} alt="Preview" className="size-16 rounded-xl object-cover" />
                ) : (
                  <div className="grid size-16 place-items-center rounded-xl bg-muted">
                    <Package className="size-6 text-muted-foreground" />
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
                      if (file) void handleUpload(file);
                    }}
                  />
                </label>
              </div>
              <p className="pt-1.5 text-xs text-muted-foreground">Save the product first, then edit it again to add up to 7 more photos.</p>
            </div>
          )}
          <div>
            <label className={LABEL}>Name</label>
            <input className={FIELD} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nude Glaze Set" />
          </div>
          <div>
            <label className={LABEL}>Description (optional)</label>
            <textarea className={`${FIELD} h-20 py-2`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Price (₹)</label>
              <input type="number" min="0" className={FIELD} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Compare-at price (optional)</label>
              <input type="number" min="0" className={FIELD} value={form.compareAtPrice} onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Stock (leave blank for unlimited)</label>
              <input type="number" min="0" className={FIELD} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Category (optional)</label>
              <input className={FIELD} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="French Sets" />
            </div>
          </div>
          <div>
            <label className={LABEL}>Ingredients (optional)</label>
            <input className={FIELD} value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} placeholder="ABS plastic, non-toxic adhesive gel" />
          </div>
          <div>
            <label className={LABEL}>Size details (optional)</label>
            <input className={FIELD} value={form.sizeInfo} onChange={(e) => setForm({ ...form, sizeInfo: e.target.value })} placeholder="24 tips, XS-XL, trimmable" />
          </div>
          {product && (
            <div>
              <label className={LABEL}>Shareable link</label>
              <div className="flex h-10 items-center rounded-xl border bg-muted/50 px-3 text-sm text-muted-foreground">/shop/{product.slug}</div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={form.isActive ? "Visible on site" : "Hidden"} />
            <Toggle checked={form.soldOut} onChange={(v) => setForm({ ...form, soldOut: v })} label={form.soldOut ? "Sold Out" : "In Stock"} />
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
