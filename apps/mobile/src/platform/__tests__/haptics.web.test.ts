import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nudge, setHapticsEnabled, success, tapLight, tapMedium } from '../haptics.web';

describe('platform/haptics.web (navigator.vibrate)', () => {
  const vibrate = vi.fn<(pattern: number | number[]) => boolean>(() => true);
  beforeEach(() => {
    vibrate.mockClear();
    setHapticsEnabled(true);
    vi.stubGlobal('navigator', { vibrate });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('maps each cue to a short pattern', () => {
    tapLight();
    tapMedium();
    success();
    nudge();
    expect(vibrate.mock.calls.map((c) => c[0])).toEqual([8, 15, [10, 40, 10], 6]);
  });

  it('is silent when disabled and safe without the API', () => {
    setHapticsEnabled(false);
    tapLight();
    expect(vibrate).not.toHaveBeenCalled();
    setHapticsEnabled(true);
    vi.stubGlobal('navigator', {});
    expect(() => success()).not.toThrow();
  });
});
