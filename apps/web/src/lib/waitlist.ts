import { en } from '@hangul-route/i18n';

/**
 * Landing launch-invite signup — transport and copy (docs/launch/waitlist.md).
 * Talks to POST /api/waitlist on the API Worker (packages/backend/src/routes/waitlist.ts).
 * Never throws: every outcome maps to one state the form renders.
 */
export type WaitlistState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'success' }
  | { kind: 'invalid' }
  | { kind: 'rate_limited' }
  | { kind: 'error' }
  | { kind: 'unavailable' };

/**
 * The form's English words (`messages/en/landing.ts` → `landing.waitlist`, F-I18N-001 PR 11a). A repeat signup
 * shows the same success text as a first one. The consent line is `consentLead` + a mailto link reading
 * `contactLink` + '. ' + a /privacy link reading `privacyLink`; keep it in step with CONSENT_TEXT_VERSION on the API.
 */
export const WAITLIST_COPY = en.landing.waitlist;

const MAX_EMAIL_LENGTH = 254;
const REQUEST_TIMEOUT_MS = 15_000;

/** A quick shape check so an obvious typo never costs a request. The server makes the real decision. */
export function looksLikeEmail(raw: string): boolean {
  const email = raw.trim();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

export interface SignupInput {
  email: string;
  /** The honeypot field's value: empty for a person. */
  website: string;
  /** API Worker origin from the build (apiBaseUrl()); null when this build has none. */
  endpoint: string | null;
  source: string;
  locale: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function submitSignup(input: SignupInput): Promise<WaitlistState> {
  if (!looksLikeEmail(input.email)) return { kind: 'invalid' };
  if (!input.endpoint) return { kind: 'unavailable' };
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${input.endpoint}/api/waitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      signal: controller.signal,
      body: JSON.stringify({ email: input.email.trim(), source: input.source, locale: input.locale, website: input.website }),
    });
    if (res.status === 429) return { kind: 'rate_limited' };
    if (res.status === 422) return { kind: 'invalid' };
    if (res.status !== 200) return { kind: 'error' };
    const body = (await res.json().catch(() => null)) as { ok?: unknown } | null;
    return body?.ok === true ? { kind: 'success' } : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
