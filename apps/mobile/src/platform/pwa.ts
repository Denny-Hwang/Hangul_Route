/**
 * PWA lifecycle wrapper — native no-op. The web variant (`pwa.web.ts`)
 * listens to the service worker registered by the exported shell and
 * surfaces three events for in-app banners (wireframe pwa/system-banners).
 */
export type PwaEvent = 'offline-ready' | 'update-ready' | 'went-offline' | 'back-online';

export type PwaListener = (event: PwaEvent) => void;

export function subscribePwa(_listener: PwaListener): () => void {
  return () => {};
}

export function isStandalone(): boolean {
  return true;
}

/** Apply a waiting service worker and reload; no-op on native. */
export function applyUpdate(): void {}
