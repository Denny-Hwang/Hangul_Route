import { beforeEach, describe, expect, it, vi } from 'vitest';

const rn = vi.hoisted(() => ({
  enabled: vi.fn<() => Promise<boolean>>(),
  listeners: [] as Array<(on: boolean) => void>,
  removed: 0,
  focused: [] as number[],
  handles: new Map<object, number | null>(),
  os: 'ios' as string,
  announced: [] as string[],
}));
vi.mock('react-native', () => ({
  findNodeHandle: (node: object | null) => (node === null ? null : (rn.handles.get(node) ?? null)),
  Platform: {
    get OS() {
      return rn.os;
    },
  },
  AccessibilityInfo: {
    announceForAccessibility: (text: string) => {
      rn.announced.push(text);
    },
    setAccessibilityFocus: (tag: number) => {
      rn.focused.push(tag);
    },
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

import { announceForScreenReader, focusForScreenReader, isScreenReaderEnabled, subscribeScreenReader } from '../screen-reader';

beforeEach(() => {
  rn.enabled.mockReset();
  rn.listeners.length = 0;
  rn.removed = 0;
  rn.focused.length = 0;
  rn.handles.clear();
  rn.os = 'ios';
  rn.announced.length = 0;
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

  it('moves VoiceOver / TalkBack focus to a view (section 3.12: focus moves to the prompt on each question)', () => {
    const node = {};
    rn.handles.set(node, 42);
    focusForScreenReader(node);
    expect(rn.focused).toEqual([42]);
  });

  it('does nothing without a mounted view', () => {
    focusForScreenReader(null);
    focusForScreenReader({});
    expect(rn.focused).toEqual([]);
  });

  it('announces a new status line on iOS only (Android reads the live region)', () => {
    announceForScreenReader('Done. Now 2 days a week.');
    expect(rn.announced).toEqual(['Done. Now 2 days a week.']);
    rn.os = 'android';
    announceForScreenReader('again');
    expect(rn.announced).toHaveLength(1);
  });
});
