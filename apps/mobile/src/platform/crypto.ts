import * as Crypto from 'expo-crypto';
import type { PinHasher } from '../logic/profiles/pin-hash';

/**
 * Crypto wrapper — the only sanctioned entry to expo-crypto.
 *
 * Implements the `PinHasher` port from `logic/profiles/pin-hash`: a 16-byte
 * salt from the native CSPRNG plus SHA-256, stored as `<saltHex>:<digestHex>`.
 * See F-PROF-001 §9.2 for why this and not pure-JS bcrypt (JS-thread stall,
 * silent Math.random salt fallback, and a 4-digit keyspace that no work factor
 * rescues from offline enumeration anyway).
 */

const SALT_BYTES = 16;
const SEPARATOR = ':';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function digest(saltHex: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${saltHex}${SEPARATOR}${pin}`,
  );
}

/** Length-independent compare — never short-circuit on the first bad nibble. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export const pinHasher: PinHasher = {
  async hash(pin: string): Promise<string> {
    const saltHex = toHex(await Crypto.getRandomBytesAsync(SALT_BYTES));
    return `${saltHex}${SEPARATOR}${await digest(saltHex, pin)}`;
  },

  async verify(pin: string, stored: string): Promise<boolean> {
    const [saltHex, expected] = stored.split(SEPARATOR);
    if (!saltHex || !expected) return false;
    return constantTimeEquals(await digest(saltHex, pin), expected);
  },
};
