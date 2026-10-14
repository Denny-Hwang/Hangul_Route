import { readFileSync } from 'node:fs';
import {
  HeritageCardSchema,
  JamoSchema,
  QuestSchema,
  ROMANIZATION_EXCEPTIONS,
  checkConsistency,
  checkJamoRomanization,
  checkProse,
  checkFrameRomanization,
  checkRomanization,
  discoverItemTexts,
  formatRomanizationFinding,
  lineOfText,
  type RomanizationEntry,
  type RomanizationIssue,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { minigameScopes } from '../../logic/minigame-config';
import { HANGUL_CHECK_WORDS, buildHangulCheck } from '../../logic/stage1/hangul-check';
import { PAUSE_WORD } from '../../logic/lecture/content';
import { AVATAR_PRESETS } from '../../logic/profiles/avatar-catalog';
import { episodesAll } from '../episodes';
import { heritageCardsAll } from '../heritage-cards';
import { jamoAll } from '../jamo';
import { questsAll } from '../quests';
import { LESSON_EPISODES, LESSON_QUESTS } from '../__generated__/lessons-index';
import { LESSON_STAGE_MODULES } from './helpers/lesson-stages';

// F-CNT-002 PR 3, source class B1 (mobile TS data): the romanization that ships in the app is
// Revised Romanization, unhyphenated, and every taught Korean string carries one (R1 to R7).
// Findings print as `::error file=<path>,line=<n>::<rule>: <message>`.

const REPO = new URL('../../../../../', import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, REPO), 'utf8');
const F = {
  cards: 'apps/mobile/src/content/heritage-cards.ts',
  jamo: 'apps/mobile/src/content/jamo.ts',
  quests: 'apps/mobile/src/content/quests.ts',
  episodes: 'apps/mobile/src/content/episodes.ts',
  scopes: 'apps/mobile/src/logic/minigame-config.ts',
  avatars: 'apps/mobile/src/logic/profiles/avatar-catalog.ts',
  lecture: 'apps/mobile/src/logic/lecture/content.ts',
  check: 'apps/mobile/src/logic/stage1/hangul-check.ts',
} as const;
const sources = new Map<string, string>(Object.values(F).map((p) => [p, read(p)]));
const HANGUL = /[가-힣]/;
const isLoneJamo = (ko: string): boolean => jamoAll.some((j) => j.char === ko);
const ctx = { exceptions: ROMANIZATION_EXCEPTIONS };

const out = (file: string, ko: string, issues: RomanizationIssue[]): string[] =>
  issues.map((i) => formatRomanizationFinding(file, lineOfText(sources.get(file) ?? '', ko), i));

/** R1 to R4 for one pair; an absent or empty romanization is R4. */
function pair(file: string, ko: string, given: string | undefined): string[] {
  return out(file, ko, checkRomanization(ko, given ?? '', ctx));
}

const entries: RomanizationEntry[] = [];
const koWords = new Set<string>();
function note(file: string, ko: string, romanization: string | undefined): void {
  if (HANGUL.test(ko)) koWords.add(ko);
  if (romanization !== undefined && romanization !== '' && HANGUL.test(ko)) {
    entries.push({ ko, romanization, where: `${file}:${lineOfText(sources.get(file) ?? '', ko) ?? 0}` });
  }
}

describe('heritage cards romanization (B1)', () => {
  it('every subtitleKo has a Revised Romanization without hyphens (R1 to R4)', () => {
    const found = heritageCardsAll.flatMap((c) => {
      if (c.subtitleKo === undefined) return [];
      note(F.cards, c.subtitleKo, c.romanization);
      return pair(F.cards, c.subtitleKo, c.romanization);
    });
    expect(found).toEqual([]);
  });

  it('parses with HeritageCardSchema (subtitleKo requires romanization)', () => {
    for (const c of heritageCardsAll) {
      expect(HeritageCardSchema.safeParse(c).success, c.id).toBe(true);
    }
  });

  it('spells the audit words the way they are said', () => {
    const ro = (id: string) => heritageCardsAll.find((c) => c.id === id)?.romanization;
    expect(ro('card:hangul-day')).toBe('hangeullal');
    expect(ro('card:yutnori')).toBe('yunnori');
    expect(ro('card:origami')).toBe('jongijeopgi');
    expect(heritageCardsAll.find((c) => c.id === 'card:family-table')?.subtitleKo).toBe('가족 식탁');
    expect(ro('card:family-table')).toBe('gajok siktak');
  });
});

