import { existsSync, readdirSync, readFileSync } from 'node:fs';
import {
  CHECK_ROUNDS,
  LESSON_STEP_ORDER,
  LessonCellSchema,
  LessonScopeSchema,
  checkKindsFor,
  scopeRoundCount,
  translatableFields,
  discoverItemTexts,
  type Jamo,
  type KoText,
  type LessonCell,
  type LessonQuest,
  type LessonScope,
  type Overlays,
  type QuestStepKind,
  type StageKey,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { runtimeScope } from '../../../../../scripts/build-lessons.mjs';
import { CONTENT_OVERLAYS } from '../../logic/content-locale';
import type { MinigameScope } from '../../logic/minigame-config';
import { PLAYABLE_KINDS } from '../../logic/minigame-renderers';
import { episodesAll } from '../episodes';
import { LESSON_EPISODES, LESSON_QUESTS } from '../__generated__/lessons-index';
import { questsAll } from '../quests';
import { scopeFor } from '../../logic/minigame-config';
import { findJamo, jamoAll } from '../jamo';
import { stage1Quests } from '../quests';
import { VOCAB_ITEMS } from '../__generated__/vocab';
import { canDrawPicture } from '../../logic/__tests__/drawn-pictures';
import { distractorProblems, fixedReplyPlace, promptKey, soundKey } from './helpers/distractors';
import { ALL_LESSON_SCOPES, LESSON_STAGE_MODULES } from './helpers/lesson-stages';
import {
  WORD_BUILDER_SYMBOLS,
  discoverTexts,
  reuseProblems,
  scopeTexts,
  stemOf,
  unionSymbols,
  untaughtSymbols,
  vocabLevelFor,
  withoutSetPhrases,
  wordsOf,
  type TaughtSymbols,
} from './helpers/reuse';

/**
 * F-CURR-001 section 5, U-1 .. U-10: the invariants every upper-stage lesson cell
 * (content/episodes/stage-<n>/<theme>.json) keeps. Row C-2 lands the skeleton with the
 * generic checks; each cell row adds its cell file (the loops below pick it up) and the
 * content-specific checks marked `todo` (U-2 symbol inventory, U-3 new-item caps, U-4
 * decodable reading, U-6 reuse, U-8 distractors) as its stage needs them.
 */

const ROOT = new URL('../../../../../', import.meta.url);
const LESSON_STAGES = [2, 3, 4, 6, 7] as const;

interface CellFile {
  rel: string;
  cell: LessonCell;
}

function readCells(): CellFile[] {
  return LESSON_STAGES.flatMap((n) => {
    const dir = new URL(`content/episodes/stage-${n}/`, ROOT);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => ({ rel: `content/episodes/stage-${n}/${f}`, cell: LessonCellSchema.parse(JSON.parse(readFileSync(new URL(f, dir), 'utf8'))) }));
  });
}

const CELLS = readCells();
/** The hand-written taste cells that rows T-1 / T-2 move into cell files (F-CURR-001 OD-3). */
const TASTE_CELLS: ReadonlySet<string> = new Set(['episode:stage2-life', 'episode:stage2-nature', 'episode:stage4-rites']);
const READY = CELLS.filter((c) => c.cell.status === 'ready');

/** Section 3.1 rule 2: the summed seconds of a quest's six steps, per stage. */
export const TIMING_BAND: Readonly<Record<string, readonly [number, number]>> = {
  stage2: [225, 300],
  stage3: [225, 300],
  stage4: [225, 300],
  stage6: [240, 330],
  stage7: [240, 330],
};

/** Section 3.1 table: rounds (turns, questions) of Play 1 and Play 2; Check is always 2. */
export const ROUND_RANGE: Readonly<Record<string, Partial<Record<QuestStepKind, readonly [number, number]>>>> = {
  stage2: { practice: [6, 6], apply: [4, 4] },
  stage3: { practice: [5, 5], apply: [4, 4] },
  stage4: { practice: [3, 4], apply: [4, 4] },
  stage6: { practice: [4, 5], apply: [3, 4] },
  stage7: { practice: [4, 4], apply: [3, 4] },
};

/** U-1, U-5, U-7, U-9: the problems of one quest, as readable lines (empty = fine). */
export function questProblems(stage: StageKey, quest: LessonQuest): string[] {
  const out: string[] = [];
  const kinds = quest.steps.map((s) => s.kind);
  if (kinds.join() !== LESSON_STEP_ORDER.join()) out.push(`U-1 ${quest.id}: steps ${kinds.join(' -> ')}`);
  for (const step of quest.steps) {
    if (step.discover) {
      if (step.discover.pages.length > 3) out.push(`U-1 ${quest.id}: Discover has ${step.discover.pages.length} pages`);
      step.discover.pages.forEach((p, i) => p.items.length > 2 && out.push(`U-1 ${quest.id}: Discover page ${i + 1} has ${p.items.length} items`));
    }
    if (step.durationSeconds === undefined) out.push(`U-5 ${quest.id}: step ${step.id} has no durationSeconds`);
    if (step.minigameKind === 'voice-echo') out.push(`U-9 ${quest.id}: step ${step.id} asks for speech`);
    const scope = quest.scopes.find((s) => s.ref === step.minigameRef);
    if (step.minigameRef !== undefined && (scope === undefined || scope.kind !== step.minigameKind)) {
      out.push(`U-7 ${quest.id}: ${step.minigameRef} does not resolve to a ${String(step.minigameKind)} scope`);
    }
    if (scope === undefined) continue;
    const rounds = scopeRoundCount(scope);
    if (step.kind === 'check') {
      if (rounds !== CHECK_ROUNDS || !checkKindsFor(stage).includes(scope.kind)) out.push(`U-1 ${quest.id}: Check is ${scope.kind} x ${rounds}`);
    } else {
      const range = ROUND_RANGE[stage]?.[step.kind];
      if (range && scope.kind !== 'story-sequence' && (rounds < range[0] || rounds > range[1])) {
        out.push(`U-1 ${quest.id}: ${step.kind} plays ${rounds} rounds, not ${range[0]}-${range[1]}`);
      }
    }
    if (scope.kind === 'pic-word-match') {
      for (const board of scope.boards) for (const pair of board.pairs) if (pair.pictureRef === undefined) out.push(`U-9 ${quest.id}: a picture round has a text tile (${pair.word.ko})`);
    }
  }
  const refs = quest.steps.flatMap((s) => (s.minigameRef ? [s.minigameRef] : []));
  if (new Set(refs).size !== refs.length) out.push(`U-7 ${quest.id}: a minigameRef repeats`);
  for (const scope of quest.scopes) if (!refs.includes(scope.ref)) out.push(`U-7 ${quest.id}: ${scope.ref} is not played`);
  const seconds = quest.steps.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
  const [low, high] = TIMING_BAND[stage] ?? [0, 0];
  if (seconds < low || seconds > high) out.push(`U-5 ${quest.id}: ${seconds} s, outside ${low}-${high} s`);
  if (Math.abs(quest.estimatedMinutes - Math.round(seconds / 60)) > 1) out.push(`U-5 ${quest.id}: estimatedMinutes ${quest.estimatedMinutes} for ${seconds} s`);
  return out;
}

