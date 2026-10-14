import { readFileSync } from 'node:fs';
import {
  OVERLAYS,
  isOverlayFieldAllowed,
  localize,
  overlayElementKey,
  overlayPrefix,
  overlayTargets,
  translatableFields,
  type Overlays,
} from '@hangul-route/content-schema';
import { LOCALE_STATUS, type LocaleStatus } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { CONTENT_OVERLAYS } from '../../logic/content-locale';
import { lp, minigameScopes, type MinigameScope } from '../../logic/minigame-config';
import { ALL_LESSON_SCOPES, LESSON_STAGE_MODULES } from './helpers/lesson-stages';
import { episodesAll } from '../episodes';
import { heritageCardsAll } from '../heritage-cards';
import { jamoAll } from '../jamo';
import { questsAll } from '../quests';
import { stages, themes } from '../stages';

/**
 * F-I18N-001 §3.6 interim: content that is still TypeScript in `src/content` (and the
 * minigame scopes) has no JSON for `scripts/validate-content.mjs` to check overlay ids
 * against, so this test does it. For every entry of the generated `OVERLAYS` whose id
 * prefix is TypeScript-resident: the entity exists in the shipped modules, every field
 * is on the allow-list, and every field lands on an English source the screens read (or
 * is a jamo hint an overlay may add). Ids of JSON content (vocab, pitem, story) are
 * the validator's business. The validator's base-aware rules are repeated here for
 * the TypeScript base: a Korean gloss never echoes the Korean it explains
 * (`overlay-circular-gloss`), and the glosses of one minigame stay distinct per locale
 * (Culture Quiz keys and locks its options by their text).
 */

type Shipped = Record<string, ReadonlyMap<string, object>>;

const SHIPPED: Shipped = {
  jamo: new Map(jamoAll.map((j) => [j.id, j])),
  card: new Map(heritageCardsAll.map((c) => [c.id, c])),
  episode: new Map(episodesAll.map((e) => [e.id, e])),
  quest: new Map(questsAll.map((q) => [q.id, q])),
  minigame: new Map([...Object.entries(minigameScopes), ...Object.entries(ALL_LESSON_SCOPES)]),
  stage: new Map(stages.map((s) => [`stage:${s.key}`, s])),
  theme: new Map(themes.map((t) => [`theme:${t.key}`, t])),
};

/**
 * Stage 1 cards that exist only in `content/episodes/stage-1/cards.json` (no TypeScript card shares the id),
 * and the jamo `gloss` (the JSON jamo's `en`, `content/episodes/stage-1/jamo.json`): JSON-base fields that
 * `scripts/validate-content.mjs` checks against that JSON (and counts for `HANGUL_ROUTE_STRICT_LOCALES`), so
 * this test leaves them alone. An overlay key of a card id the TypeScript cards also use is checked here.
 */
const JSON_ONLY_CARD_IDS: ReadonlySet<string> = new Set(
  (JSON.parse(readFileSync(new URL('../../../../../content/episodes/stage-1/cards.json', import.meta.url), 'utf8')) as { id: string }[])
    .map((card) => card.id)
    .filter((id) => !SHIPPED.card!.has(id)),
);
const jsonBaseField = (id: string, field?: string): boolean =>
  JSON_ONLY_CARD_IDS.has(id) || (field === 'gloss' && overlayPrefix(id) === 'jamo');

type Rec = Record<string | number, unknown>;
const getIn = (root: unknown, path: ReadonlyArray<string | number>): unknown =>
  path.reduce<unknown>((node, key) => (node as Rec | undefined)?.[key], root);
const same = (a: unknown, b: string): boolean => typeof a === 'string' && a.trim() === b.trim();

/**
 * Whether a Korean overlay value lands next to the very Korean it would explain: the
 * holder's `ko`, the `<name>Ko` beside a `<name>En` target, or the jamo's letter.
 */
function circular(entity: object, path: ReadonlyArray<string | number>, value: string): boolean {
  const holder = getIn(entity, path.slice(0, -1)) as Rec | undefined;
  const key = String(path[path.length - 1]);
  const sibling = key.endsWith('En') ? holder?.[`${key.slice(0, -2)}Ko`] : undefined;
  return same(holder?.ko, value) || same(sibling, value) || same((entity as Rec).char, value);
}

