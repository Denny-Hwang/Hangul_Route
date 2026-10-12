import { signJwt } from '@clerk/backend/jwt';

/**
 * Real RS256 Clerk-style session tokens for tests that need verified claims
 * (F-BILL-002 B-5 step-up reads `fva`). The Worker verifies them offline
 * against `CLERK_JWT_KEY`, exactly as in production with a JWT key bound.
 */
export interface ClerkTestKeys {
  /** PEM public key for the Worker's `CLERK_JWT_KEY`. */
  jwtKey: string;
  /** Signs a session token for `sub`, valid for ten minutes, with extra claims merged in. */
  token: (sub: string, claims?: Record<string, unknown>) => Promise<string>;
}

const KID = 'ins_test_key';

export async function clerkTestKeys(): Promise<ClerkTestKeys> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const spki = Buffer.from((await crypto.subtle.exportKey('spki', pair.publicKey)) as ArrayBuffer).toString('base64');
  const jwtKey = `-----BEGIN PUBLIC KEY-----\n${(spki.match(/.{1,64}/g) ?? []).join('\n')}\n-----END PUBLIC KEY-----`;
  const privateJwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  return {
    jwtKey,
    token: async (sub, claims = {}) => {
      const now = Math.floor(Date.now() / 1000);
      return signJwt({ sub, sid: `sess_${sub}`, nbf: now - 5, exp: now + 600, ...claims }, privateJwk, { algorithm: 'RS256', header: { typ: 'JWT', kid: KID } });
    },
  };
}
