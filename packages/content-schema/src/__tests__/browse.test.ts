import { describe, expect, it } from 'vitest';
import type { ZodTypeAny } from 'zod';
import {
  BROWSE_ACCOUNT_MAX_MS,
  BROWSE_FALLBACK_MAX_MS,
  BROWSE_FRAGMENT_MAX,
  BROWSE_GATE_IDLE_MS,
  BROWSE_GATE_MAX_MS,
  BROWSE_KEEP_MS,
  BROWSE_PASS_SESSION_KEY,
  BROWSE_EVENT_NAMES,
  BrowseKeptPassSchema,
  BrowsePassSchema,
  BrowseScopeResponseSchema,
  BrowseScopeSchema,
  BrowseSourceSchema,
  BrowseTargetSchema,
  CARD_ID_RE,
  EPISODE_ID_RE,
  EpisodeObjectSchema,
  HeritageCardSchema,
  LectureBlockSchema,
  QUEST_ID_RE,
  QuestSchema,
  TELEMETRY_EVENT_NAMES,
  buildBrowseUrl,
  decodeBrowseFragment,
  encodeBrowseFragment,
  type BrowseSource,
  type BrowseTarget,
} from '../index';

const EVERY_TARGET: BrowseTarget[] = [
  { kind: 'stage', stage: 'stage1' },
  { kind: 'stage', stage: 'stage7' },
  { kind: 'episode', id: 'episode:stage1-letters' },
  { kind: 'quest', id: 'quest:stage1-letters-q1' },
  { kind: 'story', id: 'story:sun-and-moon' },
  { kind: 'vocab-topic', id: 'vocab-topic:food' },
  { kind: 'card', id: 'card:hangul-day' },
  { kind: 'jamo', id: 'jamo:nieun' },
  { kind: 'char', char: 'ㄱ' },
  { kind: 'char', char: 'ㅣ' },
];

const EVERY_SOURCE: BrowseSource[] = ['nav', 'report', 'route', 'plan', 'roster', 'gate', 'direct'];

const pass = (over: Record<string, unknown> = {}) => ({
  v: 1,
  scope: 'full',
  source: 'account',
  issuedAt: 1_760_000_000_000,
  seen: 1_760_000_000_000,
  ...over,
});