describe('jamo romanization (B1)', () => {
  it('every jamo parses, and its sound value is a listed value with a standard letter name (R7)', () => {
    const found: string[] = [];
    for (const j of jamoAll) {
      expect(JamoSchema.safeParse(j).success, j.id).toBe(true);
      found.push(...out(F.jamo, `'${j.char}'`, checkJamoRomanization(j.char, j.romanization)));
    }
    expect(found).toEqual([]);
    expect(jamoAll.find((j) => j.id === 'jamo:ieung')?.romanization).toBe('silent/ng');
  });

  it('every example word carries its Revised Romanization (R1 to R4)', () => {
    const found = jamoAll.flatMap((j) => {
      if (j.exampleWordKo === undefined) return [];
      note(F.jamo, j.exampleWordKo, j.exampleWordRomanization);
      return pair(F.jamo, j.exampleWordKo, j.exampleWordRomanization);
    });
    expect(found).toEqual([]);
  });

  it('every spoken form and letter name is romanized the way it is said', () => {
    const found = jamoAll.flatMap((j) => [
      ...(j.spokenKo === undefined ? [] : pair(F.jamo, j.spokenKo, j.spokenRomanization)),
      ...(j.nameKo === undefined ? [] : pair(F.jamo, j.nameKo, j.nameEn)),
    ]);
    expect(found).toEqual([]);
  });

  it('all 30 symbols carry a spoken form with its romanization (they live on the records since F-AUDIO-004 A-2)', () => {
    expect(jamoAll).toHaveLength(30);
    expect(jamoAll.filter((j) => j.spokenKo === undefined || j.spokenRomanization === undefined)).toEqual([]);
  });
});

