import { existsSync, readdirSync, readFileSync } from 'node:fs';
import {
  CHECK_ROUNDS,
  LESSON_STEP_ORDER,
  LessonCellSchema,
  LessonScopeSchema,
  checkKindsFor,
  discoverItemTexts,
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
import { PLAYABLE_KINDS } from '../../logic/minigame-renderers';
import { episodesAll } from '../episodes';
import { LESSON_EPISODES, LESSON_QUESTS } from '../__generated__/lessons-index';
import { questsAll } from '../quests';
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
        { id: 's5', kind: 'practice', titleEn: 'x', minigameKind: 'write-frame', minigameRef: 'minigame:s7-life-q1-practice' },
        { id: 's6', kind: 'apply', titleEn: 'x', minigameKind: 'listen-pick', minigameRef: 'minigame:s7-life-q1-apply' },
      ],
    } as unknown as LessonQuest;
    expect(unplayableSteps(quest)).toEqual(['quest:stage7-life-q1: step s5 plays write-frame, which has no game screen yet']);
    expect(unplayableSteps(quest, new Set(['write-frame', 'listen-pick']))).toEqual([]);
  });

  for (const { cell } of READY) {
    it(`${cell.id}: every game it plays has a screen`, () => {
      expect(cell.quests.flatMap((q) => unplayableSteps(q))).toEqual([]);
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

/** A reply round of a dialogue game: the heard line, its natural reply and the other options. */
interface ReplyRound {
  where: string;
  prompt: string;
  answer: string;
  others: string[];
}

/** Every Tap to Respond turn and Listen & Pick round of a quest, as reply rounds. */
export function replyRounds(quest: LessonQuest): ReplyRound[] {
  return quest.scopes.flatMap((scope): ReplyRound[] => {
    if (scope.kind === 'tap-respond') {
      return scope.turns.map((t, i) => ({
        where: `${scope.ref} turn ${i + 1}`,
        prompt: t.line.ko,
        answer: t.replies.find((r) => r.correct)?.text.ko ?? '',
        others: t.replies.filter((r) => !r.correct).map((r) => r.text.ko),
      }));
    }
    if (scope.kind === 'listen-pick') {
      return scope.rounds.flatMap((r) => {
        const answer = r.options.find((o) => o.id === r.answerId)?.text?.ko;
        if (answer === undefined) return [];
        return [{ where: `${scope.ref} ${r.id}`, prompt: r.prompt.ko, answer, others: r.options.filter((o) => o.id !== r.answerId).flatMap((o) => (o.text ? [o.text.ko] : [])) }];
      });
    }
    return [];
  });
}

/**
 * How a line sounds for most speakers today: ㅔ and ㅐ (and ㅖ and ㅒ) merged (section 3.3,
 * Word Builder q1; section 3.5, 내 / 네). Two different lines with the same key sound alike.
 */
export function soundKey(text: string): string {
  return [...text]
    .map((ch) => {
      const code = ch.codePointAt(0)! - 0xac00;
      if (code < 0 || code > 11171) return ch;
      const medial = Math.floor((code % 588) / 28);
      const merged = medial === 5 ? 1 : medial === 7 ? 3 : medial;
      return String.fromCodePoint(0xac00 + Math.floor(code / 588) * 588 + merged * 28 + (code % 28));
    })
    .join('');
}

/**
 * U-8: a line that is the natural reply to a prompt anywhere in the cell is never a distractor
 * for that same prompt, and no round offers two options that sound alike (내 / 네).
 */
export function distractorProblems(quests: readonly LessonQuest[]): string[] {
  const rounds = quests.flatMap(replyRounds);
  const natural = new Map<string, Set<string>>();
  for (const r of rounds) natural.set(r.prompt, new Set([...(natural.get(r.prompt) ?? []), r.answer]));
  const out: string[] = [];
  for (const r of rounds) {
    for (const o of r.others) if (natural.get(r.prompt)?.has(o)) out.push(`U-8 ${r.where}: ${o} is also a natural reply to ${r.prompt}`);
    const options = [r.answer, ...r.others];
    for (let i = 0; i < options.length; i += 1) {
      for (let j = i + 1; j < options.length; j += 1) {
        if (options[i] !== options[j] && soundKey(options[i]!) === soundKey(options[j]!)) out.push(`U-8 ${r.where}: ${options[i]} and ${options[j]} sound alike`);
      }
    }
  }
  return out;
}

/** Section 3.1 rule 4: new words or set phrases per quest (Stage 4: one grammar point and at most 4). */
export const NEW_ITEM_CAP: Readonly<Partial<Record<StageKey, number>>> = { stage4: 4 };

/** The phrases of a Discover text: split after each sentence mark, so 고마워! 이제 너야! is two set phrases. */
const phrasesOf = (ko: string): string[] =>
  ko
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter((p) => p !== '');

/**
 * U-3 (Stage 4): the phrases each quest's Discover shows that no earlier quest of the cell showed.
 * A word item counts too. The other stages' counting rules (symbol families, number sets) land
 * with their first cell.
 */
export function newItemProblems(stage: StageKey, quests: readonly LessonQuest[]): string[] {
  const cap = NEW_ITEM_CAP[stage];
  if (cap === undefined) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const quest of quests) {
    const texts = quest.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items.flatMap((item) => discoverItemTexts(item).map((t) => t.ko))) ?? []);
    const fresh = [...new Set(texts.flatMap(phrasesOf))].filter((p) => !seen.has(p));
    if (fresh.length > cap) out.push(`U-3 ${quest.id}: ${fresh.length} new items (${fresh.join(', ')}), over ${cap}`);
    for (const p of fresh) seen.add(p);
  }
  return out;
}

