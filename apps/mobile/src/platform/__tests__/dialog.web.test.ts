import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirm } from '../dialog.web';

describe('platform/dialog.web (window.confirm)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('joins title and message and returns the browser answer', async () => {
    const c = vi.fn(() => true);
    vi.stubGlobal('confirm', c);
    await expect(confirm({ title: 'Leave?', message: 'Sure?', confirmLabel: 'Leave', cancelLabel: 'Stay' })).resolves.toBe(true);
    expect(c).toHaveBeenCalledWith('Leave?\n\nSure?');
  });

  it('resolves false when confirm is unavailable', async () => {
    vi.stubGlobal('confirm', undefined);
    await expect(confirm({ title: 'A', confirmLabel: 'Ok', cancelLabel: 'No' })).resolves.toBe(false);
  });
});