describe('minigame scopes romanization (B1)', () => {
  it('every taught Korean string has a Revised Romanization (R1 to R4)', () => {
    const found: string[] = [];
    const check = (ref: string, ko: string, given: string | undefined): void => {
      note(F.scopes, ko, given);
      found.push(...pair(F.scopes, ko, given).map((m) => `${ref}: ${m}`));
    };
    for (const [ref, s] of Object.entries(minigameScopes)) {
      for (const p of s.cardPairs ?? []) check(ref, p.ko, p.romanization);
      for (const p of s.syllables ?? []) check(ref, p.ko, p.romanization);
      for (const p of s.storySteps ?? []) {
        if (p.labelKo !== undefined) check(ref, p.labelKo, p.romanization);
      }
      for (const d of s.dialogue ?? []) {
        check(ref, d.npcKo, d.npcRomanization);
        for (const o of d.options) check(ref, o.ko, o.romanization);
      }
      for (const r of s.listenPick?.rounds ?? []) {
        check(ref, r.prompt.ko, r.prompt.romanization);
        for (const o of r.options) {
          if (o.text === undefined) continue;
          // A written-symbol option (ㅓ) carries the symbol's sound value, the jamo rule (R7).
          if (isLoneJamo(o.text.ko)) found.push(...out(F.scopes, `'${o.text.ko}'`, checkJamoRomanization(o.text.ko, o.text.romanization)).map((m) => `${ref}: ${m}`));
          else check(ref, o.text.ko, o.text.romanization);
        }
      }
      for (const b of s.picWord?.boards ?? []) for (const p of b.pairs) check(ref, p.word.ko, p.word.romanization);
    }
    expect(found).toEqual([]);
  });

  it('names Listen & Pick rounds and options only by ASCII ids or by the Korean they show', () => {
    const stray: string[] = [];
    for (const [ref, s] of Object.entries(minigameScopes)) {
      for (const r of s.listenPick?.rounds ?? []) {
        const shown = new Set([r.prompt.ko, ...r.options.flatMap((o) => (o.text ? [o.text.ko] : []))]);
        const named = (id: string): boolean => !HANGUL.test(id) || shown.has(id) || shown.has(id.split(':').at(-1) ?? '');
        for (const id of [r.id, r.answerId, ...r.options.map((o) => o.id)]) if (!named(id)) stray.push(`${ref}: ${id}`);
      }
    }
    expect(stray).toEqual([]);
  });

  it('every storySteps label has a romanization that passes R1 (a rule, not a table of values)', () => {
    const steps = Object.values(minigameScopes).flatMap((s) => s.storySteps ?? []);
    // F-QUEST-002 retires the Stage 1 story-sequence scopes one episode at a time; "New Year Order" (quest 9) keeps its four.
    expect(steps.length).toBeGreaterThanOrEqual(4);
    for (const p of steps) {
      expect(p.labelKo, p.id).toBeDefined();
      expect(checkRomanization(p.labelKo ?? '', p.romanization ?? '', ctx), p.labelKo).toEqual([]);
    }
  });

  it('declares no Hangul outside the checked fields', () => {
    // Listen & Pick rounds and Pic-Word boards are checked field by field above.
    const checked = new Set(['ko', 'labelKo', 'npcKo', 'jamoChars', 'listenPick', 'picWord']);
    const stray: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'string') {
        if (HANGUL.test(value)) stray.push(`${path}: ${value}`);
      } else if (Array.isArray(value)) {
        value.forEach((v, i) => walk(v, `${path}[${i}]`));
      } else if (value !== null && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) if (!checked.has(k)) walk(v, `${path}.${k}`);
      }
    };
    walk(minigameScopes, 'minigameScopes');
    expect(stray).toEqual([]);
  });
});

describe('lesson modules romanization (B1, F-CURR-001 §3.10)', () => {
  /** Every Korean string with its romanization in a generated value: `ko` / `romanization`, `npcKo` / `npcRomanization`, `labelKo` / `romanization`. */
  function pairsIn(value: unknown, out: Array<[string, string | undefined]> = []): Array<[string, string | undefined]> {
    if (Array.isArray(value)) value.forEach((v) => pairsIn(v, out));
    else if (typeof value === 'object' && value !== null) {
      const o = value as Record<string, unknown>;
      const rom = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : undefined);
      if (typeof o.ko === 'string') out.push([o.ko, rom('romanization')]);
      if (typeof o.npcKo === 'string') out.push([o.npcKo, rom('npcRomanization')]);
      if (typeof o.labelKo === 'string') out.push([o.labelKo, rom('romanization')]);
      Object.values(o).forEach((v) => pairsIn(v, out));
    }
    return out;
  }
  const check = ([ko, given]: [string, string | undefined]): RomanizationIssue[] =>
    !HANGUL.test(ko) ? [] : ko.includes('___') ? checkFrameRomanization(ko, given ?? '', ctx) : checkRomanization(ko, given ?? '', ctx);

  it('every taught Korean string of the lesson quests and scopes has its Revised Romanization (R1 to R4)', () => {
    const values = [LESSON_EPISODES, LESSON_QUESTS, ...Object.values(LESSON_STAGE_MODULES).map((m) => m.LESSON_SCOPES)];
    expect(values.flatMap((v) => pairsIn(v)).flatMap(check).map((i) => i.message)).toEqual([]);
  });

  it('the walker finds every pair shape the lesson scopes use (a bad one would fail)', () => {
    const bad = { a: { ko: '책', romanization: 'chaeg' }, b: [{ npcKo: '네', npcRomanization: 'ne' }], c: { labelKo: '저는 ___을/를 좋아해요', romanization: 'jeoneun joahaeyo' } };
    expect(pairsIn(bad)).toHaveLength(3);
    expect(pairsIn(bad).flatMap(check).map((i) => i.rule)).toEqual(['romanization-mismatch', 'romanization-mismatch']);
  });
});