function overlayProblems(overlays: Overlays, shippedByPrefix: Shipped = SHIPPED): string[] {
  const problems: string[] = [];
  for (const [locale, entries] of Object.entries(overlays)) {
    for (const [id, fields] of Object.entries(entries)) {
      const shipped = shippedByPrefix[overlayPrefix(id)];
      if (shipped === undefined) continue;
      const entity = shipped.get(id);
      if (entity === undefined && jsonBaseField(id)) continue;
      if (entity === undefined) {
        problems.push(`${locale} ${id}: not in the shipped content modules`);
        continue;
      }
      for (const [field, value] of Object.entries(fields)) {
        if (jsonBaseField(id, field)) continue;
        const targets = overlayTargets(entity, field);
        if (!isOverlayFieldAllowed(id, field)) problems.push(`${locale} ${id}.${field}: not on the allow-list`);
        else if (targets.length === 0) problems.push(`${locale} ${id}.${field}: lands on no English source`);
        else if (locale === 'ko' && targets.some((path) => circular(entity, path, value))) {
          problems.push(`ko ${id}.${field}: echoes the Korean it explains (overlay-circular-gloss)`);
        }
      }
    }
  }
  return problems;
}

/** Glosses one minigame shows side by side (pairs; one turn's options) that read the same in a locale. */
function duplicateGlosses(overlays: Overlays, scopes: Readonly<Record<string, MinigameScope>> = minigameScopes): string[] {
  const problems: string[] = [];
  const check = (where: string, glosses: readonly string[]): void => {
    const seen = new Set<string>();
    for (const gloss of glosses) {
      const key = gloss.trim().toLocaleLowerCase();
      if (seen.has(key)) problems.push(`${where}: "${gloss}" twice`);
      seen.add(key);
    }
  };
  for (const locale of ['es', 'ko'] as const) {
    for (const [ref, source] of Object.entries(scopes)) {
      if (overlays[locale][ref] === undefined) continue;
      const scope = localize(source, ref, locale, overlays);
      check(`${locale} ${ref} cardPairs`, (scope.cardPairs ?? []).map((p) => p.en));
      (scope.dialogue ?? []).forEach((turn, i) => check(`${locale} ${ref} dialogue.${i}`, turn.options.map((o) => o.en)));
    }
  }
  return problems;
}

