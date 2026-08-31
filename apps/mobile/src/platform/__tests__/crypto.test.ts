import { beforeEach, describe, expect, it, vi } from 'vitest';

let saltCounter = 0;

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomBytesAsync: vi.fn(async (n: number) =>
    Uint8Array.from({ length: n }, (_, i) => (saltCounter + i) % 256),
  ),
  // Deterministic stand-in for SHA-256: distinct inputs → distinct outputs.
  digestStringAsync: vi.fn(async (_algo: string, data: string) =>
    Array.from(data, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''),
  ),
}));

import * as Crypto from 'expo-crypto';
import { pinHasher } from '../crypto';

describe('platform/crypto — pinHasher', () => {
  beforeEach(() => {
    saltCounter = 0;
    vi.clearAllMocks();
  });

  it('hashes as <saltHex>:<digestHex> with a 16-byte salt', async () => {
    const stored = await pinHasher.hash('1234');
    const [saltHex, digest] = stored.split(':');
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(16);
    expect(saltHex).toMatch(/^[0-9a-f]{32}$/);
    expect(digest).toBeTruthy();
  });

  it('verifies the PIN it hashed', async () => {
    const stored = await pinHasher.hash('1234');
    expect(await pinHasher.verify('1234', stored)).toBe(true);
  });

  it('rejects a wrong PIN', async () => {
    const stored = await pinHasher.hash('1234');
    expect(await pinHasher.verify('9999', stored)).toBe(false);
  });

  it('salts per PIN, so the same PIN hashes differently each time', async () => {
    const a = await pinHasher.hash('1234');
    saltCounter = 99;
    const b = await pinHasher.hash('1234');
    expect(a).not.toBe(b);
    // ...and both still verify.
    expect(await pinHasher.verify('1234', a)).toBe(true);
    expect(await pinHasher.verify('1234', b)).toBe(true);
  });

  it('uses the native CSPRNG, never Math.random (spec §9.2)', async () => {
    const spy = vi.spyOn(Math, 'random');
    await pinHasher.hash('1234');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns false for a malformed stored value instead of throwing', async () => {
    expect(await pinHasher.verify('1234', '')).toBe(false);
    expect(await pinHasher.verify('1234', 'no-separator')).toBe(false);
    expect(await pinHasher.verify('1234', 'salt:')).toBe(false);
  });
});
