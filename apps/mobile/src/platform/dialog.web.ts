import type { ConfirmOptions, ConfirmPresenter } from './dialog';

/**
 * Web variant of the confirm dialog (AMENDMENTS-DISPLAY-NAV section 8, row DN-4): the
 * `ConfirmSheet` in the UI language, drawn by the `ConfirmHost` that `App` and `BrowseApp` mount,
 * with the caller's title, message and both labels, the safe choice first and focused, and the
 * browser or phone back as Cancel (the history bridge holds one entry while it is open). The
 * signature is the native one, so callers (the quest's leave, Spaces, Save my progress) need no
 * change. Before a host is mounted (a test, a crash screen) it falls back to the browser's
 * `confirm()`.
 */
export type { ConfirmOptions, ConfirmPresenter };

let presenter: ConfirmPresenter | null = null;

/** The mounted host's presenter, or `null` when it unmounts; returns the release. */
export function setConfirmPresenter(next: ConfirmPresenter | null): () => void {
  presenter = next;
  return () => {
    if (presenter === next) presenter = null;
  };
}

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  if (presenter !== null) return presenter(opts);
  const g = globalThis as { confirm?: (message?: string) => boolean };
  if (typeof g.confirm !== 'function') return Promise.resolve(false);
  const message = opts.message ? `${opts.title}\n\n${opts.message}` : opts.title;
  return Promise.resolve(g.confirm(message));
}
