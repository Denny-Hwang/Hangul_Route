import type { ConfirmOptions } from './dialog';

/** Web variant of the confirm dialog: the browser's native confirm(). */
export type { ConfirmOptions };

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  const g = globalThis as { confirm?: (message?: string) => boolean };
  if (typeof g.confirm !== 'function') return Promise.resolve(false);
  const message = opts.message ? `${opts.title}\n\n${opts.message}` : opts.title;
  return Promise.resolve(g.confirm(message));
}
