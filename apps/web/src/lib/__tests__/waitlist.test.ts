import { describe, expect, it, vi } from 'vitest';
import { WAITLIST_COPY } from '../../data/landing-copy';
import { looksLikeEmail, submitSignup, type SignupInput } from '../waitlist';

/**
 * Landing signup transport — launch-invite waitlist (docs/launch/waitlist.md).
 * Never throws; maps every outcome to one UI state the form renders.
 */
const ENDPOINT = 'https://api.example.test';

function reply(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function input(over: Partial<SignupInput> = {}): SignupInput {
  return { email: 'learner@example.com', website: '', endpoint: ENDPOINT, source: 'landing', locale: 'en', fetchImpl: vi.fn(async () => reply(200, { ok: true, data: { subscribed: true } })) as unknown as typeof fetch, ...over };
}

describe('looksLikeEmail (a quick check; the server decides)', () => {
  it.each(['a@b.co', ' a@b.co ', 'first.last+tag@mail.example.com'])('accepts %s', (v) => expect(looksLikeEmail(v)).toBe(true));
  it.each(['', '   ', 'plain', 'a@', '@b.co', 'a@b', 'a b@c.co', 'a@b@c.co', 'a@b..co', `${'a'.repeat(250)}@b.co`])('rejects %j', (v) => expect(looksLikeEmail(v)).toBe(false));
});

describe('submitSignup', () => {
  it('posts JSON to /api/waitlist with the trimmed email, source, locale and the honeypot field', async () => {
    const fetchImpl = vi.fn(async () => reply(200, { ok: true, data: { subscribed: true } }));
    const state = await submitSignup(input({ email: '  Learner@Example.com ', fetchImpl: fetchImpl as unknown as typeof fetch }));
    expect(state).toEqual({ kind: 'success' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${ENDPOINT}/api/waitlist`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.credentials).toBe('omit');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'Learner@Example.com', source: 'landing', locale: 'en', website: '' });
  });

  it('forwards whatever the hidden field holds, so the server can drop the bot', async () => {
    const fetchImpl = vi.fn(async () => reply(200, { ok: true }));
    await submitSignup(input({ website: 'spam', fetchImpl: fetchImpl as unknown as typeof fetch }));
    expect(JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).website).toBe('spam');
  });

  it('does not call the network for an address that is plainly wrong', async () => {
    const fetchImpl = vi.fn();
    expect(await submitSignup(input({ email: 'nope', fetchImpl: fetchImpl as unknown as typeof fetch }))).toEqual({ kind: 'invalid' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('is unavailable (and calls nothing) when the build has no API address', async () => {
    const fetchImpl = vi.fn();
    expect(await submitSignup(input({ endpoint: null, fetchImpl: fetchImpl as unknown as typeof fetch }))).toEqual({ kind: 'unavailable' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('shows the server verdict on a bad address as invalid', async () => {
    expect(await submitSignup(input({ fetchImpl: vi.fn(async () => reply(422, { ok: false, error: { code: 'invalid_email' } })) as unknown as typeof fetch }))).toEqual({ kind: 'invalid' });
  });

  it('maps 429 to rate_limited', async () => {
    expect(await submitSignup(input({ fetchImpl: vi.fn(async () => reply(429, { ok: false })) as unknown as typeof fetch }))).toEqual({ kind: 'rate_limited' });
  });

  it.each([400, 413, 500, 502, 503])('maps %i to a retryable error', async (status) => {
    expect(await submitSignup(input({ fetchImpl: vi.fn(async () => reply(status)) as unknown as typeof fetch }))).toEqual({ kind: 'error' });
  });

  it('maps a rejected fetch (offline, DNS, CORS) to a retryable error and never throws', async () => {
    expect(await submitSignup(input({ fetchImpl: vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch }))).toEqual({ kind: 'error' });
  });

  it('treats a 200 that is not JSON, or says ok:false, as an error rather than a false success', async () => {
    expect(await submitSignup(input({ fetchImpl: vi.fn(async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch }))).toEqual({ kind: 'error' });
    expect(await submitSignup(input({ fetchImpl: vi.fn(async () => reply(200, { ok: false })) as unknown as typeof fetch }))).toEqual({ kind: 'error' });
  });

  it('gives up on a request that hangs and offers a retry', async () => {
    vi.useFakeTimers();
    const hang = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))));
    const pending = submitSignup(input({ fetchImpl: hang as unknown as typeof fetch, timeoutMs: 5000 }));
    await vi.advanceTimersByTimeAsync(5001);
    expect(await pending).toEqual({ kind: 'error' });
    vi.useRealTimers();
  });

  it('the same success state comes back for a first signup and a repeat', async () => {
    const a = await submitSignup(input());
    const b = await submitSignup(input());
    expect(a).toEqual(b);
  });
});

describe('WAITLIST_COPY', () => {
  const all = Object.values(WAITLIST_COPY).join(' ');
  it('says what the owner approved and nothing commercial', () => {
    expect(WAITLIST_COPY.success).toMatch(/^You're on the list/);
    expect(WAITLIST_COPY.consentLead).toMatch(/only to send Hangul Route launch news/);
    expect(WAITLIST_COPY.consentLead).toMatch(/never sold or shared/i);
    expect(WAITLIST_COPY.consentLead).toMatch(/removed/i);
    expect(all).not.toMatch(/\$\s?\d|\bprice\b|\bStripe\b|\blifetime\b|\bsubscription\b|\bdiscount\b|\bfree\b/i);
  });
  it('never names an age range or says kids-only, and has no emoji', () => {
    expect(all).not.toMatch(/\b\d+\s*[–-]\s*\d+\b|\bfor kids\b|\bkids only\b|\bchildren only\b/i);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
