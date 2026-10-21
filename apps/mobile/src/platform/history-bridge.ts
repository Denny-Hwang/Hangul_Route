import type { EntryState, NavStateLike } from '../logic/navigation/history-sync';

/**
 * Native stub of the web history bridge (`history-bridge.web.ts`, AMENDMENTS-DISPLAY-NAV section
 * 7.2): a native build has no browser history; React Navigation handles the hardware back itself.
 */
export interface BridgeNavigation {
  getRootState(): NavStateLike | undefined;
  goBack(): void;
  addListener(type: 'state', listener: () => void): () => void;
}

export function installHistoryBridge(_navigation: BridgeNavigation): () => void {
  return () => undefined;
}

export function markLeaving(): void {
  // No browser history on native: nothing to hold while a page leaves.
}

/** [OA] Whether the page is leaving for another document; never on native. */
export function pageLeaving(): boolean {
  return false;
}

export function syncHistory(): void {
  // No browser history on native.
}

export function registerHistorySheet(_dismiss: () => void): () => void {
  return () => undefined;
}

export function useHistorySheet(_open: boolean, _dismiss: () => void): void {
  // The system back closes a native sheet through its own `onRequestClose`.
}

export function currentEntry(): EntryState | null {
  return null;
}

export function adoptLinkEntry(_browseDepth: number): void {
  // All lessons is web only.
}
