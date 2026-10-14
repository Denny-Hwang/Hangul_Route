import { existsSync, readdirSync, readFileSync } from 'node:fs';
import {
  CHECK_ROUNDS,
  LESSON_STEP_ORDER,
  LessonCellSchema,
  LessonScopeSchema,
  checkKindsFor,
  scopeRoundCount,
  translatableFields,
  type LessonCell,
  type LessonQuest,
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
import { distractorProblems, fixedReplyPlace, promptKey, soundKey } from './helpers/distractors';
import { ALL_LESSON_SCOPES, LESSON_STAGE_MODULES } from './helpers/lesson-stages';

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
      expect(episodesAll.find((e) => e.id === cell.id)?.status, cell.id).toBe('preview');
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
        { id: 's5', kind: 'practice', titleEn: 'x', minigameKind: 'trace-word', minigameRef: 'minigame:s7-life-q1-practice' },
        { id: 's6', kind: 'apply', titleEn: 'x', minigameKind: 'listen-pick', minigameRef: 'minigame:s7-life-q1-apply' },
      ],
    } as unknown as LessonQuest;
    expect(unplayableSteps(quest)).toEqual(['quest:stage7-life-q1: step s5 plays trace-word, which has no game screen yet']);
    expect(unplayableSteps(quest, new Set(['trace-word', 'listen-pick']))).toEqual([]);
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

describe('content checks each cell row fills in (F-CURR-001 section 5)', () => {
  it.todo('U-2 Word Builder: the 16 symbols each in exactly one Discover; with Stage 1 the full inventory; finals in two quests (S2-1)');
  it.todo('U-3 new-item caps per stage (section 3.1 rule 4) (S2-1 onward)');
  it.todo('U-4 decodable scored reading (section 3.1 rule 6) (S2-1 onward)');
  it.todo('U-6 at least half the Korean words outside Discover are reused (S2-1 onward)');
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
