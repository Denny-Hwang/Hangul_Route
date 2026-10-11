import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ AccessibilityInfo: { isScreenReaderEnabled: vi.fn(), addEventListener: vi.fn() } }));
import * as native from '../screen-reader';
import * as web from '../screen-reader.web';

describe('platform/screen-reader.web', () => {
  it('reads as off: react-native-web cannot tell and always answers true', async () => {
    await expect(web.isScreenReaderEnabled()).resolves.toBe(false);
    const off = web.subscribeScreenReader(() => undefined);
    expect(off()).toBeUndefined();
  });

  it('has the same surface as the native file', () => {
    expect(Object.keys(web).sort()).toEqual(Object.keys(native).sort());
  });
});