describe('quests, episodes and avatars romanization (B1)', () => {
  /** Hangul allowed in an English field: an isolated syllable in a title (F-CNT-002 §3.4 ignore table). */
  const ENGLISH_HANGUL_ALLOWED: ReadonlyArray<{ questId: string; stepId: string; field: 'titleEn'; text: string }> = [];

  it('Korean Hoya lines live in hoyaLineKo with romanization and gloss, never in an English field', () => {
    const found: string[] = [];
    for (const q of questsAll) {
      expect(QuestSchema.safeParse(q).success, q.id).toBe(true);
      for (const s of q.steps) {
        for (const field of ['hoyaLineEn', 'bodyEn', 'titleEn'] as const) {
          const text = s[field];
          if (text === undefined || !HANGUL.test(text)) continue;
          const allowed = ENGLISH_HANGUL_ALLOWED.some(
            (a) => a.questId === q.id && a.stepId === s.id && a.field === field && a.text === text,
          );
          if (!allowed) found.push(formatRomanizationFinding(F.quests, lineOfText(sources.get(F.quests) ?? '', text), {
            rule: 'romanization-prose', severity: 'error', message: `${q.id}/${s.id}.${field}: Korean in an English field (${text})`,
          }));
        }
        if (s.hoyaLineKo !== undefined) {
          note(F.quests, s.hoyaLineKo.ko, s.hoyaLineKo.romanization);
          found.push(...pair(F.quests, s.hoyaLineKo.ko, s.hoyaLineKo.romanization));
        }
        // Discover examples and words (F-QUEST-002 §3.2): taught Korean with romanization and gloss.
        for (const page of s.discover?.pages ?? []) {
          for (const text of page.items.flatMap(discoverItemTexts)) {
            note(F.quests, text.ko, text.romanization);
            found.push(...pair(F.quests, text.ko, text.romanization).map((m) => `${q.id}/${s.id}: ${m}`));
          }
        }
      }
    }
    expect(found).toEqual([]);
  });

  it('the allowed English-field Korean is still present (the table cannot rot)', () => {
    for (const a of ENGLISH_HANGUL_ALLOWED) {
      const step = questsAll.find((q) => q.id === a.questId)?.steps.find((s) => s.id === a.stepId);
      expect(step?.[a.field], `${a.questId}/${a.stepId}`).toBe(a.text);
    }
  });

  it('the Seollal greeting is a hoyaLineKo with romanization and gloss', () => {
    const step = questsAll.find((q) => q.id === 'quest:stage1-rites-q1')?.steps[0];
    expect(step?.hoyaLineKo).toEqual({
      ko: '새해 복 많이 받으세요.',
      romanization: 'saehae bok mani badeuseyo',
      en: 'Happy New Year!',
    });
    expect(step?.hoyaLineEn).toBe("Happy New Year! Let's learn the greeting.");
  });

  it('avatar names romanize correctly (예리 is Yeri)', () => {
    const found = AVATAR_PRESETS.flatMap((a) => {
      note(F.avatars, a.pillarName, a.romanization);
      return pair(F.avatars, a.pillarName, a.romanization);
    });
    expect(found).toEqual([]);
    expect(AVATAR_PRESETS.find((a) => a.kind === 'hoya-green')).toMatchObject({ pillarName: '예리', romanization: 'Yeri' });
  });

  it('the lecture presenter Pause word romanizes correctly (잠깐 is jamkkan, F-TCH-004 §3.13)', () => {
    note(F.lecture, PAUSE_WORD.ko, PAUSE_WORD.romanization);
    expect(pair(F.lecture, PAUSE_WORD.ko, PAUSE_WORD.romanization)).toEqual([]);
  });

  it('English prose spells registered words without syllable hyphens and in Revised Romanization (R6)', () => {
    const registry = [...koWords];
    const prose: Array<{ file: string; where: string; text: string }> = [
      ...heritageCardsAll.flatMap((c) =>
        [c.blurbEn, c.factEn ?? ''].map((text) => ({ file: F.cards, where: c.id, text })),
      ),
      ...episodesAll.flatMap((e) =>
        [e.titleEn ?? '', e.subtitleEn ?? '', e.hoyaIntroEn ?? ''].map((text) => ({ file: F.episodes as string, where: e.id, text })),
      ),
      ...questsAll.flatMap((q) =>
        q.steps.flatMap((s) => [s.titleEn ?? '', s.hoyaLineEn ?? '', s.bodyEn ?? ''].map((text) => ({ file: F.quests, where: `${q.id}/${s.id}`, text }))),
      ),
    ];
    const found = prose.flatMap((p) =>
      checkProse(p.text, registry).map((i) => `${formatRomanizationFinding(p.file, lineOfText(sources.get(p.file) ?? '', p.text.slice(0, 24)), i)} (${p.where})`),
    );
    expect(found).toEqual([]);
    expect(heritageCardsAll.find((c) => c.id === 'card:origami')?.factEn).toContain('jongihak');
    expect(episodesAll.find((e) => e.id === 'episode:stage1-crafts')?.hoyaIntroEn).toBe('Let us play yunnori. Throw the sticks!');
  });
});

