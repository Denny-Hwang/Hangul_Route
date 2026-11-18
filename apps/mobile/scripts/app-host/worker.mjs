// The app host's Worker (AMENDMENTS-FINISH-2026-11 FN-3; wrangler.toml `main`). Static assets answer every request a
// file matches and every navigation (index.html for a missing one) before this runs; it sees only the other misses. A
// missing app chunk gets 404 (chunk-not-found.mjs), so `/_expo/static/js/*` can be cached for a year; anything else goes
// back to the assets binding, whose single-page fallback answers it as it did before the Worker existed.
import { chunkNotFound, isChunkPath } from './chunk-not-found.mjs';

export default {
  /**
   * @param {Request} request
   * @param {{ ASSETS: { fetch: (request: Request) => Promise<Response> } }} env
   */
  async fetch(request, env) {
    if (isChunkPath(new URL(request.url).pathname)) return chunkNotFound();
    return env.ASSETS.fetch(request);
  },
};
