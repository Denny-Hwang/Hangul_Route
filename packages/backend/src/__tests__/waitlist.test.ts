import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import app from '../index';
import { testDb } from './helpers/db';
import { openSqliteD1 } from './helpers/sqlite';
import { CONSENT_TEXT_VERSION, MAX_EMAIL_LENGTH, WAITLIST_LIMIT, normaliseEmail, waitlistLimiter } from '../routes/waitlist';

/**
 * POST /api/waitlist — the first-party launch-invite signup. Public, no auth,
 * stores an address for launch news only; never echoes it, never reveals
 * whether it was already there. Runs on the memory Db and, with
 * HR_TEST_DB=sqlite, on the real migrations.
 */
type Reply = { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string } };

async function post(body: unknown, headers: Record<string, string> = {}, env?: Record<string, unknown>) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const res = await app.request('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: raw }, env);
  const text = await res.text();
  return { res, text, status: res.status, body: JSON.parse(text) as Reply };
}

beforeEach(async () => {
  await testDb.reset();
  waitlistLimiter.reset();
  vi.useRealTimers();
});

describe('POST /api/waitlist · happy path', () => {
  it('stores a normalised address and answers with a bare success', async () => {
    const r = await post({ email: '  Learner@Example.COM ', source: 'landing', locale: 'en' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, data: { subscribed: true } });
    const rows = await testDb.waitlistEntries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: 'learner@example.com', source: 'landing', locale: 'en', consentTextVersion: CONSENT_TEXT_VERSION, unsubscribedAt: null });
    expect(Number.isNaN(Date.parse(rows[0]?.createdAt ?? ''))).toBe(false);
  });

  it('never echoes the address back, in any form', async () => {
    const r = await post({ email: 'Echo.Check@Example.com' });
    expect(r.text.toLowerCase()).not.toContain('echo.check');
    expect(r.text.toLowerCase()).not.toContain('example.com');
  });

  it('answers a repeat with the identical success body (modulo the clock) and keeps one row', async () => {
    const first = await post({ email: 'a@example.com' });
    const second = await post({ email: 'A@Example.com ' });
    expect(second.status).toBe(first.status);
    expect(second.body.ok).toBe(true);
    expect(second.body.data).toEqual(first.body.data);
    expect(await testDb.waitlistEntries()).toHaveLength(1);
  });

  it('keeps the first signup row (source, time) when the same address returns', async () => {
    await post({ email: 'a@example.com', source: 'landing' });
    const before = (await testDb.waitlistEntries())[0];
    await post({ email: 'a@example.com', source: 'footer', locale: 'es' });
    expect((await testDb.waitlistEntries())[0]).toEqual(before);
  });

  it('does not re-subscribe an address the owner removed', async () => {
    await post({ email: 'gone@example.com' });
    expect((await testDb.waitlistEntries())[0]?.unsubscribedAt).toBeNull();
    // Owner removal is a manual SQL step (docs/launch/waitlist.md); simulate its effect through the Db.
    await testDb.unsubscribeWaitlist('gone@example.com', new Date('2026-10-11T00:00:00.000Z'));
    const again = await post({ email: 'gone@example.com' });
    expect(again.status).toBe(200);
    const rows = await testDb.waitlistEntries();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.unsubscribedAt).toBe('2026-10-11T00:00:00.000Z');
  });

  it('trims surrounding whitespace, newlines included', async () => {
    expect((await post({ email: '\ta@example.com\r\n' })).status).toBe(200);
    expect((await testDb.waitlistEntries())[0]?.email).toBe('a@example.com');
  });

  it('accepts the plus tag, subdomains and long TLDs', async () => {
    for (const email of ['a+launch@example.com', 'first.last@mail.example.co.uk', 'x@example.technology', "o'brien@example.org", 'a_b-c@ex-ample.io']) {
      expect((await post({ email })).status, email).toBe(200);
    }
    expect(await testDb.waitlistEntries()).toHaveLength(5);
  });

  it('keeps only a clean source and a supported locale; anything else is stored as null', async () => {
    await post({ email: 'a@example.com', source: 'landing-hero_2', locale: 'ko' });
    await post({ email: 'b@example.com', source: '<script>alert(1)</script>', locale: 'xx' });
    await post({ email: 'c@example.com', source: 'x'.repeat(100), locale: 42 });
    await post({ email: 'd@example.com' });
    const rows = Object.fromEntries((await testDb.waitlistEntries()).map((e) => [e.email, e]));
    expect(rows['a@example.com']).toMatchObject({ source: 'landing-hero_2', locale: 'ko' });
    expect(rows['b@example.com']).toMatchObject({ source: null, locale: null });
    expect(rows['c@example.com']).toMatchObject({ source: null, locale: null });
    expect(rows['d@example.com']).toMatchObject({ source: null, locale: null });
  });

  it('sends no-store so the reply is never cached', async () => {
    expect((await post({ email: 'a@example.com' })).res.headers.get('cache-control')).toBe('no-store');
  });
});