describe('content overlays for TypeScript-resident content (F-I18N-001 §3.6)', () => {
  it('every overlay id of the generated OVERLAYS exists in the shipped modules, with allowed, resolvable fields', () => {
    expect(overlayProblems(OVERLAYS)).toEqual([]);
  });

  it('the glosses of one minigame stay distinct in every locale', () => {
    expect(duplicateGlosses(OVERLAYS)).toEqual([]);
  });

  it('the lesson glosses compiled into the lesson modules (F-CURR-001 §3.10) name shipped entities with allowed, resolvable fields', () => {
    const { es, ko } = CONTENT_OVERLAYS;
    const fromIndex: Overlays = {
      es: Object.fromEntries(Object.entries(es).filter(([id]) => OVERLAYS.es[id] === undefined)),
      ko: Object.fromEntries(Object.entries(ko).filter(([id]) => OVERLAYS.ko[id] === undefined)),
    };
    expect(overlayProblems(fromIndex)).toEqual([]);
    for (const [n, mod] of Object.entries(LESSON_STAGE_MODULES)) {
      expect(overlayProblems(mod.LESSON_SCOPE_OVERLAYS), `stage ${n}`).toEqual([]);
      expect(duplicateGlosses(mod.LESSON_SCOPE_OVERLAYS, mod.LESSON_SCOPES), `stage ${n}`).toEqual([]);
      for (const locale of ['es', 'ko'] as const) {
        for (const id of Object.keys(mod.LESSON_SCOPE_OVERLAYS[locale])) expect(overlayPrefix(id), id).toBe('minigame');
      }
    }
    for (const locale of ['es', 'ko'] as const) {
      for (const id of Object.keys(fromIndex[locale])) expect(['episode', 'quest'], id).toContain(overlayPrefix(id));
    }
  });

  it('reports a minigame whose translated glosses collide (two foods both "arroz")', () => {
    const scope = minigameScopes['minigame:s1-life-q3-apply']!;
    const [first, second] = scope.cardPairs!.map(overlayElementKey);
    const bad: Overlays = {
      es: {
        'minigame:s1-life-q3-apply': {
          [`cardPairs.${first!}.gloss`]: 'Arroz',
          [`cardPairs.${second!}.gloss`]: 'arroz ',
        },
      },
      ko: {},
    };
    expect(duplicateGlosses(bad)).toEqual(['es minigame:s1-life-q3-apply cardPairs: "arroz " twice']);
  });

  it('reports a Korean gloss that echoes the Korean it explains', () => {
    const jamo = jamoAll.find((j) => j.id === 'jamo:giyeok')!;
    const pair = minigameScopes['minigame:s1-life-q3-apply']!.cardPairs![0]!;
    const slug = overlayElementKey(pair, 0);
    const bad: Overlays = {
      es: { 'jamo:giyeok': { 'exampleWord.gloss': jamo.exampleWordKo! } },
      ko: {
        'jamo:giyeok': { 'exampleWord.gloss': ` ${jamo.exampleWordKo!}`, soundHint: jamo.char, nameHint: '기역이라는 이름' },
        'minigame:s1-life-q3-apply': { [`cardPairs.${slug}.gloss`]: pair.ko },
      },
    };
    expect(overlayProblems(bad)).toEqual([
      'ko jamo:giyeok.exampleWord.gloss: echoes the Korean it explains (overlay-circular-gloss)',
      'ko jamo:giyeok.soundHint: echoes the Korean it explains (overlay-circular-gloss)',
      `ko minigame:s1-life-q3-apply.cardPairs.${slug}.gloss: echoes the Korean it explains (overlay-circular-gloss)`,
    ]);
  });

  it('addresses the prompts of real Listen & Pick rounds (lp.* ids) under listenPick.rounds', () => {
    const scope: MinigameScope = {
      kind: 'listen-pick',
      rounds: 2,
      listenPick: { rounds: [lp.sym('jamo:eo', ['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun']), lp.syl('달', ['다', '단'])] },
    };
    const shipped: Shipped = { ...SHIPPED, minigame: new Map([['minigame:lp-demo', scope]]) };
    const overlays: Overlays = {
      es: {
        'minigame:lp-demo': {
          'listenPick.rounds.lp-sym-jamo-eo.prompt': 'la letra eo',
          'listenPick.rounds.1.prompt': 'la sílaba dal',
          'rounds.lp-sym-jamo-eo.prompt': 'x',
        },
      },
      ko: {},
    };
    expect(overlayProblems(overlays, shipped)).toEqual(['es minigame:lp-demo.rounds.lp-sym-jamo-eo.prompt: not on the allow-list']);
    const es = localize(scope, 'minigame:lp-demo', 'es', overlays);
    expect(es.listenPick!.rounds.map((r) => r.prompt.en)).toEqual(['la letra eo', 'la sílaba dal']);
    expect(es.listenPick!.rounds.map((r) => [r.prompt.ko, r.prompt.romanization])).toEqual(
      scope.listenPick!.rounds.map((r) => [r.prompt.ko, r.prompt.romanization]),
    );
  });

  it('the shipped modules are keyed the way overlays address them', () => {
    expect(SHIPPED.jamo!.has('jamo:giyeok')).toBe(true);
    expect(SHIPPED.card!.has('card:book')).toBe(true);
    expect(SHIPPED.stage!.has('stage:stage1')).toBe(true);
    expect(SHIPPED.theme!.has('theme:letters')).toBe(true);
    expect(SHIPPED.minigame!.has('minigame:s1-life-q3-apply')).toBe(true);
    expect(SHIPPED.episode!.size).toBeGreaterThan(0);
    expect(SHIPPED.quest!.size).toBeGreaterThan(0);
  });

  it('leaves the JSON-base fields to the validator: a JSON-only Stage 1 card and the JSON jamo gloss', () => {
    expect(JSON_ONLY_CARD_IDS.has('card:gangaji')).toBe(true);
    expect(JSON_ONLY_CARD_IDS.has('card:mugunghwa')).toBe(false);
    const overlays: Overlays = {
      es: { 'card:gangaji': { title: 'Cachorro' }, 'jamo:giyeok': { gloss: 'G: suena como el inicio de «gato»' } },
      ko: { 'card:gangaji': { blurb: '다정한 작은 개예요.' }, 'card:mugunghwa': { nope: 'x' } },
    };
    expect(overlayProblems(overlays)).toEqual(['ko card:mugunghwa.nope: not on the allow-list']);
  });

  it('reports an unknown id, a field off the allow-list and a field that lands nowhere', () => {
    const quest = questsAll[0]!;
    const bad: Overlays = {
      es: {
        'card:not-shipped': { title: 'x' },
        'card:book': { title: 'Libro', romanization: 'x' },
        [quest.id]: { 'steps.no-such-step.title': 'x', title: 'ok' },
        'minigame:s1-life-q3-apply': { 'cardPairs.gimbap.gloss': 'Kimbap', 'cardPairs.nothing.gloss': 'x' },
        'jamo:giyeok': { soundHint: 'como la g de gato' },
        'vocab:not-checked-here': { gloss: 'x' },
      },
      ko: { 'theme:nope': { title: '없음' } },
    };
    expect(overlayProblems(bad)).toEqual([
      'es card:not-shipped: not in the shipped content modules',
      'es card:book.romanization: not on the allow-list',
      `es ${quest.id}.steps.no-such-step.title: lands on no English source`,
      'es minigame:s1-life-q3-apply.cardPairs.nothing.gloss: lands on no English source',
      'ko theme:nope: not in the shipped content modules',
    ]);
  });
});