/** U-10: every translatable English field of the cell's entities has its es and ko value. */
export function missingGlosses(entities: ReadonlyArray<readonly [string, object]>, overlays: Overlays): string[] {
  return (['es', 'ko'] as const).flatMap((locale) =>
    entities.flatMap(([id, entity]) =>
      translatableFields(id, entity)
        .filter(({ field }) => overlays[locale][id]?.[field] === undefined)
        .map(({ field }) => `U-10 ${locale} ${id}.${field}`),
    ),
  );
}

describe('the lesson cell files (F-CURR-001 section 3.10)', () => {
  it('every file parses as a LessonCell and sits in its stage folder', () => {
    for (const { rel, cell } of CELLS) expect(rel, cell.id).toBe(`content/episodes/stage-${cell.stage.slice(5)}/${cell.theme}.json`);
  });

  it('the generated index holds exactly the ready cells (a draft stays "Coming later")', () => {
    expect(LESSON_EPISODES.map((e) => e.id).sort()).toEqual(READY.map((c) => c.cell.id).sort());
    expect(LESSON_QUESTS.map((q) => q.id).sort()).toEqual(READY.flatMap((c) => c.cell.quests.map((q) => q.id)).sort());
    for (const { cell } of CELLS.filter((c) => c.cell.status === 'draft')) {
      const bundled = episodesAll.find((e) => e.id === cell.id);
      if (TASTE_CELLS.has(cell.id)) {
        // A refreshed taste cell (T-1 / T-2) keeps playing its shipped hand-written quest until ready.
        expect(bundled?.status, cell.id).toBe('shipped');
        expect(bundled?.questIds, cell.id).toEqual([cell.quests[0]?.id]);
      } else {
        expect(bundled?.status, cell.id).toBe('preview');
      }
    }
  });

  it('a ready cell replaces its placeholder in the bundle, and its quests and scopes are shipped', () => {
    for (const { cell } of READY) {
      const episode = episodesAll.filter((e) => e.id === cell.id);
      expect(episode.map((e) => e.status), cell.id).toEqual(['shipped']);
      for (const quest of cell.quests) {
        expect(questsAll.some((q) => q.id === quest.id), quest.id).toBe(true);
        for (const scope of quest.scopes) expect(ALL_LESSON_SCOPES[scope.ref]?.kind, scope.ref).toBe(scope.kind);
      }
    }
  });

  it('T-2: once Greeting Dialogues is a generated cell, Stage 4 plays in grid theme order (Read Along, Kitchen Talk, Greeting Dialogues, ...)', () => {
    if (!READY.some((c) => c.cell.id === 'episode:stage4-rites')) return;
    const stage4 = questsAll.map((q) => q.id).filter((id) => id.startsWith('quest:stage4-'));
    const THEME_ORDER = ['letters', 'life', 'rites', 'nature', 'crafts'];
    const expected = READY.filter((c) => c.cell.stage === 'stage4')
      .sort((a, b) => THEME_ORDER.indexOf(a.cell.theme) - THEME_ORDER.indexOf(b.cell.theme))
      .flatMap((c) => c.cell.quests.map((q) => q.id));
    expect(expected.slice(0, 3)).toEqual(['quest:stage4-letters-q1', 'quest:stage4-letters-q2', 'quest:stage4-letters-q3']);
    expect(stage4).toEqual(expected);
  });
});

