// Turns a product name into a URL-safe slug for its own /shop/<slug> page,
// e.g. "Nude Glaze Set" -> "nude-glaze-set".
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
