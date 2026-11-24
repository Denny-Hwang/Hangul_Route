import { describe, expect, it, vi } from 'vitest';

const withOptions = vi.hoisted(() => vi.fn());
vi.mock('react-native', () => ({ AccessibilityInfo: { isScreenReaderEnabled: vi.fn(), addEventListener: vi.fn(), announceForAccessibilityWithOptions: withOptions } }));
import * as native from '../screen-reader';
import * as web from '../screen-reader.web';

describe('platform/screen-reader.web', () => {
  it('reads as off: react-native-web cannot tell and always answers true', async () => {
    await expect(web.isScreenReaderEnabled()).resolves.toBe(false);
    const off = web.subscribeScreenReader(() => undefined);
    expect(off()).toBeUndefined();
  });

  it('focuses the DOM node so assistive tech lands on it; tolerates a node without focus', () => {
    const focus = vi.fn();
    web.focusForScreenReader({ focus });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(() => web.focusForScreenReader({})).not.toThrow();
    expect(() => web.focusForScreenReader(null)).not.toThrow();
  });

  it('starts the audio after a label at once (the live region says it)', async () => {
    await expect(web.announceAndWait('Line 1 of 2, Hoya', 300)).resolves.toBeUndefined();
    expect(web.ANNOUNCE_TIMEOUT_MS).toBe(native.ANNOUNCE_TIMEOUT_MS);
  });

  it('the answer line (F-A11Y-001 §3.3, test 6): every call is a no-op, nothing reaches announceForAccessibilityWithOptions', async () => {
    expect(web.announceQueued('Right answer: n.')).toBeUndefined();
    await expect(web.announceAndWait('Right answer: n.', 0, { queue: true })).resolves.toBeUndefined();
    expect(withOptions).not.toHaveBeenCalled();
    expect(web.ANNOUNCE_QUEUED_TIMEOUT_MS).toBe(native.ANNOUNCE_QUEUED_TIMEOUT_MS);
  });

  it('has the same surface as the native file', () => {
    expect(Object.keys(web).sort()).toEqual(Object.keys(native).sort());
  });
});
