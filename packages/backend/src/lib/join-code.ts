import { JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH } from '@hangul-route/content-schema';

/** Join codes — F-SPACE-001 §3.2. Six base32 characters, 30-day life, regenerable. */
export const JOIN_CODE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function randomJoinCode(): string {
  const bytes = new Uint8Array(JOIN_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  // 256 is a multiple of 32, so the modulo is unbiased.
  return Array.from(bytes, (b) => JOIN_CODE_ALPHABET.charAt(b % JOIN_CODE_ALPHABET.length)).join('');
}

/** A code no live space is using. `taken` answers "is this code live somewhere?". */
export function generateJoinCode(taken: (code: string) => boolean, maxTries = 32): string {
  for (let i = 0; i < maxTries; i += 1) {
    const code = randomJoinCode();
    if (!taken(code)) return code;
  }
  throw new Error('join code space exhausted');
}

export function joinCodeExpiry(now: Date): string {
  return new Date(now.getTime() + JOIN_CODE_TTL_MS).toISOString();
}

export function isJoinCodeLive(space: { joinCode: string | null; joinCodeExpiresAt: string | null }, now: Date): boolean {
  return !!space.joinCode && !!space.joinCodeExpiresAt && Date.parse(space.joinCodeExpiresAt) > now.getTime();
}
