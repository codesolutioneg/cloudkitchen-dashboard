/**
 * Rewrite localhost / internal upload URLs to the public API origin.
 */
export function normalizePublicAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    "https://api.cloud-kitchen.code-solution.org";
  const publicOrigin = apiBase.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
  if (/localhost|127\.0\.0\.1/i.test(publicOrigin)) return url;
  return url.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, publicOrigin);
}