/**
 * The English sound hints are English sound-alikes (F-QUEST-002 Appendix A), wrong for a
 * Spanish or Korean reader (F-I18N-001 §3.5.6). Until every symbol has its own
 * `jamo:*.soundHint` overlay (es: PR 15; ko: PR 16), a locale must not ship: Discover and its
 * screen-reader label would fall back to the English hint.
 */
describe('release guard: no es/ko ship without their jamo sound-hint overlays', () => {
  const missingSoundHints = (locale: 'es' | 'ko'): string[] =>
    jamoAll.filter((j) => j.soundHint !== undefined && OVERLAYS[locale]?.[j.id]?.soundHint === undefined).map((j) => j.id);
  const blockers = (status: Readonly<Record<'es' | 'ko', LocaleStatus>>): string[] =>
    (['es', 'ko'] as const).filter((locale) => status[locale] === 'shipped' && missingSoundHints(locale).length > 0);

  it('holds for the current LOCALE_STATUS', () => {
    expect(blockers(LOCALE_STATUS)).toEqual([]);
  });

  it('es has its own sound hint for all 30 symbols (PR 15)', () => {
    expect(missingSoundHints('es')).toEqual([]);
  });

  it('ko has its own sound hint for all 30 symbols, a Korean description (PR 16)', () => {
    expect(missingSoundHints('ko')).toEqual([]);
    for (const j of jamoAll) expect(OVERLAYS.ko?.[j.id]?.soundHint, j.id).not.toBe(j.char);
  });

  it('a ko sound hint never types a jamo and quotes only Korean the page already shows (PR 16 review)', () => {
    // Discover shows the jamo's example word and spoken syllable through KoreanText with romanization and
    // meaning; a hint that quotes any other word would type taught Korean the page never explains.
    const problems: string[] = [];
    for (const j of jamoAll) {
      const hint = OVERLAYS.ko?.[j.id]?.soundHint;
      if (typeof hint !== 'string') continue;
      if (/[\u1100-\u11FF\u3131-\u318E]/.test(hint)) problems.push(`${j.id}: types a jamo`);
      if (!/[\uAC00-\uD7A3]/.test(hint)) problems.push(`${j.id}: no Hangul syllable`);
      const shown = new Set([j.exampleWordKo, j.spokenKo].filter((w): w is string => typeof w === 'string'));
      for (const [, word] of hint.matchAll(/[\u2018']([^\u2019']+)[\u2019']/g)) {
        if (word !== undefined && !shown.has(word)) problems.push(`${j.id}: quotes ${word}, not its example word or spoken syllable`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('would stop a locale flipped to shipped while a sound hint overlay is missing', () => {
    for (const locale of ['es', 'ko'] as const) {
      if (missingSoundHints(locale).length === 0) continue;
      expect(blockers({ es: 'hidden', ko: 'hidden', [locale]: 'shipped' })).toEqual([locale]);
    }
    expect(jamoAll.filter((j) => j.soundHint !== undefined)).toHaveLength(30);
  });
});

/**
 * Overlay entries whose element is named by its position (a Listen & Pick round or a Discover item that
 * carries Korean has no ASCII id), and the jamo example-word gloss, are pinned to the Korean they were written
 * for (review of PR 15). If the English content reorders or inserts a round, or a jamo gets another example
 * word, the translation would quietly move to another Korean target (a learner asked to pick "árbol" for the
 * wrong word); this pin fails first. Rewording the English is fine: the pin is the Korean, not the English.
 * Regenerate a row only after checking the translation against the new Korean.
 */
const OVERLAY_KO_PINS: Readonly<Record<string, string>> = JSON.parse(
  readFileSync(new URL('./fixtures/overlay-ko-pins.json', import.meta.url), 'utf8'),
) as Record<string, string>;

/** Whether an overlay field names its element by position, or is a jamo example word (the TypeScript jamo's word). */
const pinned = (id: string, field: string): boolean => field.split('.').some((seg) => /^\d+$/.test(seg)) || (id.startsWith('jamo:') && field === 'exampleWord.gloss');

/** Every `ko` string under a node, depth first (the words of a Discover page or item). */
const nestedKo = (node: unknown): string[] =>
  Array.isArray(node)
    ? node.flatMap(nestedKo)
    : typeof node === 'object' && node !== null
      ? Object.entries(node).flatMap(([key, value]) => (key === 'ko' && typeof value === 'string' ? [value] : nestedKo(value)))
      : [];

/**
 * The Korean an overlay target explains: the holder's `ko`, or the `<name>Ko` beside a `<name>En` target. A
 * Discover page caption or item note has no Korean of its own: it is pinned to the Korean its page or item shows
 * ("엄마 / 가족"), so a reorder of pages or items still fails the pin.
 */
function koAt(entity: object, path: ReadonlyArray<string | number>): string | undefined {
  const holder = getIn(entity, path.slice(0, -1)) as Rec | undefined;
  const key = String(path[path.length - 1]);
  const ko = key.endsWith('En') ? holder?.[`${key.slice(0, -2)}Ko`] : holder?.ko;
  if (typeof ko === 'string') return ko;
  const shown = key === 'captionEn' || key === 'noteEn' ? nestedKo(holder) : [];
  return shown.length > 0 ? shown.join(' / ') : undefined;
}

function pinProblems(overlays: Overlays, pins: Readonly<Record<string, string>>, shippedByPrefix: Shipped = SHIPPED): string[] {
  const problems: string[] = [];
  for (const [locale, entries] of Object.entries(overlays)) {
    for (const [id, fields] of Object.entries(entries)) {
      const entity = shippedByPrefix[overlayPrefix(id)]?.get(id);
      if (entity === undefined) continue;
      for (const field of Object.keys(fields)) {
        if (!pinned(id, field)) continue;
        const key = `${id} ${field}`;
        const ko = overlayTargets(entity, field).map((path) => koAt(entity, path))[0];
        if (pins[key] === undefined) problems.push(`${locale} ${key}: no Korean pin (add "${key}": "${ko ?? '?'}" after checking the translation)`);
        else if (ko !== pins[key]) problems.push(`${locale} ${key}: written for ${pins[key]}, now lands on ${ko ?? 'nothing'}`);
      }
    }
  }
  return problems;
}

describe('positional overlay entries stay on the Korean they translate (review of PR 15)', () => {
  it('every positional entry and jamo example-word gloss lands on its pinned Korean', () => {
    expect(pinProblems(OVERLAYS, OVERLAY_KO_PINS)).toEqual([]);
  });

  it('reports a round that moved: the Spanish prompt would explain another word', () => {
    const scope: MinigameScope = { kind: 'listen-pick', rounds: 2, listenPick: { rounds: [lp.syl('달', ['다', '단']), lp.syl('물', ['무', '문'])] } };
    const shipped: Shipped = { ...SHIPPED, minigame: new Map([['minigame:lp-demo', scope]]) };
    const overlays: Overlays = { es: { 'minigame:lp-demo': { 'listenPick.rounds.1.prompt': 'luna' } }, ko: {} };
    expect(pinProblems(overlays, { 'minigame:lp-demo listenPick.rounds.1.prompt': '달' }, shipped)).toEqual([
      'es minigame:lp-demo listenPick.rounds.1.prompt: written for 달, now lands on 물',
    ]);
    expect(pinProblems(overlays, {}, shipped)).toEqual([
      'es minigame:lp-demo listenPick.rounds.1.prompt: no Korean pin (add "minigame:lp-demo listenPick.rounds.1.prompt": "물" after checking the translation)',
    ]);
  });

  it('pins the jamo example-word gloss to the TypeScript jamo the app ships, not the JSON jamo', () => {
    const giyeok = jamoAll.find((j) => j.id === 'jamo:giyeok')!;
    expect(OVERLAY_KO_PINS['jamo:giyeok exampleWord.gloss']).toBe(giyeok.exampleWordKo);
  });
});

/**
 * The second release guard (review of PR 15): Spanish learner content that still lives in TypeScript (quest
 * titles, blurbs, steps and Hoya lines, episode and stage titles, heritage cards, minigame glosses) has no JSON
 * for `HANGUL_ROUTE_STRICT_LOCALES` to count, so the strict validator never sees it. A locale must not ship while
 * one of these English fields has no overlay. Themes are left out: a theme overlay must not ship before a
 * short-label field replaces the first-word rule (content/i18n/README.md, "Not yet translatable").
 */
describe('release guard: no es/ko ship while TypeScript-resident content lacks its overlay', () => {
  const GUARDED = ['jamo', 'card', 'episode', 'quest', 'minigame', 'stage'] as const;
  type Sources = readonly Overlays[];
  // What the screens apply: the shipped overlays plus the lesson-cell glosses (CONTENT_OVERLAYS), and for a
  // minigame ref the scope overlays of its lesson stage (compiled by build-lessons.mjs, not build-overlays).
  const APPLIED: Sources = [CONTENT_OVERLAYS, ...Object.values(LESSON_STAGE_MODULES).map((mod) => mod.LESSON_SCOPE_OVERLAYS)];
  const missingContent = (locale: 'es' | 'ko', sources: Sources = APPLIED): string[] =>
    GUARDED.flatMap((prefix) =>
      [...SHIPPED[prefix]!.entries()].flatMap(([id, entity]) =>
        translatableFields(id, entity)
          .filter(({ field }) => !sources.some((overlays) => overlays[locale]?.[id]?.[field] !== undefined))
          .map(({ field }) => `${id} ${field}`),
      ),
    );
  const blockers = (status: Readonly<Record<'es' | 'ko', LocaleStatus>>, sources: Sources = APPLIED): string[] =>
    (['es', 'ko'] as const).filter((locale) => status[locale] === 'shipped' && missingContent(locale, sources).length > 0);

  /** A synthetic overlay that translates every guarded field in both locales, minus `drop` ("<id> <field>" rows). */
  const complete = (drop: readonly string[] = []): Overlays => {
    const overlays: Record<'es' | 'ko', Record<string, Record<string, string>>> = { es: {}, ko: {} };
    for (const prefix of GUARDED) {
      for (const [id, entity] of SHIPPED[prefix]!.entries()) {
        for (const { field } of translatableFields(id, entity)) {
          if (drop.includes(`${id} ${field}`)) continue;
          for (const locale of ['es', 'ko'] as const) overlays[locale][id] = { ...overlays[locale][id], [field]: 'x' };
        }
      }
    }
    return overlays;
  };

  it('holds for the current LOCALE_STATUS', () => {
    expect(blockers(LOCALE_STATUS)).toEqual([]);
  });

  it('counts what the screens apply: the stage 2-7 lesson fields of the lesson modules are not missing', () => {
    for (const locale of ['es', 'ko'] as const) {
      const lessonRefs = new Set(Object.keys(ALL_LESSON_SCOPES));
      expect(missingContent(locale).filter((row) => lessonRefs.has(row.split(' ')[0]!))).toEqual([]);
    }
  });

  it('would stop a locale flipped to shipped while a quest, episode or stage field is still English', () => {
    const quest = questsAll[0]!;
    const episode = episodesAll[0]!;
    const drop = [`${quest.id} title`, `${episode.id} title`, 'stage:stage1 oneLiner'];
    const sources: Sources = [complete(drop)];
    expect(missingContent('es', sources)).toEqual(expect.arrayContaining(drop));
    expect(missingContent('es', sources)).toHaveLength(drop.length);
    for (const locale of ['es', 'ko'] as const) {
      expect(blockers({ es: 'hidden', ko: 'hidden', [locale]: 'shipped' }, sources)).toEqual([locale]);
    }
    expect(blockers({ es: 'shipped', ko: 'shipped' }, [complete()])).toEqual([]);
    expect(missingContent('ko', [{ es: {}, ko: {} }])).toContain(`${quest.id} title`);
  });

  it('the jamo hints and glosses are done in both locales (PR 15 / 16)', () => {
    expect(missingContent('es').filter((row) => row.startsWith('jamo:'))).toEqual([]);
    expect(missingContent('ko').filter((row) => row.startsWith('jamo:'))).toEqual([]);
  });
});
