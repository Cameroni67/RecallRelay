/**
 * Canonical site-origin helpers for public links (QR codes, share links).
 *
 * Public/QR links must derive from the configured environment — never from a
 * hardcoded host. `NEXT_PUBLIC_SITE_URL` is the production source of truth
 * (e.g. https://recallrelay.app). When it is not configured, callers fall
 * back to the browser's own origin so local and preview deployments still
 * produce a scannable QR for the URL the visitor is actually on.
 */

export function siteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/** The safe public path for a product verification page. */
export function verifyPath(serial: string): string {
  return `/verify/${encodeURIComponent(serial)}`;
}

/** Absolute public verification URL, or null when no site URL is configured. */
export function verifyUrl(serial: string): string | null {
  const origin = siteOrigin();
  return origin ? `${origin}${verifyPath(serial)}` : null;
}
