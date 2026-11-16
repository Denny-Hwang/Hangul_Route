import { afterEach, describe, expect, it, vi } from 'vitest';
import { id } from '../store';

/** [AU] AMENDMENTS-AUDIT-2026-11 AU-6 (audit SEC-8): server ids come from the crypto source. */
describe('id(): a record id from the crypto source', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the shape `prefix:` plus 12 characters of 0-9 a-z, so every id pattern still matches', () => {
    for (const prefix of ['space', 'profile', 'relink', 'plan', 'event', 'ent', 'bev']) {
      const value = id(prefix);
      expect(value).toMatch(new RegExp(`^${prefix}:[0-9a-z]{12}$`));
      expect(value).toMatch(new RegExp(`^${prefix}:[a-z0-9-]+$`)); // the pattern the schemas and routes check
    }
  });

  it('never calls Math.random and reads crypto.getRandomValues', () => {
    const random = vi.spyOn(Math, 'random');
    const secure = vi.spyOn(crypto, 'getRandomValues');
    id('space');
    expect(random).not.toHaveBeenCalled();
    expect(secure).toHaveBeenCalled();
  });

  it('does not repeat over many ids', () => {
    const seen = new Set(Array.from({ length: 5000 }, () => id('relink')));
    expect(seen.size).toBe(5000);
  });

  it('throws away bytes that would favour some characters (252 to 255) and draws again', () => {
    let call = 0;
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
      const bytes = array as unknown as Uint8Array;
      // First draw: every byte is rejected. Later draws: 0, 1, 2, ... (all kept).
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = call === 0 ? 255 : i;
      call += 1;
      return array;
    });
    expect(id('plan')).toBe('plan:0123456789ab');
    expect(call).toBe(2);
  });

  it('maps a byte to its character by remainder: 35 is z, 36 wraps to 0, 251 is z', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
      const bytes = array as unknown as Uint8Array;
      const values = [35, 36, 251];
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = values[i % values.length] ?? 0;
      return array;
    });
    expect(id('ent')).toBe('ent:z0zz0zz0zz0z');
  });
});