describe('U-1, U-5, U-7, U-9 per quest of every cell', () => {
  it('the checks catch a broken quest (the skeleton is live before the first cell)', () => {
    const quest: LessonQuest = {
      id: 'quest:stage3-letters-q1',
      titleEn: 'x',
      estimatedMinutes: 9,
      steps: [
        { id: 's1', kind: 'intro', titleEn: 'x', durationSeconds: 7 },
        { id: 's2', kind: 'practice', titleEn: 'x', minigameKind: 'listen-pick', minigameRef: 'minigame:s3-letters-q1-check', durationSeconds: 90 },
        { id: 's3', kind: 'check', titleEn: 'x', minigameKind: 'listen-pick', minigameRef: 'minigame:s3-letters-q1-check' },
      ],
      scopes: [
        { ref: 'minigame:s3-letters-q1-check', kind: 'listen-pick', rounds: [] as never },
        { ref: 'minigame:s3-letters-q1-spare', kind: 'card-match', pairs: [] },
        {
          ref: 'minigame:s3-letters-q1-pics',
          kind: 'pic-word-match',
          boards: [{ pairs: [{ id: 'a', word: { ko: '책', romanization: 'chaek', en: 'book' } }] }],
        },
      ],
    };
    quest.steps.push({ id: 's4', kind: 'apply', titleEn: 'x', minigameKind: 'pic-word-match', minigameRef: 'minigame:s3-letters-q1-pics', durationSeconds: 60 });
    expect(questProblems('stage3', quest)).toEqual([
      'U-1 quest:stage3-letters-q1: steps intro -> practice -> check -> apply',
      'U-1 quest:stage3-letters-q1: practice plays 0 rounds, not 5-5',
      'U-5 quest:stage3-letters-q1: step s3 has no durationSeconds',
      'U-1 quest:stage3-letters-q1: Check is listen-pick x 0',
      'U-1 quest:stage3-letters-q1: apply plays 1 rounds, not 4-4',
      'U-9 quest:stage3-letters-q1: a picture round has a text tile (책)',
      'U-7 quest:stage3-letters-q1: a minigameRef repeats',
      'U-7 quest:stage3-letters-q1: minigame:s3-letters-q1-spare is not played',
      'U-5 quest:stage3-letters-q1: 157 s, outside 225-300 s',
      'U-5 quest:stage3-letters-q1: estimatedMinutes 9 for 157 s',
    ]);
  });

  it('counts rounds as the generated scope plays them (Build a Letter: one round per syllable)', () => {
    const kt = (ko: string, romanization: string, en: string, syllables?: string[]) => ({ ko, romanization, en, ...(syllables ? { syllables } : {}) });
    const scope = LessonScopeSchema.parse({
      ref: 'minigame:s2-rites-q1-apply',
      kind: 'build-letter',
      words: [kt('설날', 'seollal', 'Lunar New Year', ['seol', 'lal']), kt('떡국', 'tteokguk', 'rice-cake soup', ['tteok', 'guk']), kt('연', 'yeon', 'kite')],
    });
    expect(scopeRoundCount(scope)).toBe(5);
    expect(runtimeScope(scope, 'test').rounds).toBe(scopeRoundCount(scope));
  });

  for (const { cell } of READY) {
    it(`${cell.id}: every generated scope plays the rounds the cell counts`, () => {
      for (const scope of cell.quests.flatMap((q) => q.scopes)) expect(ALL_LESSON_SCOPES[scope.ref]?.rounds, scope.ref).toBe(scopeRoundCount(scope));
    });
  }

  for (const { cell } of CELLS) {
    it(`${cell.id}: six steps, short Discover, 2-round Check, round counts, refs, timing, no speech`, () => {
      expect(cell.quests.flatMap((q) => questProblems(cell.stage, q))).toEqual([]);
    });
  }
});

/** The steps of a quest whose game the app cannot play yet (no MinigameScreen arm): a ready cell must have none. */
export function unplayableSteps(quest: LessonQuest, playable: ReadonlySet<string> = PLAYABLE_KINDS): string[] {
  return quest.steps.flatMap((s) =>
    s.minigameKind !== undefined && !playable.has(s.minigameKind) ? [`${quest.id}: step ${s.id} plays ${s.minigameKind}, which has no game screen yet`] : [],
  );
}

describe('a ready cell plays only games the app has (F-CURR-001 section 6: a game row lands before its cells)', () => {
  it('reports a step whose game has no screen', () => {
    const quest = {
      id: 'quest:stage7-life-q1',
      steps: [
        { id: 's1', kind: 'intro', titleEn: 'x' },
        { id: 's5', kind: 'practice', titleEn: 'x', minigameKind: 'match-shape', minigameRef: 'minigame:s7-life-q1-practice' },
        { id: 's6', kind: 'apply', titleEn: 'x', minigameKind: 'listen-pick', minigameRef: 'minigame:s7-life-q1-apply' },
      ],
    } as unknown as LessonQuest;
    expect(unplayableSteps(quest)).toEqual(['quest:stage7-life-q1: step s5 plays match-shape, which has no game screen yet']);
    expect(unplayableSteps(quest, new Set(['match-shape', 'listen-pick']))).toEqual([]);
  });

  for (const { cell } of READY) {
    it(`${cell.id}: every game it plays has a screen`, () => {
      expect(cell.quests.flatMap((q) => unplayableSteps(q))).toEqual([]);
    });
  }
});

/**
 * Write Frame rounds whose write part is traced: the Trace a Word canvas joins Write Frame after rows
 * G-4 and G-5 (until then `WriteFrameGame` writes them on the keyboard), so a ready cell must have none.
 */
export function tracedFrameRounds(scopes: Readonly<Record<string, MinigameScope | undefined>>, refs: readonly string[]): string[] {
  return refs.flatMap((ref) => (scopes[ref]?.writeFrame?.rounds ?? []).filter((r) => r.entry === 'trace').map((r) => `${ref}: round ${r.id} is traced`));
}

describe('a ready cell has no traced Write Frame round yet (F-CURR-001 G-5)', () => {
  it('reports a traced round', () => {
    const frame = { ko: '오늘 ___에 가요.', romanization: 'oneul ___e gayo', en: 'Today I go to ___.' };
    const round = (entry: 'type' | 'trace') => ({ id: `r-${entry}`, frame, slots: [{ id: 's', bank: [] }], entry, freeEntry: false });
    const scopes = { 'minigame:x': { kind: 'write-frame' as const, rounds: 2, writeFrame: { rounds: [round('type'), round('trace')] } } };
    expect(tracedFrameRounds(scopes, ['minigame:x', 'minigame:none'])).toEqual(['minigame:x: round r-trace is traced']);
  });

  for (const { cell } of READY) {
    it(`${cell.id}: no Write Frame round is traced`, () => {
      expect(tracedFrameRounds(ALL_LESSON_SCOPES, cell.quests.flatMap((q) => q.scopes.map((s) => s.ref)))).toEqual([]);
    });
  }
});

