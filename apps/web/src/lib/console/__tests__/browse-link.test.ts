import { BROWSE_PASS_SESSION_KEY, BrowsePassSchema, decodeBrowseFragment } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApiResult } from '../api';
import {
  accountPass,
  browseLinksShown,
  browseUrl,
  isPlainClick,
  openBrowse,
  openFreeLessons,
  resetBrowseScopeCache,
  scopeReader,
  writeBrowsePass,
  type BrowseLinkDeps,
  type BrowseScopeRead,
} from '../browse-link';
import type { ConsoleEnv } from '../config';
import type { KeyValueStorage } from '../session';

/**
 * F-BROWSE-001 BR-10 (sections 4.3 and 5.4; wireframe browse/entry-points.md): the console half of the account
 * hand-off. `openBrowse` reads the account scope (cached for the page), writes the tab's pass to `sessionStorage`
 * and goes to `/browse` in the same tab; a failed check or blocked storage never navigates.
 */
const NOW = Date.UTC(2026, 9, 13, 9, 30);
const ORIGIN = 'https://app.hangulroute.com';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

function refusingStorage(): KeyValueStorage {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => undefined,
  };
}

interface Harness {
  deps: BrowseLinkDeps;
  storage: ReturnType<typeof memoryStorage>;
  assigned: string[];
  reads: number;
}

function harness(answer: ApiResult<{ scope: 'full' | 'sampler' }> | (() => ApiResult<{ scope: 'full' | 'sampler' }>), over: Partial<BrowseLinkDeps> = {}): Harness {
  const storage = memoryStorage();
  const h: Harness = {
    storage,
    assigned: [],
    reads: 0,
    deps: {
      origin: ORIGIN,
      now: () => NOW,
      storage,
      locale: 'en',
      assign: (url) => {
        h.assigned.push(url);
      },
      readScope: async () => {
        h.reads += 1;
        return typeof answer === 'function' ? answer() : answer;
      },
      ...over,
    },
  };
  return h;
}

const storedPass = (h: Harness): unknown => JSON.parse(h.storage.data.get(BROWSE_PASS_SESSION_KEY) ?? 'null');

afterEach(() => resetBrowseScopeCache());

describe('the pass (section 4.3 step 2)', () => {
  it('holds the scope, the source, the timestamps and the locale only, and parses as a v1 pass', () => {
    const pass = accountPass('full', NOW, 'ko');
    expect(pass).toEqual({ v: 1, scope: 'full', source: 'account', issuedAt: NOW, seen: NOW, uiLocale: 'ko' });
    expect(BrowsePassSchema.safeParse(pass).success).toBe(true);
  });

  it('a fallback pass is sampler with fallback: true, whatever scope it is asked for', () => {
    const pass = accountPass('full', NOW, 'es', true);
    expect(pass).toEqual({ v: 1, scope: 'sampler', source: 'account', issuedAt: NOW, seen: NOW, fallback: true, uiLocale: 'es' });
    expect(BrowsePassSchema.safeParse(pass).success).toBe(true);
  });

  it('writeBrowsePass stores the JSON under hr:browse:pass; false with no storage or a storage that refuses', () => {
    const storage = memoryStorage();
    expect(writeBrowsePass(storage, accountPass('sampler', NOW, 'en'))).toBe(true);
    expect(JSON.parse(storage.data.get('hr:browse:pass') ?? '')).toEqual({ v: 1, scope: 'sampler', source: 'account', issuedAt: NOW, seen: NOW, uiLocale: 'en' });
    expect(writeBrowsePass(null, accountPass('sampler', NOW, 'en'))).toBe(false);
    expect(writeBrowsePass(refusingStorage(), accountPass('sampler', NOW, 'en'))).toBe(false);
  });
});

