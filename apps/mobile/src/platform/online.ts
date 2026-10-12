/**
 * Native stub of the network state the grown-up entries read (F-APP-001 sections 3.6 and 3.12):
 * native builds show no grown-up entry (OD-6), so nothing native disables one. The web variant is
 * `online.web.ts`.
 */
export type OnlineListener = (online: boolean) => void;

export function isOnline(): boolean {
  return true;
}

export function subscribeOnline(_listener: OnlineListener): () => void {
  return () => undefined;
}