describe('browse constants (F-BROWSE-001 §5.1)', () => {
  it('pins the limits and the session key', () => {
    expect(BROWSE_FRAGMENT_MAX).toBe(256);
    expect(BROWSE_PASS_SESSION_KEY).toBe('hr:browse:pass');
    expect(BROWSE_GATE_IDLE_MS).toBe(15 * 60 * 1000);
    expect(BROWSE_GATE_MAX_MS).toBe(60 * 60 * 1000);
    expect(BROWSE_ACCOUNT_MAX_MS).toBe(12 * 60 * 60 * 1000);
    expect(BROWSE_FALLBACK_MAX_MS).toBe(60 * 60 * 1000);
    expect(BROWSE_KEEP_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('lists the five browse telemetry names, each in TELEMETRY_EVENT_NAMES (§9)', () => {
    expect([...BROWSE_EVENT_NAMES]).toEqual([
      'browse.opened',
      'browse.item_viewed',
      'browse.preview_started',
      'browse.preview_ended',
      'browse.plans_tapped',
    ]);
    for (const name of BROWSE_EVENT_NAMES) {
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name)).toHaveLength(1);
    }
    expect(TELEMETRY_EVENT_NAMES.filter((n) => n.startsWith('browse.'))).toHaveLength(5);
  });
});

describe('scope and source enums', () => {
  it('accepts the three scopes and nothing else', () => {
    for (const s of ['full', 'sampler', 'none']) expect(BrowseScopeSchema.safeParse(s).success).toBe(true);
    expect(BrowseScopeSchema.safeParse('premium').success).toBe(false);
  });

  it('accepts the seven sources and nothing else', () => {
    for (const s of EVERY_SOURCE) expect(BrowseSourceSchema.safeParse(s).success).toBe(true);
    expect(BrowseSourceSchema.safeParse('email').success).toBe(false);
  });
});

describe('BrowseTargetSchema (§4.4)', () => {
  it('accepts every target kind', () => {
    for (const t of EVERY_TARGET) expect(BrowseTargetSchema.safeParse(t).success).toBe(true);
  });

  it.each([
    [{ kind: 'lesson', id: 'quest:a' }],
    [{ kind: 'stage', stage: 'stage8' }],
    [{ kind: 'episode', id: 'quest:a' }],
    [{ kind: 'quest', id: 'quest:A' }],
    [{ kind: 'quest', id: 'quest:' }],
    [{ kind: 'story', id: 'story:-bad' }],
    [{ kind: 'vocab-topic', id: 'vocab:food' }],
    [{ kind: 'card', id: 'card:x y' }],
    [{ kind: 'jamo', id: 'jamo:Nieun' }],
    [{ kind: 'char', char: 'ㄱㄴ' }],
    [{ kind: 'char', char: '가' }],
    [{ kind: 'char', char: 'a' }],
    [{ kind: 'quest', id: 'quest:a', learnerId: 'p1' }],
    [{ kind: 'char', char: 'ㄱ', name: 'Mina' }],
  ])('rejects %j', (t) => {
    expect(BrowseTargetSchema.safeParse(t).success).toBe(false);
  });
});

describe('exported content-id regexes', () => {
  // The regex a zod string schema checks with, read from its definition.
  const regexOf = (schema: ZodTypeAny): RegExp | undefined => {
    const def = schema._def as { checks?: { kind: string; regex?: RegExp }[] };
    return def.checks?.find((c) => c.kind === 'regex')?.regex;
  };
  const objectShape = (schema: ZodTypeAny): Record<string, ZodTypeAny> => {
    let s: ZodTypeAny = schema;
    while ('innerType' in s && typeof (s as { innerType?: unknown }).innerType === 'function') {
      s = (s as unknown as { innerType: () => ZodTypeAny }).innerType();
    }
    return (s as unknown as { shape: Record<string, ZodTypeAny> }).shape;
  };

  it('keeps the grammar the schemas always had', () => {
    expect(EPISODE_ID_RE.source).toBe('^episode:[a-z0-9-]+$');
    expect(QUEST_ID_RE.source).toBe('^quest:[a-z0-9-]+$');
    expect(CARD_ID_RE.source).toBe('^card:[a-z0-9-]+$');
  });

  it('is the very regex the episode, quest and card schemas check ids with', () => {
    expect(regexOf(objectShape(EpisodeObjectSchema).id)).toBe(EPISODE_ID_RE);
    expect(regexOf(objectShape(QuestSchema).id)).toBe(QUEST_ID_RE);
    expect(regexOf(objectShape(HeritageCardSchema).id)).toBe(CARD_ID_RE);
  });

  it('accepts and rejects ids through the schemas exactly as the exported regexes do', () => {
    const cases: [ZodTypeAny, RegExp, string[]][] = [
      [objectShape(EpisodeObjectSchema).id, EPISODE_ID_RE, ['episode:stage1-letters', 'episode:A', 'quest:x', '']],
      [objectShape(QuestSchema).id, QUEST_ID_RE, ['quest:stage1-letters-q1', 'quest:', 'quest:a b', 'card:x']],
      [objectShape(HeritageCardSchema).id, CARD_ID_RE, ['card:hangul-day', 'card:Hangul', 'card:', 'episode:x']],
    ];
    for (const [schema, re, ids] of cases) {
      for (const id of ids) expect(schema.safeParse(id).success, `${re.source} on ${JSON.stringify(id)}`).toBe(re.test(id));
    }
  });

  it('is the regex the lecture blocks use, so each grammar exists once', () => {
    const options = LectureBlockSchema.options as unknown as ZodTypeAny[];
    const byKind = (kind: string) =>
      options.find((o) => (objectShape(o).kind._def as { value: string }).value === kind) as ZodTypeAny;
    expect(regexOf(objectShape(byKind('episode')).id)).toBe(EPISODE_ID_RE);
    expect(regexOf(objectShape(byKind('quest')).id)).toBe(QUEST_ID_RE);
    const cardIds = objectShape(byKind('cards')).cardIds._def as { type: ZodTypeAny };
    expect(regexOf(cardIds.type)).toBe(CARD_ID_RE);
  });
});

describe('encodeBrowseFragment / decodeBrowseFragment', () => {
  it('round-trips every target kind with every source', () => {
    for (const target of EVERY_TARGET) {
      for (const source of EVERY_SOURCE) {
        const raw = encodeBrowseFragment({ target, source });
        expect(decodeBrowseFragment(raw)).toEqual({ ok: true, target, source });
        expect(decodeBrowseFragment(`#${raw}`)).toEqual({ ok: true, target, source });
      }
    }
  });

  it('writes ids as they are and percent-encodes a character', () => {
    expect(encodeBrowseFragment({ target: { kind: 'quest', id: 'quest:stage1-letters-q1' }, source: 'report' })).toBe(
      't=quest:stage1-letters-q1&s=report',
    );
    expect(encodeBrowseFragment({ target: { kind: 'stage', stage: 'stage1' }, source: 'route' })).toBe(
      't=stage:stage1&s=route',
    );
    expect(encodeBrowseFragment({ target: { kind: 'char', char: 'ㄱ' }, source: 'roster' })).toBe(
      `t=char:${encodeURIComponent('ㄱ')}&s=roster`,
    );
  });

  it('leaves the target out for home', () => {
    expect(encodeBrowseFragment({ source: 'nav' })).toBe('s=nav');
    expect(decodeBrowseFragment('s=gate')).toEqual({ ok: true, target: null, source: 'gate' });
    expect(decodeBrowseFragment('#s=gate')).toEqual({ ok: true, target: null, source: 'gate' });
  });

  it('accepts the parts in either order and a percent-encoded id or a raw character', () => {
    expect(decodeBrowseFragment('s=plan&t=episode:stage1-letters')).toEqual({
      ok: true,
      target: { kind: 'episode', id: 'episode:stage1-letters' },
      source: 'plan',
    });
    expect(decodeBrowseFragment('t=quest%3Astage1-letters-q2&s=report')).toEqual({
      ok: true,
      target: { kind: 'quest', id: 'quest:stage1-letters-q2' },
      source: 'report',
    });
    expect(decodeBrowseFragment('t=char:ㄴ&s=report')).toEqual({
      ok: true,
      target: { kind: 'char', char: 'ㄴ' },
      source: 'report',
    });
  });

  it('never emits a target that is not valid, so a link can never carry anything but a content id', () => {
    const bad = { kind: 'quest', id: 'Mina' } as unknown as BrowseTarget;
    expect(encodeBrowseFragment({ target: bad, source: 'report' })).toBe('s=report');
    const long = { kind: 'quest', id: `quest:${'a'.repeat(300)}` } as BrowseTarget;
    expect(encodeBrowseFragment({ target: long, source: 'plan' })).toBe('s=plan');
    const badSource = 'email' as unknown as BrowseSource;
    expect(encodeBrowseFragment({ source: badSource })).toBe('s=direct');
  });

  it.each([[''], ['#'], ['   ']])('reads %j as empty', (raw) => {
    expect(decodeBrowseFragment(raw)).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects a fragment over 256 characters before reading it', () => {
    const fill = (n: number) => `t=quest:${'a'.repeat(n)}&s=nav`;
    const at = fill(BROWSE_FRAGMENT_MAX - 't=quest:&s=nav'.length);
    expect(at).toHaveLength(BROWSE_FRAGMENT_MAX);
    expect(decodeBrowseFragment(at).ok).toBe(true);
    expect(decodeBrowseFragment(`#${at}`).ok).toBe(true);
    const over = fill(BROWSE_FRAGMENT_MAX + 1 - 't=quest:&s=nav'.length);
    expect(over).toHaveLength(BROWSE_FRAGMENT_MAX + 1);
    expect(decodeBrowseFragment(over)).toEqual({ ok: false, reason: 'too_long' });
    expect(decodeBrowseFragment(`#${over}`)).toEqual({ ok: false, reason: 'too_long' });
    expect(decodeBrowseFragment('x'.repeat(10_000))).toEqual({ ok: false, reason: 'too_long' });
  });

  it.each([
    ['t=lesson:a&s=nav'],
    ['t=quest:A&s=nav'],
    ['t=&s=nav'],
    ['t=quest&s=nav'],
    ['t=stage:stage9&s=nav'],
    ['t=char:%E3%84%B1%E3%84%B4&s=nav'],
    ['t=char:ㄱㄴ&s=nav'],
    ['t=char:%E0%A4%A&s=nav'],
    ['t=quest:a&t=quest:b&s=nav'],
    ['t=quest:a&s=nav&learner=p1'],
    ['t=quest:a&s=nav&name'],
    ['t=quest:a&&s=nav'],
  ])('rejects the target part of %j', (raw) => {
    expect(decodeBrowseFragment(raw)).toEqual({ ok: false, reason: 'bad_target' });
  });

  it.each([['t=quest:a'], ['t=quest:a&s=email'], ['t=quest:a&s='], ['s=nav&s=plan'], ['s=%E0%A4%A']])(
    'rejects the source part of %j',
    (raw) => {
      expect(decodeBrowseFragment(raw)).toEqual({ ok: false, reason: 'bad_source' });
    },
  );
});

describe('buildBrowseUrl', () => {
  it('keeps only the origin and adds the fragment', () => {
    expect(buildBrowseUrl('https://app.hangulroute.com/teach/home?x=1#y', { source: 'nav' })).toBe(
      'https://app.hangulroute.com/browse#s=nav',
    );
    expect(
      buildBrowseUrl('http://localhost:8081', { target: { kind: 'jamo', id: 'jamo:nieun' }, source: 'report' }),
    ).toBe('http://localhost:8081/browse#t=jamo:nieun&s=report');
  });

  it('never throws: a runtime without URL.origin reads the scheme and host, and a non-URL gives the same-origin path', () => {
    const RealURL = globalThis.URL;
    class NoOriginURL {
      constructor(_: string) {}
      get origin(): string {
        throw new Error('not implemented');
      }
    }
    globalThis.URL = NoOriginURL as unknown as typeof URL;
    try {
      expect(buildBrowseUrl('https://app.hangulroute.com/teach?x=1', { source: 'nav' })).toBe(
        'https://app.hangulroute.com/browse#s=nav',
      );
    } finally {
      globalThis.URL = RealURL;
    }
    expect(buildBrowseUrl('not a url', { source: 'gate' })).toBe('/browse#s=gate');
    expect(buildBrowseUrl('app.hangulroute.com', { source: 'gate' })).toBe('/browse#s=gate');
    expect(buildBrowseUrl('', { source: 'nav' })).toBe('/browse#s=nav');
  });
});

describe('BrowsePassSchema (§4.3)', () => {
  it('accepts an account pass, a gate pass, a fallback and a UI locale', () => {
    expect(BrowsePassSchema.safeParse(pass()).success).toBe(true);
    expect(BrowsePassSchema.safeParse(pass({ source: 'gate', scope: 'sampler' })).success).toBe(true);
    expect(BrowsePassSchema.safeParse(pass({ scope: 'sampler', fallback: true })).success).toBe(true);
    expect(BrowsePassSchema.safeParse(pass({ uiLocale: 'es' })).success).toBe(true);
    expect(BrowsePassSchema.safeParse(pass({ issuedAt: 0, seen: 0 })).success).toBe(true);
  });

  it.each([['accountId', 'acc_1'], ['email', 'a@b.c'], ['learnerId', 'p1'], ['spaceId', 'sp_1'], ['name', 'Mina']])(
    'rejects an extra %s',
    (key, value) => {
      expect(BrowsePassSchema.safeParse(pass({ [key]: value })).success).toBe(false);
    },
  );

  it.each([
    [{ v: 2 }],
    [{ scope: 'none' }],
    [{ source: 'kept' }],
    [{ issuedAt: -1 }],
    [{ issuedAt: 1.5 }],
    [{ seen: -1 }],
    [{ seen: 0.25 }],
    [{ fallback: false }],
    [{ uiLocale: 'fr' }],
    [{ issuedAt: 1000, seen: 999 }],
  ])('rejects %j', (over) => {
    expect(BrowsePassSchema.safeParse(pass(over)).success).toBe(false);
  });
});

describe('BrowseKeptPassSchema and BrowseScopeResponseSchema', () => {
  it('accepts a kept pass and nothing extra', () => {
    expect(BrowseKeptPassSchema.safeParse({ v: 1, scope: 'full', keptAt: 5 }).success).toBe(true);
    expect(BrowseKeptPassSchema.safeParse({ v: 1, scope: 'sampler', keptAt: 0 }).success).toBe(true);
    expect(BrowseKeptPassSchema.safeParse({ v: 1, scope: 'none', keptAt: 5 }).success).toBe(false);
    expect(BrowseKeptPassSchema.safeParse({ v: 1, scope: 'full', keptAt: -5 }).success).toBe(false);
    expect(BrowseKeptPassSchema.safeParse({ v: 1, scope: 'full', keptAt: 5, accountId: 'a' }).success).toBe(false);
  });

  it('accepts a full or sampler scope response and nothing else', () => {
    expect(BrowseScopeResponseSchema.safeParse({ scope: 'full' }).success).toBe(true);
    expect(BrowseScopeResponseSchema.safeParse({ scope: 'sampler' }).success).toBe(true);
    expect(BrowseScopeResponseSchema.safeParse({ scope: 'none' }).success).toBe(false);
    expect(BrowseScopeResponseSchema.safeParse({ scope: 'full', email: 'a@b.c' }).success).toBe(false);
  });
});