describe('the URL per entry source (section 4.4, BD7)', () => {
  it('home for the navigation, the target and source for a deep link, content ids only', () => {
    expect(browseUrl(ORIGIN, undefined, 'nav')).toBe('https://app.hangulroute.com/browse#s=nav');
    expect(browseUrl(ORIGIN, { kind: 'quest', id: 'quest:stage1-letters-q2' }, 'report')).toBe('https://app.hangulroute.com/browse#t=quest:stage1-letters-q2&s=report');
    expect(browseUrl(ORIGIN, { kind: 'stage', stage: 'stage2' }, 'route')).toBe('https://app.hangulroute.com/browse#t=stage:stage2&s=route');
    expect(browseUrl(ORIGIN, { kind: 'episode', id: 'episode:stage1-letters' }, 'plan')).toBe('https://app.hangulroute.com/browse#t=episode:stage1-letters&s=plan');
    const chip = browseUrl(ORIGIN, { kind: 'char', char: 'ㄴ' }, 'roster');
    expect(chip).toBe(`https://app.hangulroute.com/browse#t=char:${encodeURIComponent('ㄴ')}&s=roster`);
    expect(decodeBrowseFragment(new URL(chip).hash)).toEqual({ ok: true, target: { kind: 'char', char: 'ㄴ' }, source: 'roster' });
  });

  it('a target that is not a content id is dropped, so the link opens home', () => {
    expect(browseUrl(ORIGIN, { kind: 'quest', id: 'learner:lrn_1' }, 'report')).toBe('https://app.hangulroute.com/browse#s=report');
  });
});

describe('openBrowse (section 4.3 steps 2-4)', () => {
  it('full scope: writes the pass, then goes to /browse in the same tab', async () => {
    const h = harness({ ok: true, data: { scope: 'full' } });
    await expect(openBrowse(undefined, 'nav', h.deps)).resolves.toBe('opened');
    expect(storedPass(h)).toEqual({ v: 1, scope: 'full', source: 'account', issuedAt: NOW, seen: NOW, uiLocale: 'en' });
    expect(h.assigned).toEqual(['https://app.hangulroute.com/browse#s=nav']);
  });

  it('a deep link carries its target; a sampler account gets a sampler pass', async () => {
    const h = harness({ ok: true, data: { scope: 'sampler' } });
    await openBrowse({ kind: 'quest', id: 'quest:stage1-letters-q2' }, 'report', h.deps);
    expect(storedPass(h)).toMatchObject({ scope: 'sampler', source: 'account' });
    expect(h.assigned).toEqual(['https://app.hangulroute.com/browse#t=quest:stage1-letters-q2&s=report']);
  });

  it('the pass is written before the navigation starts', async () => {
    const h = harness({ ok: true, data: { scope: 'full' } });
    let seenAtAssign: string | null = null;
    h.deps.assign = () => {
      seenAtAssign = h.storage.data.get(BROWSE_PASS_SESSION_KEY) ?? null;
    };
    await openBrowse(undefined, 'nav', h.deps);
    expect(seenAtAssign).not.toBeNull();
  });

  it.each([
    ['network', { ok: false, error: 'network', status: -1 }],
    ['5xx', { ok: false, error: 'unknown', status: 503 }],
    ['401', { ok: false, error: 'unauthorized', status: 401 }],
  ] as const)('a failed check (%s) writes nothing and does not navigate', async (_name, answer) => {
    const h = harness(answer);
    await expect(openBrowse(undefined, 'nav', h.deps)).resolves.toBe('check_failed');
    expect(h.storage.data.size).toBe(0);
    expect(h.assigned).toEqual([]);
  });

  it('a check that throws counts as failed', async () => {
    const h = harness({ ok: true, data: { scope: 'full' } }, {
      readScope: () => Promise.reject(new Error('boom')),
    });
    await expect(openBrowse(undefined, 'nav', h.deps)).resolves.toBe('check_failed');
    expect(h.assigned).toEqual([]);
  });

  it('no session storage: storage_blocked without a scope read or a navigation', async () => {
    const h = harness({ ok: true, data: { scope: 'full' } }, { storage: null });
    await expect(openBrowse(undefined, 'nav', h.deps)).resolves.toBe('storage_blocked');
    expect(h.reads).toBe(0);
    expect(h.assigned).toEqual([]);
  });

  it('a storage that refuses the write: storage_blocked, no navigation', async () => {
    const h = harness({ ok: true, data: { scope: 'full' } }, { storage: refusingStorage() });
    await expect(openBrowse(undefined, 'nav', h.deps)).resolves.toBe('storage_blocked');
    expect(h.assigned).toEqual([]);
  });
});