describe('U-10 three-language completeness of every ready cell', () => {
  it('reports a missing gloss', () => {
    const entities: Array<readonly [string, object]> = [['episode:stage3-letters', { titleEn: 'First Sentences', subtitleEn: 'x', hoyaIntroEn: 'y' }]];
    const overlays: Overlays = { es: { 'episode:stage3-letters': { title: 'Primeras oraciones', subtitle: 'x', hoyaIntro: 'y' } }, ko: {} };
    expect(missingGlosses(entities, overlays)).toEqual([
      'U-10 ko episode:stage3-letters.title',
      'U-10 ko episode:stage3-letters.subtitle',
      'U-10 ko episode:stage3-letters.hoyaIntro',
    ]);
  });

  it('asks for the gloss of every Sentence Builder tile, distractors and particle choices included', () => {
    const kt = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
    const scope = {
      kind: 'order-it',
      rounds: 1,
      orderIt: {
        rounds: [
          {
            id: 'r1',
            sentence: kt('사과를 먹어요.', 'sagwareul meogeoyo', 'I eat an apple'),
            distractors: [kt('없어요.', 'eopseoyo', 'there is none')],
            particle: { tile: 0, choices: [kt('을', 'eul', 'object marker'), kt('를', 'reul', 'object marker')] },
          },
        ],
      },
    };
    const id = 'minigame:s3-life-q1-apply';
    const full = { [id]: { 'orderIt.rounds.r1.sentence.gloss': 'x' } };
    expect(missingGlosses([[id, scope]], { es: full, ko: full })).toEqual(
      (['es', 'ko'] as const).flatMap((l) => [
        `U-10 ${l} ${id}.orderIt.rounds.r1.distractors.eopseoyo.gloss`,
        `U-10 ${l} ${id}.orderIt.rounds.r1.particle.choices.eul.gloss`,
        `U-10 ${l} ${id}.orderIt.rounds.r1.particle.choices.reul.gloss`,
      ]),
    );
  });

  it('asks for the gloss of every Pic-Word Match pair (the word tile and the picture name show it), board by index', () => {
    const kt = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
    const scope = {
      kind: 'pic-word-match',
      rounds: 1,
      picWord: { boards: [{ pairs: [{ id: 'p1', pictureRef: 'card:rice', word: kt('밥을 먹어요.', 'babeul meogeoyo', 'I eat rice.') }] }] },
    };
    const id = 'minigame:s3-life-q1-apply';
    expect(missingGlosses([[id, scope]], { es: {}, ko: { [id]: { 'picWord.boards.0.pairs.p1.word.gloss': 'x' } } })).toEqual([
      `U-10 es ${id}.picWord.boards.0.pairs.p1.word.gloss`,
    ]);
  });

  for (const { cell } of READY) {
    it(`${cell.id}: every English field has its es and ko value`, () => {
      const stage = LESSON_STAGE_MODULES[Number(cell.stage.slice(5)) as 2 | 3 | 4 | 6 | 7];
      const episode = episodesAll.find((e) => e.id === cell.id) as object;
      const quests = cell.quests.map((q) => [q.id, questsAll.find((x) => x.id === q.id) as object] as const);
      const scopes = cell.quests.flatMap((q) => q.scopes.map((s) => [s.ref, stage.LESSON_SCOPES[s.ref] as object] as const));
      expect(missingGlosses([[cell.id, episode], ...quests], CONTENT_OVERLAYS)).toEqual([]);
      expect(missingGlosses(scopes, stage.LESSON_SCOPE_OVERLAYS)).toEqual([]);
    });
  }
});

// ---- content checks (F-CURR-001 section 5): U-2, U-3, U-4 and U-6 (S2-1 onward) --------------------

/** The symbols a quest's Discover step introduces (its `jamo` items), resolved. */
function discoverSymbols(quest: LessonQuest): Jamo[] {
  return quest.steps.flatMap((s) => s.discover?.pages ?? []).flatMap((p) => p.items).flatMap((item) => {
    const jamo = item.type === 'jamo' ? findJamo(item.jamoId) : undefined;
    return jamo ? [jamo] : [];
  });
}

/** The Korean words a quest's Discover step shows. */
const discoverWords = (quest: LessonQuest): KoText[] =>
  quest.steps.flatMap((s) => s.discover?.pages ?? []).flatMap((p) => p.items).flatMap(discoverItemTexts);

/** The Korean a scope asks the learner to read in a scored round (U-4), and every Korean word it shows (U-6). */
function scopeWords(scope: LessonScope): { read: KoText[]; shown: KoText[] } {
  switch (scope.kind) {
    case 'pic-word-match': {
      const words = scope.boards.flatMap((b) => b.pairs.map((p) => p.word));
      return { read: words, shown: words };
    }
    case 'card-match':
      return { read: [...scope.pairs], shown: [...scope.pairs] };
    case 'build-letter':
      return { read: [...scope.words], shown: [...scope.words] };
    case 'listen-pick': {
      const options = scope.rounds.flatMap((r) => r.options.flatMap((o) => (o.text ? [o.text] : [])));
      // A prompt is heard, but with no Korean voice it shows as text (F-AUDIO-004), so it is read too.
      const prompts = scope.rounds.map((r) => r.prompt);
      return { read: [...options, ...prompts], shown: [...options, ...prompts] };
    }
    default:
      return { read: [], shown: [] };
  }
}

/** Symbol keys as the catalogue spells them: the letter, or `<letter>/final`. */
const keyOf = (jamo: Pick<Jamo, 'char' | 'kind'>): string => (jamo.kind === 'batchim' ? `${jamo.char}/final` : jamo.char);
const STAGE1_KEYS: ReadonlySet<string> = new Set(jamoAll.map(keyOf));

const INITIALS = [...'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'];
const MEDIALS = [...'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'];
const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];
/** The seven sounds a final letter is said as (standard pronunciation rules, article 8). */
const REPRESENTATIVE_FINALS = [...'ㄱㄴㄷㄹㅁㅂㅇ'];

/** The symbol keys a Korean string uses: an initial or vowel as its letter, a final as `<letter>/final`. */
function symbolKeysOf(ko: string): string[] {
  const keys: string[] = [];
  for (const ch of ko) {
    const code = (ch.codePointAt(0) ?? 0) - 0xac00;
    if (code < 0 || code > 11171) continue;
    const final = FINALS[code % 28] ?? '';
    keys.push(INITIALS[Math.floor(code / 588)] ?? '', MEDIALS[Math.floor((code % 588) / 28)] ?? '');
    if (final !== '') keys.push(`${final}/final`);
  }
  return keys;
}

/** U-4: the read words of a quest that use a symbol not taught by then, as readable lines. */
function undecodable(quest: LessonQuest, taught: ReadonlySet<string>): string[] {
  return quest.scopes.flatMap((scope) =>
    scopeWords(scope).read.flatMap((w) => {
      const missing = symbolKeysOf(w.ko).filter((k) => !taught.has(k));
      return missing.length > 0 ? [`U-4 ${quest.id}: ${scope.ref} reads ${w.ko}, which uses ${[...new Set(missing)].join(' ')} not taught yet`] : [];
    }),
  );
}

