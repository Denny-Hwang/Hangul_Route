import { BROWSE_PASS_SESSION_KEY, BrowsePassSchema, CONSOLE_SESSION_KEY, UNLOCK_SESSION_KEY, decodeBrowseFragment, type BrowseTarget } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';

// The default env reads the learner stores; their storage and locale wrappers are native modules here.
vi.mock('../storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
  removeKey: vi.fn(async () => undefined),
}));
vi.mock('../locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: () => undefined }));

import * as native from '../browse-handoff';
import { gateScopeOf, openBrowseFromGate, type GateHandoffEnv } from '../browse-handoff.web';
import type { SessionArea } from '../grown-up-handoff.web';

/**
 * F-BROWSE-001 section 4.3, gate hand-off (BR-12a): after the PIN, the learner app writes a gate pass into this tab's
 * `sessionStorage` synchronously and only then leaves for `/browse` in the same tab. The pass and the fragment source
 * are `'gate'` whatever screen called it, and the URL holds content ids only (BD7).
 */
const NOW = 1_760_100_000_000;
const ORIGIN = 'https://app.hangulroute.com';

function memoryArea(log: string[], initial: Record<string, string> = {}): SessionArea & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      log.push(`set ${key}`);
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function harness(opts: { tiers?: ('free' | 'premium')[]; locale?: 'en' | 'es' | 'ko'; area?: SessionArea | null } = {}) {
  const log: string[] = [];
  const area = opts.area === undefined ? memoryArea(log) : opts.area;
  const env: GateHandoffEnv = {
    now: () => NOW,
    area: () => area,
    tiers: () => opts.tiers ?? ['free'],
    locale: () => opts.locale ?? 'en',
    origin: () => ORIGIN,
    assign: (url) => {
      log.push(`assign ${url}`);
    },
  };
  return { env, log, area };
}

function storedPass(area: SessionArea | null): unknown {
  const raw = area?.getItem(BROWSE_PASS_SESSION_KEY) ?? null;
  return raw === null ? null : JSON.parse(raw);
}

describe('gateScopeOf (section 4.2, gate rule)', () => {
  it('full when any profile on the device has premium access, else sampler', () => {
    expect(gateScopeOf(['free', 'premium'])).toBe('full');
    expect(gateScopeOf(['premium'])).toBe('full');
    expect(gateScopeOf(['free', 'free'])).toBe('sampler');
    expect(gateScopeOf([])).toBe('sampler');
  });
});

describe('openBrowseFromGate (web)', () => {
  it('with no target (the dashboard button): writes the gate pass, then opens /browse#s=gate', () => {
    const { env, log, area } = harness();
    expect(openBrowseFromGate(undefined, env)).toBe(true);
    expect(log).toEqual([`set ${BROWSE_PASS_SESSION_KEY}`, `assign ${ORIGIN}/browse#s=gate`]);
    expect(storedPass(area)).toEqual({ v: 1, scope: 'sampler', source: 'gate', issuedAt: NOW, seen: NOW, uiLocale: 'en' });
  });

  it('with a stage target (the Preview lessons rows): the pass first, then /browse#t=stage:<key>&s=gate', () => {
    const { env, log, area } = harness({ tiers: ['free', 'premium'], locale: 'ko' });
    expect(openBrowseFromGate({ kind: 'stage', stage: 'stage2' }, env)).toBe(true);
    expect(log).toEqual([`set ${BROWSE_PASS_SESSION_KEY}`, `assign ${ORIGIN}/browse#t=stage:stage2&s=gate`]);
    expect(storedPass(area)).toEqual({ v: 1, scope: 'full', source: 'gate', issuedAt: NOW, seen: NOW, uiLocale: 'ko' });
  });

  it('the stored pass is a valid frozen v1 BrowsePass with no person data', () => {
    const { env, area } = harness({ tiers: ['premium'] });
    openBrowseFromGate({ kind: 'stage', stage: 'stage1' }, env);
    const parsed = BrowsePassSchema.safeParse(storedPass(area));
    expect(parsed.success).toBe(true);
    expect(Object.keys(storedPass(area) as object).sort()).toEqual(['issuedAt', 'scope', 'seen', 'source', 'uiLocale', 'v']);
  });

  it('the URL holds content ids and the source only: the fragment parses back to the target and source gate', () => {
    const targets: (BrowseTarget | undefined)[] = [undefined, { kind: 'stage', stage: 'stage1' }, { kind: 'stage', stage: 'stage7' }];
    for (const target of targets) {
      const { env, log } = harness({ locale: 'es' });
      openBrowseFromGate(target, env);
      const url = (log.find((line) => line.startsWith('assign ')) ?? '').slice('assign '.length);
      expect(url.startsWith(`${ORIGIN}/browse#`)).toBe(true);
      expect(url).not.toContain('?');
      const fragment = decodeBrowseFragment(url.slice(url.indexOf('#')));
      expect(fragment).toEqual({ ok: true, target: target ?? null, source: 'gate' });
      // No locale, scope, time or profile rides in the address.
      expect(url).not.toMatch(/lang|locale|sampler|full|profile|learner|\d{6,}/);
    }
  });

  it('touches no other session key (the unlock and the console session stay as they are)', () => {
    const log: string[] = [];
    const area = memoryArea(log, { [UNLOCK_SESSION_KEY]: 'u', [CONSOLE_SESSION_KEY]: 'c' });
    const { env } = harness({ area });
    openBrowseFromGate(undefined, env);
    expect([...area.data.keys()].sort()).toEqual([BROWSE_PASS_SESSION_KEY, CONSOLE_SESSION_KEY, UNLOCK_SESSION_KEY].sort());
  });

  it('blocked storage: writes nothing, does not navigate, and reports false', () => {
    const log: string[] = [];
    const fail = (): never => {
      throw new Error('SecurityError');
    };
    const blocked: SessionArea = { getItem: fail, setItem: fail, removeItem: fail };
    const h = harness({ area: blocked });
    expect(openBrowseFromGate(undefined, { ...h.env, assign: (url) => log.push(url) })).toBe(false);
    expect(log).toEqual([]);
  });

  it('missing storage: no navigation either', () => {
    const { env, log } = harness({ area: null });
    expect(openBrowseFromGate({ kind: 'stage', stage: 'stage1' }, env)).toBe(false);
    expect(log).toEqual([]);
  });
});

describe('openBrowseFromGate (native stub, section 4.14)', () => {
  it('All lessons is web only: the stub writes nothing and reports false', () => {
    expect(native.openBrowseFromGate()).toBe(false);
    expect(native.openBrowseFromGate({ kind: 'stage', stage: 'stage1' })).toBe(false);
  });
});