describe('POST /api/waitlist · validation', () => {
  const BAD = [
    '',
    '   ',
    'plain',
    'no-at-sign.example.com',
    '@example.com',
    'a@',
    'a@example',
    'a@.com',
    'a@example..com',
    'a@-example.com',
    'a@example-.com',
    '.a@example.com',
    'a.@example.com',
    'a..b@example.com',
    'a b@example.com',
    'a@exa mple.com',
    'a@@example.com',
    'a@b@example.com',
    'a@example.c',
    'a@example.123',
    '<a@example.com>',
    'a@example.com\nBcc: x@y.com',
    '=a@example.com',
    '+1@example.com',
    '-a@example.com',
    'a/b@example.com',
    'a\u0000@example.com',
    'a,b@example.com',
    'a@example.com,b@example.com',
    '"quoted"@example.com',
    'a(comment)@example.com',
    'ａ@example.com',
    'a@exämple.com',
  ];
  it.each(BAD.map((e) => [JSON.stringify(e), e]))('rejects %s with 422 invalid_email and stores nothing', async (_label, email) => {
    const r = await post({ email });
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ ok: false, error: { code: 'invalid_email' } });
    expect(await testDb.waitlistEntries()).toHaveLength(0);
  });

  it.each([[undefined], [null], [42], [true], [['a@example.com']], [{ email: 'a@example.com' }]])('rejects a non-string email (%j)', async (email) => {
    const r = await post({ email });
    expect(r.status).toBe(422);
    expect(r.body.error?.code).toBe('invalid_email');
  });

  it('caps the address at 254 characters', async () => {
    const ok = `${'a'.repeat(64)}@${'d'.repeat(63)}.${'e'.repeat(63)}.${'f'.repeat(55)}.com`;
    expect(ok.length).toBeLessThanOrEqual(MAX_EMAIL_LENGTH);
    expect((await post({ email: ok })).status).toBe(200);
    const tooLong = `${'a'.repeat(64)}@${'d'.repeat(63)}.${'e'.repeat(63)}.${'f'.repeat(63)}.com`;
    expect(tooLong.length).toBeGreaterThan(MAX_EMAIL_LENGTH);
    expect((await post({ email: tooLong })).status).toBe(422);
  });

  it('rejects a local part over 64 characters', async () => {
    expect((await post({ email: `${'a'.repeat(65)}@example.com` })).status).toBe(422);
  });

  it('answers 400 bad_request for a body that is not JSON, empty, or not an object', async () => {
    for (const raw of ['not json', '', '{"email":', '[]', '"a@example.com"', 'null', '42']) {
      const r = await post(raw);
      expect(r.status, raw).toBe(400);
      expect(r.body).toMatchObject({ ok: false, error: { code: 'bad_request' } });
    }
    expect(await testDb.waitlistEntries()).toHaveLength(0);
  });

  it('rejects an oversized body without parsing it', async () => {
    const r = await post({ email: 'a@example.com', source: 'x'.repeat(5000) });
    expect(r.status).toBe(413);
    expect(r.body.error?.code).toBe('payload_too_large');
    expect(await testDb.waitlistEntries()).toHaveLength(0);
  });

  it('does not accept the address from the query string', async () => {
    const res = await app.request('/api/waitlist?email=a@example.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(422);
    expect(await testDb.waitlistEntries()).toHaveLength(0);
  });

  it('has no read route: GET answers 404', async () => {
    await post({ email: 'a@example.com' });
    const res = await app.request('/api/waitlist');
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('example.com');
  });
});