describe('openFreeLessons, the fallback (section 4.3 step 3)', () => {
  it('writes a sampler pass with fallback: true and opens the same target, with no scope read', () => {
    const h = harness({ ok: false, error: 'network', status: -1 });
    expect(openFreeLessons({ kind: 'stage', stage: 'stage1' }, 'route', h.deps)).toBe('opened');
    expect(storedPass(h)).toEqual({ v: 1, scope: 'sampler', source: 'account', issuedAt: NOW, seen: NOW, fallback: true, uiLocale: 'en' });
    expect(h.reads).toBe(0);
    expect(h.assigned).toEqual(['https://app.hangulroute.com/browse#t=stage:stage1&s=route']);
  });

  it('storage blocked: no navigation', () => {
    const h = harness({ ok: false, error: 'network', status: -1 }, { storage: null });
    expect(openFreeLessons(undefined, 'nav', h.deps)).toBe('storage_blocked');
    expect(h.assigned).toEqual([]);
  });
});

describe('scopeReader: the scope is read once per page', () => {
  it('keeps a successful read for the page; a failed read is asked again (Try again)', async () => {
    const answers: Array<ApiResult<{ scope: 'full' | 'sampler' }>> = [
      { ok: false, error: 'network', status: -1 },
      { ok: true, data: { scope: 'full' } },
      { ok: true, data: { scope: 'sampler' } },
    ];
    let calls = 0;
    const api = {
      browseScope: async (): Promise<ApiResult<{ scope: 'full' | 'sampler' }>> => {
        const answer = answers[calls] ?? answers[answers.length - 1];
        calls += 1;
        return answer as ApiResult<{ scope: 'full' | 'sampler' }>;
      },
    };
    const read: BrowseScopeRead = scopeReader(api);
    expect((await read()).ok).toBe(false);
    expect(await read()).toEqual({ ok: true, data: { scope: 'full' } });
    expect(await scopeReader(api)()).toEqual({ ok: true, data: { scope: 'full' } });
    expect(calls).toBe(2);
  });

  it('with no API (no API address on this build) the check fails', async () => {
    const read = scopeReader(null);
    expect(await read()).toMatchObject({ ok: false });
  });
});

describe('browseLinksShown (section 4.11): behind browseEnabled() and the app origin', () => {
  const on: ConsoleEnv = { NEXT_PUBLIC_BROWSE: 'enabled' };
  it('shows on the app origin with the switch on only', () => {
    expect(browseLinksShown(ORIGIN, on)).toBe(true);
    expect(browseLinksShown(ORIGIN, {})).toBe(false);
    expect(browseLinksShown(ORIGIN, { NEXT_PUBLIC_BROWSE: 'true' })).toBe(false);
    expect(browseLinksShown('https://hangulroute.com', on)).toBe(false);
    expect(browseLinksShown('http://localhost:4173', { ...on, NEXT_PUBLIC_APP_URL: 'http://localhost:4173' })).toBe(true);
  });
});

describe('isPlainClick: a modifier click or another button is left to the browser (new tab, no pass)', () => {
  const click = (over: Partial<{ button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean }> = {}) => ({
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    defaultPrevented: false,
    ...over,
  });
  it('only a plain primary click opens through openBrowse', () => {
    expect(isPlainClick(click())).toBe(true);
    expect(isPlainClick(click({ metaKey: true }))).toBe(false);
    expect(isPlainClick(click({ ctrlKey: true }))).toBe(false);
    expect(isPlainClick(click({ shiftKey: true }))).toBe(false);
    expect(isPlainClick(click({ altKey: true }))).toBe(false);
    expect(isPlainClick(click({ button: 1 }))).toBe(false);
    expect(isPlainClick(click({ defaultPrevented: true }))).toBe(false);
  });
});
