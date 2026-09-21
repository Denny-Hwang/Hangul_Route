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

/** Inputs for `logic/pwa/install-guide`; native builds never show the guide. */
export function installEnv(): { userAgent: string; standalone: boolean; hasPromptEvent: boolean; isWeb: boolean } {
  return { userAgent: '', standalone: true, hasPromptEvent: false, isWeb: false };
}

/** Fire the captured browser install prompt; resolves true when accepted. */
export function promptInstall(): Promise<boolean> {
  return Promise.resolve(false);
}

/** Service worker controls the page (app is cached for offline). */
export function isOfflineReady(): boolean {
  return true;
}

/** The app's own URL (for copy-link fallbacks); '' on native. */
export function appUrl(): string {
  return '';
}

/** Copy text for the in-app-browser fallback; false when unsupported. */
export function copyText(_text: string): Promise<boolean> {
  return Promise.resolve(false);
}
