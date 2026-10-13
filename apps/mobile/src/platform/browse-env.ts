/**
 * Native stub of the browse root's address and exits (F-BROWSE-001 sections
 * 4.1, 4.4 and 4.14, OD-10): All lessons is web only, so a native build has
 * no fragment, no referrer and no page to leave to. The web variant is
 * `browse-env.web.ts`.
 */
export function takeFragment(): string {
  return '';
}

export function onFragmentChange(_handler: (raw: string) => void): () => void {
  return () => undefined;
}

export function cameFromSameOrigin(): boolean {
  return false;
}

export function canGoBack(): boolean {
  return false;
}

export function onPageVisible(_handler: () => void): () => void {
  return () => undefined;
}

export function onPageRestored(_handler: () => void): () => void {
  return () => undefined;
}

export function markBootSettled(): void {
  // No document on native.
}

export function leaveTo(_url: string): void {
  // Nowhere to go on native.
}

export function goBack(_fallbackUrl: string): void {
  // No browser history on native.
}

export function isOnline(): boolean {
  return true;
}
