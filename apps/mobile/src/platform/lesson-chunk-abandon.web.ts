/**
 * Give up a lesson chunk's pending load after its timeout (F-CURR-002 §10, `logic/lessons/lesson-store.ts`).
 * Metro's web loader keeps a chunk's load by its path until its script tag fires `load` or `error`, so a
 * request that hangs (flaky Wi-Fi, a captive portal) would be handed back to every later try, even once
 * the network is back. Firing `error` on the pending script makes the loader drop it and remove the tag,
 * so the next try asks again. The chunk's own bundle name (`lessons-cell-stage2-letters`) picks its tag;
 * returns how many it gave up.
 */
interface ScriptLike {
  getAttribute: (name: string) => string | null;
  dispatchEvent: (event: Event) => boolean;
}

interface DocumentLike {
  querySelectorAll: (selector: string) => ArrayLike<ScriptLike>;
  baseURI?: string;
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function abandonPendingChunk(bundleName: string, doc: DocumentLike | undefined = (globalThis as { document?: DocumentLike }).document): number {
  if (doc === undefined || typeof Event !== 'function') return 0;
  const own = new RegExp(`/_expo/static/js/web/${escapeRegExp(bundleName)}-[0-9a-f]{32}\\.js$`);
  let given = 0;
  for (const script of Array.from(doc.querySelectorAll('script[src]'))) {
    const src = script.getAttribute('src');
    if (src === null) continue;
    let path: string;
    try {
      path = new URL(src, doc.baseURI ?? 'http://localhost/').pathname;
    } catch {
      continue;
    }
    if (!own.test(path)) continue;
    script.dispatchEvent(new Event('error'));
    given += 1;
  }
  return given;
}
