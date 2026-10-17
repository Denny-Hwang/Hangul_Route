import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { openPresenter } from '../lecture-link';

const APP = 'https://app.hangulroute.com';

describe('opening the presenter (F-TCH-004 §3.2 step 1; LV-H: no roster hand-off)', () => {
  it('opens a new tab with window.open(url, "_blank") and clears its opener at once, as noopener would', () => {
    const tab: { opener: unknown } = { opener: { postMessage: vi.fn() } };
    const open = vi.fn(() => tab);
    expect(openPresenter({ open }, `${APP}/present#d=1.abc`)).toEqual({ ok: true });
    expect(open).toHaveBeenCalledWith(`${APP}/present#d=1.abc`, '_blank');
    expect(open.mock.calls[0]).toHaveLength(2);
    expect(tab.opener).toBeNull();
  });

  it('a blocked pop-up is reported, so the page can offer the link instead', () => {
    expect(openPresenter({ open: () => null }, `${APP}/present#d=1.abc`)).toEqual({ ok: false });
    expect(openPresenter({ open: () => undefined }, `${APP}/present#d=1.abc`)).toEqual({ ok: false });
  });

  it('a tab whose opener cannot be cleared still counts as opened', () => {
    const tab = Object.defineProperty({}, 'opener', {
      get: () => ({}),
      set: () => {
        throw new Error('read-only');
      },
    });
    expect(openPresenter({ open: () => tab }, `${APP}/present#d=1.abc`)).toEqual({ ok: true });
  });

  it('the console posts nothing to the presenter tab and listens for nothing from it', () => {
    const source = readFileSync(new URL('../lecture-link.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/postMessage\(|addEventListener\(/);
  });
});