describe('romanization is consistent across sources (R5)', () => {
  /** The Stage 1 JSON pairs, read as data the way scripts/validate-content.mjs reads them. */
  const jsonEntries = (name: string): RomanizationEntry[] => {
    const rel = `content/episodes/stage-1/${name}`;
    const out: RomanizationEntry[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value !== null && typeof value === 'object') {
        const o = value as Record<string, unknown>;
        if (typeof o.ko === 'string' && typeof o.romanization === 'string' && HANGUL.test(o.ko)) {
          out.push({ ko: o.ko, romanization: o.romanization, where: `${rel}:${lineOfText(read(rel), JSON.stringify(o.ko)) ?? 0}` });
        }
        Object.values(o).forEach(walk);
      }
    };
    walk(JSON.parse(read(rel)));
    return out;
  };

  it('one Korean string has one spelling in the app data and in content/episodes/stage-1', () => {
    const all = [...entries, ...jsonEntries('cards.json'), ...jsonEntries('jamo.json')];
    expect(all.length).toBeGreaterThan(100);
    const found = checkConsistency(all).map((i) => formatRomanizationFinding('apps/mobile/src/content', undefined, i));
    expect(found).toEqual([]);
  });
});

describe('Hangul Check romanization (B1, F-QUEST-002 §3.9)', () => {
  it('every word, prompt and written option of the 35 items carries its romanization (R1 to R4, R7 for a lone symbol)', () => {
    const found: string[] = [];
    for (const w of HANGUL_CHECK_WORDS) {
      note(F.check, w.text.ko, w.text.romanization);
      found.push(...pair(F.check, w.text.ko, w.text.romanization).map((m) => `${w.id}: ${m}`));
    }
    for (const item of buildHangulCheck({ seed: 1 }).items) {
      const { prompt, options } = item.round;
      found.push(...pair(F.check, prompt.ko, prompt.romanization).map((m) => `${item.id}: ${m}`));
      for (const o of options) {
        if (o.text === undefined) continue;
        if (isLoneJamo(o.text.ko)) found.push(...out(F.check, `'${o.text.ko}'`, checkJamoRomanization(o.text.ko, o.text.romanization)));
        else found.push(...pair(F.check, o.text.ko, o.text.romanization).map((m) => `${item.id}: ${m}`));
      }
    }
    expect(found).toEqual([]);
  });
});
