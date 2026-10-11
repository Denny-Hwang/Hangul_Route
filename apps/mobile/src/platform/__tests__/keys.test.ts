import { describe, expect, it, vi } from 'vitest';
import { subscribeReaderKeys } from '../keys';

describe('platform/keys (native)', () => {
  it('is a no-op: native has no page keyboard, the back gesture goes through the navigator', () => {
    const handler = vi.fn();
    const off = subscribeReaderKeys(handler);
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});