describe('POST /api/waitlist · honeypot', () => {
  it('answers the normal success but stores nothing when the hidden field is filled', async () => {
    const real = await post({ email: 'real@example.com' });
    await testDb.reset();
    const bot = await post({ email: 'bot@example.com', website: 'https://spam.example' });
    expect(bot.status).toBe(200);
    expect(bot.body.ok).toBe(true);
    expect(bot.body.data).toEqual(real.body.data);
    expect(await testDb.waitlistEntries()).toHaveLength(0);
  });

  it('treats a whitespace-only value as filled-in too (a bot typing a space)', async () => {
    await post({ email: 'bot@example.com', website: ' ' });
    expect(await testDb.waitlistEntries()).toHaveLength(0);
  });

  it('is not fooled by a non-string value', async () => {
    await post({ email: 'bot@example.com', website: 1 });
    await post({ email: 'bot2@example.com', website: { a: 1 } });
    expect(await testDb.waitlistEntries()).toHaveLength(0);
  });

  it('lets an empty hidden field through (browsers that submit the blank input)', async () => {
    expect((await post({ email: 'a@example.com', website: '' })).status).toBe(200);
    expect(await testDb.waitlistEntries()).toHaveLength(1);
  });

  it('even a honeypot hit with a malformed address gets the silent success', async () => {
    const r = await post({ email: 'nope', website: 'x' });
    expect(r.status).toBe(200);
  });
});

describe('POST /api/waitlist · rate limit', () => {
  const ip = (n: string) => ({ 'cf-connecting-ip': n });

  it(`allows ${WAITLIST_LIMIT} requests per client per window, then answers 429 with a retry hint`, async () => {
    for (let i = 0; i < WAITLIST_LIMIT; i += 1) expect((await post({ email: `u${i}@example.com` }, ip('203.0.113.1'))).status).toBe(200);
    const blocked = await post({ email: 'late@example.com' }, ip('203.0.113.1'));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error?.code).toBe('too_many_requests');
    expect(Number(blocked.res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await testDb.waitlistEntries()).map((e) => e.email)).not.toContain('late@example.com');
  });

  it('counts per client: another IP is unaffected', async () => {
    for (let i = 0; i < WAITLIST_LIMIT; i += 1) await post({ email: `u${i}@example.com` }, ip('203.0.113.1'));
    expect((await post({ email: 'other@example.com' }, ip('203.0.113.2'))).status).toBe(200);
  });

  it('counts invalid and honeypot requests too, so junk cannot be hammered for free', async () => {
    for (let i = 0; i < WAITLIST_LIMIT; i += 1) await post(i % 2 ? { email: 'nope' } : { email: 'b@example.com', website: 'x' }, ip('203.0.113.3'));
    expect((await post({ email: 'real@example.com' }, ip('203.0.113.3'))).status).toBe(429);
  });

  it('opens again after the window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T00:00:00.000Z'));
    for (let i = 0; i < WAITLIST_LIMIT; i += 1) await post({ email: `u${i}@example.com` }, ip('203.0.113.4'));
    expect((await post({ email: 'x@example.com' }, ip('203.0.113.4'))).status).toBe(429);
    vi.setSystemTime(new Date('2026-10-10T01:00:01.000Z'));
    expect((await post({ email: 'x@example.com' }, ip('203.0.113.4'))).status).toBe(200);
  });

  it('a 429 never reveals whether the address was already on the list', async () => {
    await post({ email: 'seen@example.com' }, ip('203.0.113.5'));
    for (let i = 0; i < WAITLIST_LIMIT; i += 1) await post({ email: `u${i}@example.com` }, ip('203.0.113.5'));
    const seen = await post({ email: 'seen@example.com' }, ip('203.0.113.5'));
    const fresh = await post({ email: 'fresh@example.com' }, ip('203.0.113.5'));
    expect(seen.status).toBe(429);
    expect(fresh.status).toBe(429);
    expect(seen.body.error).toEqual(fresh.body.error);
  });
});

