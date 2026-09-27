// When a customer signs in with Google, Supabase copies their Google profile photo into
// user_metadata (as "avatar_url" or "picture" depending on the OAuth flow). This reads
// whichever one is present so we can show their real photo instead of just an initial.
export function getGoogleAvatarUrl(user: { user_metadata?: Record<string, unknown> } | null | undefined): string | null {
  const meta = user?.user_metadata;
  if (!meta) return null;
  const url = meta.avatar_url ?? meta.picture;
  return typeof url === "string" && url.length > 0 ? url : null;
}
