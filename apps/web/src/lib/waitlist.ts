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

/** English only until the i18n layer (F-I18N-001) ships. A repeat signup shows the same success text as a first one. */
export const WAITLIST_COPY = {
  label: 'Your email',
  placeholder: 'you@somewhere.com',
  submit: 'Send me the invite',
  sending: 'Sending',
  retry: 'Try again',
  success: "You're on the list. We'll email you when Hangul Route launches.",
  invalid: 'Please enter a valid email address.',
  error: 'We could not reach the server. Check your connection and try again.',
  rateLimited: 'Too many tries. Please wait a little and try again.',
  unavailable: 'Sign-up is not working right now. Please email us and we will add you.',
  /** The consent line is `consentLead` + a mailto link reading `contactLink` + '. ' + a /privacy link reading `privacyLink`. Keep the wording in step with CONSENT_TEXT_VERSION on the API. */
  consentLead: 'We use your email only to send Hangul Route launch news. It is never sold or shared. To be removed, reply to any message or ',
  contactLink: 'contact us',
  privacyLink: 'Privacy policy',
} as const;

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