/** Words taught before any upper-stage cell: the Stage 1 Discover words and the vocabulary topics (rule 5). */
const STAGE2_KNOWN_WORDS: ReadonlySet<string> = new Set([
  ...VOCAB_ITEMS.map((v) => v.ko),
  ...stage1Quests.flatMap((q) => q.steps.flatMap((s) => s.discover?.pages ?? []).flatMap((p) => p.items).flatMap(discoverItemTexts)).map((t) => t.ko),
]);

/** U-6: each quest of a cell whose words outside Discover are less than half reused, as readable lines. */
function stage2ReuseProblems(cell: LessonCell, known: ReadonlySet<string> = STAGE2_KNOWN_WORDS): string[] {
  const earlier = new Set(known);
  return cell.quests.flatMap((quest) => {
    const shown = [...new Set(quest.scopes.flatMap((s) => scopeWords(s).shown.map((w) => w.ko)))];
    const reused = shown.filter((ko) => earlier.has(ko)).length;
    for (const w of [...discoverWords(quest), ...quest.scopes.flatMap((s) => scopeWords(s).shown)]) earlier.add(w.ko);
    return reused * 2 < shown.length ? [`U-6 ${quest.id}: ${reused} of ${shown.length} words outside Discover are reused`] : [];
  });
}

