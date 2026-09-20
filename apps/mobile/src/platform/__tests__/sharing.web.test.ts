import { describe, expect, it } from 'vitest';
import { isShareAvailable, shareSnapshot } from '../sharing.web';

describe('platform/sharing.web', () => {
  it('reports sharing unavailable so the Share button stays hidden', async () => {
    expect(await isShareAvailable()).toBe(false);
    expect(await shareSnapshot({ viewRef: { current: null }, filename: 'x' })).toEqual({
      ok: false,
      reason: 'share-unavailable',
    });
  });
});