describe('content checks each cell row fills in (F-CURR-001 section 5)', () => {
  it.todo('U-2 Word Builder: the 16 symbols each in exactly one Discover; with Stage 1 the full inventory; finals in two quests (S2-1)');
  it.todo('U-4 decodable scored reading (section 3.1 rule 6) (S2-1 onward)');
  it.todo('U-6 at least half the Korean words outside Discover are reused (S2-1 onward)');

  it('U-8 catches a distractor that is a natural reply elsewhere, and a 내 / 네 pair', () => {
    const kt = (ko: string) => ({ ko, romanization: 'x', en: 'x' });
    const turn = (line: string, answer: string, ...others: string[]) => ({
      speakerEn: 'Mina',
      line: kt(line),
      replies: [{ id: 'a', text: kt(answer), correct: true }, ...others.map((o, i) => ({ id: `d${i}`, text: kt(o), correct: false }))],
    });
    const quest = {
      id: 'quest:stage4-crafts-q1',
      scopes: [
        { ref: 'minigame:s4-crafts-q1-practice', kind: 'tap-respond', turns: [turn('같이 놀자!', '좋아!', '책이에요.'), turn('같이 놀자!', '뭐 하고 놀까?', '좋아!')] },
        { ref: 'minigame:s4-crafts-q1-check', kind: 'listen-pick', rounds: [{ id: 'r1', prompt: kt('이제 너야!'), options: [{ id: 'a', text: kt('내 차례야!') }, { id: 'b', text: kt('네 차례야!') }], answerId: 'a' }] },
      ],
    } as unknown as LessonQuest;
    expect(distractorProblems([quest])).toEqual([
      'U-8 minigame:s4-crafts-q1-practice turn 2: 좋아! is also a natural reply to 같이 놀자!',
      'U-8 minigame:s4-crafts-q1-check r1: 내 차례야! and 네 차례야! sound alike',
    ]);
  });

  it('U-3 counts the new phrases of each Discover against the Stage 4 cap', () => {
    const kt = (ko: string) => ({ ko, romanization: 'x', en: 'x' });
    const ex = (a: string, b: string) => ({ type: 'exchange', lines: [{ speaker: 'a', speakerEn: 'A', line: kt(a) }, { speaker: 'b', speakerEn: 'B', line: kt(b) }] });
    const quest = (k: number, ...items: object[]) => ({ id: `quest:stage4-crafts-q${k}`, steps: [{ id: 's2', kind: 'discover', discover: { pages: [{ items }] } }] }) as unknown as LessonQuest;
    const q1 = quest(1, ex('같이 놀자!', '좋아!'), ex('뭐 하고 놀까?', '윷놀이 하자!'));
    const q2 = quest(2, ex('내 차례야!', '좋아!'), ex('잘했어!', '고마워! 이제 너야!'), { type: 'word', word: kt('차례') });
    expect(newItemProblems('stage4', [q1, q2])).toEqual(['U-3 quest:stage4-crafts-q2: 5 new items (내 차례야!, 잘했어!, 고마워!, 이제 너야!, 차례), over 4']);
    expect(newItemProblems('stage2', [q2])).toEqual([]);
  });

  for (const { cell } of READY) {
    it(`${cell.id}: U-8 no distractor is also a natural reply; no round offers options that sound alike`, () => {
      expect(distractorProblems(cell.quests)).toEqual([]);
    });
    it(`${cell.id}: U-3 new items per quest within the stage cap`, () => {
      expect(newItemProblems(cell.stage, cell.quests)).toEqual([]);
    });
  }
});