describe('POST /api/waitlist · CORS and privacy', () => {
  const preflight = (origin: string, env?: Record<string, unknown>) =>
    app.request('/api/waitlist', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } }, env);

  it.each(['https://hangulroute.com', 'https://www.hangulroute.com', 'https://app.hangulroute.com'])('answers preflight for %s', async (origin) => {
    const res = await preflight(origin);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(origin);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type');
  });

  it('allows localhost and workers.dev previews while ALLOWED_ORIGINS is unset', async () => {
    for (const origin of ['http://localhost:3000', 'http://127.0.0.1:4173', 'https://hangul-route-web.sungjoo420.workers.dev']) {
      expect((await preflight(origin)).headers.get('access-control-allow-origin'), origin).toBe(origin);
    }
  });

  it('withholds the header from an unknown origin, and the POST itself carries the header for an allowed one', async () => {
    expect((await preflight('https://evil.example')).headers.get('access-control-allow-origin')).toBeNull();
    const r = await post({ email: 'a@example.com' }, { origin: 'https://hangulroute.com' });
    expect(r.res.headers.get('access-control-allow-origin')).toBe('https://hangulroute.com');
  });

  it('needs no Authorization header and no Clerk configuration', async () => {
    const r = await post({ email: 'a@example.com' }, {}, { ENVIRONMENT: 'development' });
    expect(r.status).toBe(200);
  });

  it('writes nothing to the console — no address, no client IP', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    await post({ email: 'private@example.com' }, { 'cf-connecting-ip': '198.51.100.7' });
    await post({ email: 'nope' }, { 'cf-connecting-ip': '198.51.100.7' });
    await post('{bad', { 'cf-connecting-ip': '198.51.100.7' });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    for (const spy of spies) spy.mockRestore();
  });

  it('does not store the client IP or any request header next to the address', async () => {
    await post({ email: 'private@example.com' }, { 'cf-connecting-ip': '198.51.100.7', 'user-agent': 'TestAgent/1' });
    expect(JSON.stringify(await testDb.waitlistEntries())).not.toMatch(/198\.51\.100|TestAgent/);
  });
});

describe('normaliseEmail', () => {
  it('trims, lower-cases and returns null for anything invalid', () => {
    expect(normaliseEmail('  A@B.IO ')).toBe('a@b.io');
    expect(normaliseEmail('nope')).toBeNull();
    expect(normaliseEmail(5)).toBeNull();
    expect(normaliseEmail(undefined)).toBeNull();
  });
});

describe('migration 0004_waitlist.sql · production safety', () => {
  const file = join(dirname(fileURLToPath(import.meta.url)), '../../../../apps/api/migrations/0004_waitlist.sql');
  const sql = readFileSync(file, 'utf8');
  const statements = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  it('only creates new objects, each guarded with IF NOT EXISTS (additive and re-runnable)', () => {
    expect(statements.length).toBeGreaterThan(0);
    for (const st of statements) expect(st, st).toMatch(/^CREATE (TABLE|INDEX) IF NOT EXISTS /);
    expect(sql).not.toMatch(/\b(DROP|ALTER|DELETE|UPDATE|INSERT|TRUNCATE|RENAME)\b/i);
  });

  it('touches only the waitlist table', () => {
    for (const st of statements) expect(st).toMatch(/waitlist/);
  });

  it('runs a second time without error and keeps the rows', async () => {
    const d1 = openSqliteD1(); // applies 0001..0004 once
    await d1.prepare('INSERT INTO waitlist (email, created_at, consent_text_version) VALUES (?, ?, ?)').bind('a@example.com', 't', 'v').run();
    for (const st of statements) await d1.prepare(st).run();
    const row = await d1.prepare('SELECT COUNT(*) AS n FROM waitlist').first<{ n: number }>();
    expect(row?.n).toBe(1);
    d1.close();
  });

  it('enforces one row per address', async () => {
    const d1 = openSqliteD1();
    const insert = () => d1.prepare('INSERT INTO waitlist (email, created_at, consent_text_version) VALUES (?, ?, ?)').bind('a@example.com', 't', 'v').run();
    await insert();
    await expect(insert()).rejects.toThrow(/UNIQUE/);
    d1.close();
  });
});