describe('content checks each cell row fills in (F-CURR-001 section 5)', () => {
  const wordBuilder = CELLS.find((c) => c.cell.id === 'episode:stage2-letters')?.cell;
  const stage2 = CELLS.filter((c) => c.cell.stage === 'stage2').map((c) => c.cell);

  it('the helpers read symbols, decodability and reuse', () => {
    expect(symbolKeysOf('꽃이')).toEqual(['ㄲ', 'ㅗ', 'ㅊ/final', 'ㅇ', 'ㅣ']);
    const quest = { id: 'quest:x', scopes: [{ ref: 'r', kind: 'card-match', pairs: [{ ko: '개', romanization: 'gae', en: 'dog' }] }], steps: [] } as unknown as LessonQuest;
    expect(undecodable(quest, STAGE1_KEYS)).toEqual(['U-4 quest:x: r reads 개, which uses ㅐ not taught yet']);
    expect(undecodable(quest, new Set([...STAGE1_KEYS, 'ㅐ']))).toEqual([]);
    expect(stage2ReuseProblems({ quests: [quest] } as unknown as LessonCell, new Set())).toEqual(['U-6 quest:x: 0 of 1 words outside Discover are reused']);
    expect(stage2ReuseProblems({ quests: [quest] } as unknown as LessonCell, new Set(['개']))).toEqual([]);
  });

  it('U-2 Word Builder: the 16 symbols each in exactly one Discover; with Stage 1 the full inventory; finals in two quests (S2-1)', () => {
    expect(wordBuilder, 'S2-1 lands content/episodes/stage-2/letters.json').toBeDefined();
    if (wordBuilder === undefined) return;
    const taught = wordBuilder.quests.map(discoverSymbols);
    const letters = taught.flat().filter((j) => j.kind !== 'batchim').map(keyOf);
    const sixteen = [...'ㄲㄸㅃㅆㅉ', ...'ㅐㅔㅒㅖㅘㅝㅟㅢㅚㅙㅞ'];
    expect([...letters].sort()).toEqual([...sixteen].sort());
    const all = new Set([...STAGE1_KEYS, ...taught.flat().map(keyOf)]);
    for (const c of INITIALS) expect(all.has(c), c).toBe(true);
    for (const v of MEDIALS) expect(all.has(v), v).toBe(true);
    for (const f of REPRESENTATIVE_FINALS) expect(all.has(`${f}/final`), `${f}/final`).toBe(true);
    // Finals in exactly two quests: one new sound (t) for its letters, then letters joined to sounds Stage 1 taught (k, p).
    const finalQuests = taught.map((js) => js.filter((j) => j.kind === 'batchim')).filter((js) => js.length > 0);
    expect(finalQuests).toHaveLength(2);
    expect(new Set(finalQuests[0]?.map((j) => j.romanization))).toEqual(new Set(['t']));
    const stage1Sounds = new Set(jamoAll.filter((j) => j.kind === 'batchim').map((j) => j.romanization));
    expect(stage1Sounds.has('t')).toBe(false);
    for (const j of finalQuests[1] ?? []) expect(stage1Sounds.has(j.romanization), j.id).toBe(true);
    // Each symbol once in the whole cell, never again in a later Discover.
    const ids = taught.flat().map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('U-3 new-item caps of Stage 2: Word Builder at most 5 symbols of one family or one new final sound; other cells at most 4 new words', () => {
    for (const cell of stage2) {
      for (const quest of cell.quests) {
        if (cell.theme === 'letters') {
          const symbols = discoverSymbols(quest);
          const finals = symbols.filter((j) => j.kind === 'batchim');
          if (finals.length > 0) {
            expect(finals.length, quest.id).toBe(symbols.length);
            const newSounds = new Set(finals.map((j) => j.romanization).filter((r) => !jamoAll.some((s) => s.kind === 'batchim' && s.romanization === r)));
            expect(newSounds.size, quest.id).toBeLessThanOrEqual(1);
          } else {
            expect(symbols.length, quest.id).toBeLessThanOrEqual(5);
          }
        } else {
          const words = new Set(discoverWords(quest).map((w) => w.ko).filter((ko) => !STAGE2_KNOWN_WORDS.has(ko)));
          expect(words.size, quest.id).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it('U-4 decodable scored reading in Stage 2: Stage 1 symbols, plus in Word Builder the symbols it taught by then', () => {
    for (const cell of stage2) {
      const taught = new Set(STAGE1_KEYS);
      for (const quest of cell.quests) {
        // Only Word Builder adds symbols; the other Stage 2 cells never read one (a plan orders themes freely).
        if (cell.theme === 'letters') for (const j of discoverSymbols(quest)) taught.add(keyOf(j));
        // The other Stage 2 cells show a Word Builder word only as exposure (rule 6's theme words): a Pic-Word or
        // Card Match tile carries its romanization and a Listen & Pick prompt is heard (Playground Words S2-3,
        // Holiday Words S2-2), so their scored reads are the written Listen & Pick options and Build a Letter.
        const scored =
          cell.theme === 'letters'
            ? quest
            : ({
                ...quest,
                scopes: quest.scopes.flatMap((sc): LessonScope[] =>
                  sc.kind === 'listen-pick'
                    ? [{ ...sc, rounds: sc.rounds.map((r) => ({ ...r, prompt: { ...r.prompt, ko: '' } })) } as LessonScope]
                    : sc.kind === 'pic-word-match' || sc.kind === 'card-match'
                      ? []
                      : [sc],
                ),
              } as LessonQuest);
        expect(undecodable(scored, taught)).toEqual([]);
      }
    }
  });

  it('U-6 at least half the Korean words outside Discover are reused (Stage 2)', () => {
    for (const cell of stage2) expect(stage2ReuseProblems(cell)).toEqual([]);
  });

  it('no Word Builder round asks to tell ㅐ from ㅔ, or ㅚ ㅙ ㅞ apart, by ear (section 3.3)', () => {
    expect(wordBuilder, 'S2-1 lands content/episodes/stage-2/letters.json').toBeDefined();
    if (wordBuilder === undefined) return;
    const norm = (ko: string): string =>
      [...ko].map((ch) => {
        const code = (ch.codePointAt(0) ?? 0) - 0xac00;
        if (code < 0 || code > 11171) return ch;
        const medial = MEDIALS[Math.floor((code % 588) / 28)] ?? '';
        const same = 'ㅐㅔ'.includes(medial) ? 'E' : 'ㅚㅙㅞ'.includes(medial) ? 'W' : medial;
        return `${INITIALS[Math.floor(code / 588)]}${same}${FINALS[code % 28]}`;
      }).join('');
    // A picture option is named by its word's romanization id: find the Korean it pictures in the cell.
    const koById = new Map<string, string>();
    for (const quest of wordBuilder.quests) {
      for (const w of discoverWords(quest)) koById.set(w.romanization, w.ko);
      for (const scope of quest.scopes) {
        if (scope.kind === 'pic-word-match') for (const b of scope.boards) for (const p of b.pairs) koById.set(p.id, p.word.ko);
        for (const w of scopeWords(scope).shown) koById.set(w.romanization, w.ko);
      }
    }
    for (const quest of wordBuilder.quests) {
      for (const scope of quest.scopes) {
        if (scope.kind !== 'listen-pick') continue;
        for (const round of scope.rounds) {
          const heard = norm(round.prompt.ko);
          for (const option of round.options) {
            if (option.id === round.answerId) continue;
            const ko = option.text?.ko ?? koById.get(option.id);
            expect(ko, `${scope.ref} ${round.id} ${option.id}: the word it pictures`).toBeDefined();
            expect(norm(ko ?? ''), `${scope.ref} ${round.id}`).not.toBe(heard);
          }
        }
      }
    }
  });

  it('every picture a Stage 2 round shows is drawn art, never the text-tile fallback (section 3.3, U-9)', () => {
    const undrawn = stage2.flatMap((cell) =>
      cell.quests.flatMap((quest) =>
        quest.scopes.flatMap((scope) => {
          const refs =
            scope.kind === 'pic-word-match'
              ? scope.boards.flatMap((b) => b.pairs.map((p) => p.pictureRef))
              : scope.kind === 'listen-pick'
                ? scope.rounds.flatMap((r) => r.options.flatMap((o) => (o.pictureRef === undefined ? [] : [o.pictureRef])))
                : [];
          const pages = quest.steps.flatMap((s) => s.discover?.pages ?? []).flatMap((p) => p.items).flatMap((i) => ('picture' in i && i.picture ? [i.picture] : []));
          return [...refs, ...(scope.kind === 'pic-word-match' ? pages : [])].flatMap((ref) => (ref === undefined || !canDrawPicture(ref) ? [`${scope.ref}: ${String(ref)}`] : []));
        }),
      ),
    );
    expect(undrawn).toEqual([]);
  });

});

/** Stage 1's taught words: every Hangul run in its quests and their games (the reading words, F-QUEST-002 R5). */
const STAGE1_WORDS: ReadonlySet<string> = new Set(
  stage1Quests.flatMap((q) => {
    const scopes = q.steps.flatMap((s) => (s.minigameRef ? [scopeFor(s.minigameRef)] : []));
    return JSON.stringify([q, scopes]).match(/[가-힣]+/g) ?? [];
  }),
);

/** What a cell of `stage` may count as taught before its own Discover (rule 5): Stage 1 and the vocabulary of its level. */
const wordsBefore = (stage: StageKey): ReadonlySet<string> => {
  const base = new Set([...STAGE1_WORDS, ...VOCAB_ITEMS.filter((v) => v.level <= vocabLevelFor(stage)).map((v) => v.ko)]);
  // Rule 5 and U-6: an earlier stage counts too (every route plays a stage's cells before the next stage's).
  const earlier = READY.filter((c) => Number(c.cell.stage.slice(5)) < Number(stage.slice(5)));
  for (const { cell } of earlier) for (const q of cell.quests) for (const w of wordsOf(discoverTexts(q), base)) base.add(w);
  return base;
};

/** Stage 1's 30 symbols (14 consonants, 10 vowels, 6 final letters), from the shipped jamo. */
const STAGE1_SYMBOLS: TaughtSymbols = {
  initials: new Set(jamoAll.filter((j) => j.kind === 'consonant').map((j) => j.char)),
  vowels: new Set(jamoAll.filter((j) => j.kind === 'vowel').map((j) => j.char)),
  finals: new Set(jamoAll.filter((j) => j.kind === 'batchim').map((j) => j.char)),
};

describe('U-3 new-item caps and U-6 reuse (F-CURR-001 section 3.1 rules 4 and 5)', () => {
  const kt = (ko: string) => ({ ko, romanization: 'x', en: 'x' });
  const quest = (k: number, discover: string[], read: string[]) =>
    ({
      id: `quest:stage3-life-q${k}`,
      steps: [
        { id: 's2', kind: 'discover', titleEn: 'x', discover: { pages: [{ items: discover.map((ko) => ({ type: 'sentence', sentence: kt(ko) })) }] } },
      ],
      scopes: [{ ref: `minigame:s3-life-q${k}-practice`, kind: 'order-it', rounds: read.map((ko, i) => ({ id: `r${i}`, sentence: kt(ko), distractors: [] })) }],
    }) as unknown as LessonQuest;

  it('reads a word without its particle unless the whole word is known', () => {
    expect(stemOf('친구가', new Set())).toBe('친구');
    expect(stemOf('학교에', new Set())).toBe('학교');
    expect(stemOf('송편하고', new Set())).toBe('송편');
    expect(stemOf('책이에요', new Set())).toBe('책');
    expect(stemOf('학교예요', new Set())).toBe('학교');
    expect(stemOf('고양이', new Set(['고양이']))).toBe('고양이');
    expect(stemOf('먹어요', new Set())).toBe('먹어요');
  });

  it('counts new Discover words against Stage 1, the level vocabulary and earlier quests of the cell', () => {
    const before = new Set(['밥', '물']);
    const q1 = quest(1, ['밥을 먹어요.', '물을 마셔요.'], ['밥을 먹어요.']);
    const q2 = quest(2, ['떡이 맛있어요.', '빵이 좋아요.', '라면이 뜨거워요.'], ['떡이 맛있어요.']);
    expect(reuseProblems('stage3', [q1, q2], before)).toEqual(['U-3 quest:stage3-life-q2: 6 new words (떡, 맛있어요, 빵, 좋아요, 라면, 뜨거워요), cap 4']);
  });

  it('asks that at least half the words outside Discover were taught', () => {
    const q1 = quest(1, ['밥을 먹어요.'], ['밥을 먹어요.', '사과를 깎아요.', '배를 깎아요.']);
    expect(reuseProblems('stage3', [q1], new Set(['밥']))).toEqual(['U-6 quest:stage3-life-q1: 2 of 5 words reused (사과, 깎아요, 배 not taught)']);
  });

  it('counts a set phrase as one item, its words with it, and a cast name as no word (rule 4, T-2)', () => {
    const q1 = quest(1, ['만나서 반가워요.', '저도 반가워요.', '저는 미나예요.'], ['만나서 반가워요.']);
    expect(reuseProblems('stage4', [q1], new Set(['저']))).toEqual([]);
    expect(withoutSetPhrases('고마워요. 새해 복 많이 받으세요!')).toBe('고마워요.  !');
    // Stage 4 also counts set phrases: four new dialogue lines pass even when they hold more new words (S4-4).
    const q2 = quest(2, ['내 차례야!', '잘했어!', '고마워! 이제 너야!'], ['내 차례야!']);
    expect(reuseProblems('stage4', [q2], new Set())).toEqual([]);
    const q5 = quest(1, ['가자!', '오자!', '보자!', '먹자!', '자자!'], ['가자!']);
    expect(reuseProblems('stage4', [q5], new Set())).toEqual(['U-3 quest:stage3-life-q1: 5 new words (가자, 오자, 보자, 먹자, 자자), cap 4']);
    // A -(으)ㄹ 거예요 future form is the quest's grammar point, not a word (S4-3).
    expect(reuseProblems('stage4', [quest(1, ['비가 올 거예요.', '내일 갈 거예요.'], ['비가 올 거예요.'])], new Set(['비']))).toEqual([]);
  });

  it('counts a number composed of taught numerals and a unit as taught, but not a word that only looks like one (S6-1)', () => {
    const prices = quest(1, ['일 이 삼 사 오', '천 원'], ['오천 원', '이천 원', '사천 원']);
    expect(reuseProblems('stage6', [prices], new Set(['원']))).toEqual([]);
    const lookalike = quest(1, ['일 이 삼 사 오', '천 원'], ['오천', '오리', '사과']);
    expect(reuseProblems('stage6', [lookalike], new Set(['원']))).toEqual(['U-6 quest:stage3-life-q1: 1 of 3 words reused (오리, 사과 not taught)']);
  });

  it('counts the numbers of one Discover as one number-set item, a known noun with 요 as that noun, and the mealtime phrases as set phrases (S6-2)', () => {
    const prices = quest(1, ['천 원', '이천 원', '삼천 원', '얼마예요?', '라면 하나요?', '맛있게 드세요.', '잘 먹겠습니다.'], ['삼천 원이에요.']);
    expect(reuseProblems('stage6', [prices], new Set(['라면', '하나']))).toEqual([]);
    expect(stemOf('하나요', new Set(['하나']))).toBe('하나');
    expect(stemOf('가요', new Set())).toBe('가요');
    const tooMany = quest(1, ['천 원', '얼마예요?', '배고파요.', '목말라요.', '빨리요.', '천천히요.', '여기서요.'], ['천 원']);
    expect(reuseProblems('stage6', [tooMany], new Set())).toEqual(['U-3 quest:stage3-life-q1: 8 new words (원, 얼마, 배고파요, 목말라요, 빨리요, 천천히요, 여기서요, numbers(천)), cap 6']);
  });

  it('counts a particle choice as no word, and a heard prompt as shown', () => {
    const lp = { kind: 'listen-pick', rounds: [{ id: 'c1', prompt: kt('바다에 가요.'), options: [{ id: 'o1', text: kt('산에 가요.') }], answerId: 'o1' }] };
    expect(scopeTexts(lp as unknown as LessonScope)).toEqual({ read: ['산에 가요.'], heard: ['바다에 가요.'], particles: [] });
  });

  for (const { cell } of READY.filter((c) => c.cell.stage !== 'stage2')) {
    it(`${cell.id}: one new pattern and at most the new words of its stage a quest; at least half the other words reused`, () => {
      expect(reuseProblems(cell.stage, cell.quests, wordsBefore(cell.stage))).toEqual([]);
    });
  }
});

describe('U-4 decodable scored reading (F-CURR-001 section 3.1 rule 6)', () => {
  it('names every symbol of a scored read the route has not taught', () => {
    expect(STAGE1_SYMBOLS.initials.size + STAGE1_SYMBOLS.vowels.size + STAGE1_SYMBOLS.finals.size).toBe(30);
    expect(untaughtSymbols('밥을 먹어요.', STAGE1_SYMBOLS)).toEqual([]);
    expect(untaughtSymbols('뜨거워요', STAGE1_SYMBOLS)).toEqual(['initial ㄸ in 뜨', 'vowel ㅝ in 워']);
    expect(untaughtSymbols('맛있어요', STAGE1_SYMBOLS)).toEqual(['final ㅅ in 맛', 'final ㅆ in 있']);
    const all = unionSymbols(STAGE1_SYMBOLS, WORD_BUILDER_SYMBOLS);
    expect(untaughtSymbols('뜨거워요 맛있어요', all)).toEqual([]);
    // Double finals stay theme words (section 3.3 q6), never a scored read.
    expect(untaughtSymbols('닭', all)).toEqual(['final ㄺ in 닭']);
    expect(untaughtSymbols('ㄱ', all)).toEqual(['loose jamo ㄱ']);
  });

  it('with Word Builder the route has taught every modern initial and vowel (section 3.3, U-2)', () => {
    const all = unionSymbols(STAGE1_SYMBOLS, WORD_BUILDER_SYMBOLS);
    expect(all.initials.size).toBe(19);
    expect(all.vowels.size).toBe(21);
    expect(all.finals.size).toBe(16);
  });

  // From Stage 3 on every route has passed Word Builder (Stage 2), so a scored read may use its symbols;
  // Stage 2's own cells are S2-1's rows (todo above).
  for (const { cell } of READY.filter((c) => c.cell.stage !== 'stage2')) {
    it(`${cell.id}: every scored read uses only Stage 1 and Word Builder symbols`, () => {
      const taught = unionSymbols(STAGE1_SYMBOLS, WORD_BUILDER_SYMBOLS);
      const read = cell.quests.flatMap((q) => q.scopes.flatMap((s) => {
        const { read: texts, particles } = scopeTexts(s);
        return [...texts, ...particles];
      }));
      expect(read.flatMap((t) => untaughtSymbols(withoutSetPhrases(t), taught))).toEqual([]);
    });
  }
});

describe('U-8 distractors (F-CURR-001 §3.5)', () => {
  it('reads ㅐ and ㅔ (and ㅒ, ㅖ) as one sound, ignoring marks and spaces', () => {
    expect(soundKey('내 차례야.')).toBe(soundKey('네 차례야'));
    expect(soundKey('얘기')).toBe(soundKey('예기'));
    expect(soundKey('이제 너야')).not.toBe(soundKey('내 차례야'));
    expect(soundKey('ok')).toBe('ok');
  });

  it('reports a natural distractor and a same-sounding pair in a heard round', () => {
    const kt = (ko: string) => ({ ko, romanization: 'x', en: 'x' });
    const cell = {
      quests: [
        {
          steps: [
            {
              discover: {
                pages: [{ items: [{ type: 'exchange', lines: [{ line: kt('누구예요?') }, { line: kt('할머니예요.') }] }] }],
              },
            },
          ],
          scopes: [
            {
              ref: 'minigame:s4-crafts-q2-practice',
              kind: 'tap-respond',
              turns: [
                {
                  line: kt('누구예요?'),
                  replies: [
                    { id: 'r1', text: kt('친구예요.'), correct: true },
                    { id: 'r2', text: kt('할머니예요.'), correct: false },
                  ],
                },
              ],
            },
            {
              ref: 'minigame:s4-crafts-q2-check',
              kind: 'listen-pick',
              rounds: [{ id: 'c1', prompt: kt('뭐 해?'), answerId: 'a', options: [{ id: 'a', text: kt('내 차례야.') }, { id: 'b', text: kt('네 차례야.') }] }],
            },
          ],
        },
      ],
    } as unknown as LessonCell;
    expect(distractorProblems(cell)).toEqual([
      'U-8 minigame:s4-crafts-q2-practice turn 1: 할머니예요. is also a natural reply to 누구예요?',
      'U-8 minigame:s4-crafts-q2-check c1: 내 차례야. and 네 차례야. sound the same',
    ]);
  });

  it('files a prompt under its question word, so a generic answer is natural for every prompt that asks it', () => {
    expect(promptKey('책이 어디예요?')).toBe('어디예요');
    expect(promptKey('화장실이 어디예요?')).toBe(promptKey('어디예요?'));
    expect(promptKey('선생님, 이게 뭐예요?')).toBe('뭐예요');
    expect(promptKey('연필 여기 있어요.')).toBe('연필여기있어요');
    const kt = (ko: string) => ({ ko, romanization: 'x', en: 'x' });
    const cell = {
      quests: [
        {
          steps: [{ discover: { pages: [{ items: [{ type: 'exchange', lines: [{ line: kt('화장실이 어디예요?') }, { line: kt('저기예요.') }] }] }] } }],
          scopes: [
            {
              ref: 'minigame:s4-letters-q2-check',
              kind: 'listen-pick',
              rounds: [{ id: 'c1', prompt: kt('책이 어디예요?'), answerId: 'a', options: [{ id: 'a', text: kt('여기예요.') }, { id: 'b', text: kt('저기예요.') }] }],
            },
          ],
        },
      ],
    } as unknown as LessonCell;
    expect(distractorProblems(cell)).toEqual(['U-8 minigame:s4-letters-q2-check c1: 저기예요. is also a natural reply to 책이 어디예요?']);
  });

  it('finds a Tap to Respond cell whose right reply never moves', () => {
    const turn = (right: number) => ({ replies: [0, 1, 2].map((i) => ({ id: `r${i + 1}`, correct: i === right })) });
    const cellWith = (...rights: number[]) =>
      ({ quests: [{ scopes: [{ kind: 'tap-respond', turns: rights.map(turn) }, { kind: 'listen-pick', rounds: [] }] }] }) as unknown as LessonCell;
    expect(fixedReplyPlace(cellWith(0, 0, 0))).toBe(0);
    expect(fixedReplyPlace(cellWith(0, 2, 1))).toBeUndefined();
  });

  for (const { cell } of CELLS.filter((c) => c.cell.stage === 'stage4')) {
    it(`${cell.id}: no distractor is a natural reply; no heard round offers two options that sound the same`, () => {
      expect(distractorProblems(cell)).toEqual([]);
    });
    it(`${cell.id}: the right Tap to Respond reply is not always in the same place`, () => {
      expect(fixedReplyPlace(cell)).toBeUndefined();
    });
  }
});
