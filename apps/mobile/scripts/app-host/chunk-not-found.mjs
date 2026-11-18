// AMENDMENTS-FINISH-2026-11 FN-3 (finding F9 of docs/launch/performance-review-2026-11.md): a missing app chunk is a 404.
//
// The app host's single-page fallback (`not_found_handling = "single-page-application"`) answers every request for a
// missing file with index.html (200). For a script chunk that kept `/_expo/static/js/*` off a year-long cache: a browser
// could keep that page under a chunk URL for a year. Workers static assets cannot scope the fallback to some paths, and a
// `_redirects` rule cannot answer 404 (only 200 rewrites and 3xx, and it runs before the asset match, so it would cover
// real chunks too). So the app host gets a minimal Worker (`worker.mjs`, wrangler.toml `main`) that the assets layer calls
// only for a request no file matches and that is not a navigation (`assets_navigation_prefers_asset_serving`, on by
// default from compatibility date 2025-04-01: a navigation miss still gets index.html from the assets layer, free): it
// answers a chunk path with 404 and hands anything else back to the assets (the same fallback as before). Real files
// never reach it, so the Worker runs only on misses. Pure, no package import: scripts/serve-dist.mjs answers e2e requests
// with the same rule.

/** The app's script chunks (Metro's web export): content-hashed names, so a file never changes at its URL. */
export const CHUNK_PREFIX = '/_expo/static/js/';

/**
 * The 404's headers: the baseline every path of the app host gets from `public/_headers` (its `/*` rule, which a Worker
 * response does not receive), plain text, and never stored, so a chunk a later deploy adds is asked for again.
 */
export const CHUNK_NOT_FOUND_HEADERS = Object.freeze([
  ['Content-Type', 'text/plain; charset=utf-8'],
  ['Cache-Control', 'no-store'],
  ['Strict-Transport-Security', 'max-age=31536000'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Frame-Options', 'SAMEORIGIN'],
  ['Content-Security-Policy', "frame-ancestors 'self'"],
]);

/** Whether `pathname` (as the request has it) is under the chunk folder; `..` segments never escape the check. */
export function isChunkPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  const normal = new URL(decoded, 'https://app.invalid').pathname;
  return normal.startsWith(CHUNK_PREFIX);
}

/** The answer for a chunk the host does not have. */
export function chunkNotFound() {
  return new Response('Not found\n', { status: 404, headers: CHUNK_NOT_FOUND_HEADERS.map(([name, value]) => [name, value]) });
}
