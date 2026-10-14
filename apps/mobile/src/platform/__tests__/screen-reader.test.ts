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

import {
  ANNOUNCE_TIMEOUT_MS,
  announceAndWait,
  announceForScreenReader,
  focusForScreenReader,
  isScreenReaderEnabled,
  subscribeScreenReader,
} from '../screen-reader';

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

  describe('announceAndWait (F-CURR-001 D-1 S3b: announce, then play)', () => {
    it('resolves at once with no screen reader, saying nothing', async () => {
      rn.enabled.mockResolvedValue(false);
      await announceAndWait('Line 1 of 2, Hoya', 300);
      expect(rn.announced).toEqual([]);
    });

    it('on iOS says the label and resolves when VoiceOver finished it', async () => {
      rn.enabled.mockResolvedValue(true);
      let resolved = false;
      const p = announceAndWait('Line 1 of 2, Hoya', 300).then(() => {
        resolved = true;
      });
      await vi.waitFor(() => expect(rn.announced).toEqual(['Line 1 of 2, Hoya']));
      expect(resolved).toBe(false);
      rn.listeners[0]?.(true);
      await p;
      expect(resolved).toBe(true);
      expect(rn.removed).toBe(1);
    });

    it('on iOS goes on after the timeout when no finish event comes', async () => {
      vi.useFakeTimers();
      try {
        rn.enabled.mockResolvedValue(true);
        const p = announceAndWait('Line 2 of 2, Teacher', 300);
        await vi.advanceTimersByTimeAsync(ANNOUNCE_TIMEOUT_MS);
        await p;
        expect(rn.removed).toBe(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('on Android waits the gap while the live region is read', async () => {
      vi.useFakeTimers();
      try {
        rn.os = 'android';
        rn.enabled.mockResolvedValue(true);
        let resolved = false;
        const p = announceAndWait('Line 1 of 2, Hoya', 300).then(() => {
          resolved = true;
        });
        await vi.advanceTimersByTimeAsync(299);
        expect(resolved).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await p;
        expect(resolved).toBe(true);
        expect(rn.announced).toEqual([]);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
