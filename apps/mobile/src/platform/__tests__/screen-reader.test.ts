import { beforeEach, describe, expect, it, vi } from 'vitest';

const rn = vi.hoisted(() => ({
  enabled: vi.fn<() => Promise<boolean>>(),
  listeners: [] as Array<(on: boolean) => void>,
  removed: 0,
}));
vi.mock('react-native', () => ({
  AccessibilityInfo: {
    isScreenReaderEnabled: rn.enabled,
    addEventListener: (_type: string, fn: (on: boolean) => void) => {
      rn.listeners.push(fn);
      return {
        remove: () => {
          rn.removed += 1;
        },
      };
    },
  },
}));

import { isScreenReaderEnabled, subscribeScreenReader } from '../screen-reader';

beforeEach(() => {
  rn.enabled.mockReset();
  rn.listeners.length = 0;
  rn.removed = 0;
});

describe('platform/screen-reader (F-PLC-001 section 3.1 step 3, assumption 5)', () => {
  it('reads the screen reader state', async () => {
    rn.enabled.mockResolvedValue(true);
    await expect(isScreenReaderEnabled()).resolves.toBe(true);
    rn.enabled.mockResolvedValue(false);
    await expect(isScreenReaderEnabled()).resolves.toBe(false);
  });

  it('reads off when the platform cannot tell', async () => {
    rn.enabled.mockRejectedValue(new Error('unsupported'));
    await expect(isScreenReaderEnabled()).resolves.toBe(false);
    rn.enabled.mockImplementation(() => {
      throw new Error('missing');
    });
    await expect(isScreenReaderEnabled()).resolves.toBe(false);
  });

  it('forwards changes until unsubscribed', () => {
    const seen: boolean[] = [];
    const off = subscribeScreenReader((on) => seen.push(on));
    rn.listeners[0]?.(true);
    expect(seen).toEqual([true]);
    off();
    expect(rn.removed).toBe(1);
  });
});
