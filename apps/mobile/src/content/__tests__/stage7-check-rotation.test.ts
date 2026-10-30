import { readFileSync, readdirSync } from 'node:fs';
import { CHECK_ROUNDS, LessonCellSchema, checkKindsFor, scopeRoundCount, type LessonCell, type LessonQuest, type LessonScope } from '@hangul-route/content-schema';
import { PRODUCE_KINDS, normalizeKo } from '@hangul-route/content-schema/lint';
import { describe, expect, it } from 'vitest';
import { clozeFallbackScope, validClozeRounds } from '../../logic/cloze-pick/round';
import { validRounds } from '../../logic/listen-pick';
import { scopeFor } from '../../logic/minigame-config';

/**
 * F-CURR-002 row CM-3A, part S7 (section 7.1 Check rotation, 6.6 risk notes, 9.3): the Stage 7 Volume 1 Checks
 * rotate over Write Frame (the default S7 Check), Cloze Pick and Sentence Builder, so no game holds more than 40% of
 * the stage's Checks; every Check asks the learner to produce; no two adjacent quests share a Practice, Apply and
 * Check triple; no Write Frame Check frame is textually identical to a frame its own quest's Apply just played (a
 * Check may still ask the same bank about Hoya: section 7.1 does not forbid it, and varying it is a follow-up); every
 * Write Frame Check is about Hoya or about things, never about the learner (the neutral option of the section 6.6 risk
 * notes); no frame of the stage names the learner's family or feelings, every bank slot has a neutral answer, and no
 * Check bank offers a family or feeling word at all. The lint over the same files (no finding of any rule)
 * is `packages/content-schema` curriculum-lint.test.ts.
 */

const DIR = new URL('../../../../../content/episodes/stage-7/', import.meta.url);
// Volume 1 only (`<theme>.json`): a Volume 2 cell (`<theme>.v2.json`, row CM-41) is held to the same rotation by its own
// cell test (stage7-nature-v2-cell.test.ts) and, per tier and stage, by the curriculum lint's lesson-check-variety.
const CELLS: LessonCell[] = readdirSync(DIR)
  .filter((f) => f.endsWith('.json') && !/\.v\d+\.json$/.test(f))
  .sort()
  .map((f) => LessonCellSchema.parse(JSON.parse(readFileSync(new URL(f, DIR), 'utf8'))));
const QUESTS: LessonQuest[] = CELLS.flatMap((c) => c.quests);

const scopeOfStep = (quest: LessonQuest, kind: string): LessonScope | undefined => {
  const ref = quest.steps.find((s) => s.kind === kind)?.minigameRef;
  return quest.scopes.find((s) => s.ref === ref);
};

/** Words that would ask about the learner's own family or feelings (section 6.6 risk notes). */
const PERSONAL = new Set([
  '가족',
  '엄마',
  '아빠',
  '어머니',
  '아버지',
  '할머니',
  '할아버지',
  '부모님',
  '언니',
  '누나',
  '오빠',
  '형',
  '동생',
  '기뻐요',
  '슬퍼요',
  '화나요',
  '행복해요',
  '무서워요',
  '외로워요',
  '기분',
]);

/** First-person owners and choosers: a Check frame with one would be about the learner (section 6.6 neutral option). */
const FIRST_PERSON = new Set(['제', '제가', '저', '저는', '저도', '저의', '내', '내가', '나', '나는', '우리', '우리는']);

describe('Stage 7 Check rotation (F-CURR-002 row CM-3A S7)', () => {
  it('reads the five Volume 1 cells, 15 quests', () => {
    expect(CELLS.map((c) => c.theme).sort()).toEqual(['crafts', 'letters', 'life', 'nature', 'rites']);
    expect(QUESTS).toHaveLength(15);
  });

  it('no game kind is the game of more than 40 in 100 of the Checks, and Write Frame (the S7 default) is one of them', () => {
    const kinds = QUESTS.map((q) => scopeOfStep(q, 'check')?.kind);
    const counts = new Map<string, number>();
    for (const k of kinds) counts.set(String(k), (counts.get(String(k)) ?? 0) + 1);
    for (const [kind, n] of counts) expect(n / kinds.length, kind).toBeLessThanOrEqual(0.4);
    expect(Object.fromEntries(counts)).toEqual({ 'cloze-pick': 5, 'order-it': 5, 'write-frame': 5 });
  });

  it('every Check is a Stage 7 Check game with exactly 2 rounds, and asks the learner to produce', () => {
    for (const quest of QUESTS) {
      const check = scopeOfStep(quest, 'check')!;
      expect(checkKindsFor('stage7'), quest.id).toContain(check.kind);
      expect(scopeRoundCount(check), quest.id).toBe(CHECK_ROUNDS);
      expect(PRODUCE_KINDS.has(check.kind), quest.id).toBe(true);
    }
  });

  it('no two adjacent quests of a cell share their Practice, Apply and Check triple', () => {
    for (const cell of CELLS) {
      const triples = cell.quests.map((q) => ['practice', 'apply', 'check'].map((k) => scopeOfStep(q, k)?.kind).join(' / '));
      triples.forEach((t, i) => i > 0 && expect(t, `${cell.id} quests ${i} and ${i + 1}`).not.toBe(triples[i - 1]));
    }
  });

  it('uses no My Story step (row CM-38 is not part of this row)', () => {
    for (const quest of QUESTS) expect(quest.scopes.map((s) => s.kind), quest.id).not.toContain('my-story');
  });

  it('no frame names a family or feeling word, every bank slot has a neutral answer, and no Check bank holds a family or feeling word (section 6.6)', () => {
    let frames = 0;
    for (const quest of QUESTS) {
      for (const scope of quest.scopes) {
        if (scope.kind !== 'write-frame') continue;
        for (const round of scope.rounds) {
          const where = `${scope.ref} ${round.id}`;
          for (const word of round.frame.ko.split(/[\s.]+/)) expect(PERSONAL.has(word), `${where}: ${word}`).toBe(false);
          if (round.freeEntry) continue;
          frames += 1;
          for (const slot of round.slots) expect(slot.bank.some((w) => !PERSONAL.has(w.ko)), `${where} slot ${slot.id}`).toBe(true);
        }
      }
      const check = scopeOfStep(quest, 'check')!;
      if (check.kind !== 'write-frame') continue;
      for (const round of check.rounds) {
        for (const slot of round.slots) for (const w of slot.bank) expect(PERSONAL.has(w.ko), `${check.ref} ${round.id} slot ${slot.id}: ${w.ko}`).toBe(false);
      }
    }
    expect(frames).toBeGreaterThanOrEqual(20);
  });

  it('every Write Frame Check is about Hoya or about things, never the learner: no first-person owner or chooser, no "my" in a frame or bank, and a liking frame names Hoya (section 6.6 neutral option)', () => {
    const checks = QUESTS.map((q) => scopeOfStep(q, 'check')!).filter((s) => s.kind === 'write-frame');
    expect(checks).toHaveLength(5);
    let liking = 0;
    for (const scope of checks) {
      for (const round of scope.rounds) {
        const where = `${scope.ref} ${round.id}`;
        const words = round.frame.ko.split(/[\s.,]+/).filter((w) => w !== '');
        for (const word of words) expect(FIRST_PERSON.has(word), `${where}: ${word}`).toBe(false);
        expect(round.frame.en, where).not.toMatch(/\b(my|me|mine)\b/i);
        for (const slot of round.slots) for (const w of slot.bank) expect(w.en, `${where} ${w.ko}`).not.toMatch(/\b(my|me|mine)\b/i);
        if (/좋아/.test(round.frame.ko)) {
          liking += 1;
          expect(words[0], where).toMatch(/^호야/);
        }
      }
    }
    expect(liking).toBe(2);
  });

  it("no Write Frame Check frame is textually identical to a frame its own quest's Apply played", () => {
    let checked = 0;
    for (const quest of QUESTS) {
      const check = scopeOfStep(quest, 'check')!;
      const apply = scopeOfStep(quest, 'apply');
      if (check.kind !== 'write-frame' || apply?.kind !== 'write-frame') continue;
      const played = new Set(apply.rounds.map((r) => normalizeKo(r.frame.ko)));
      for (const round of check.rounds) {
        checked += 1;
        expect(played.has(normalizeKo(round.frame.ko)), `${check.ref} ${round.id}: ${round.frame.ko}`).toBe(false);
      }
    }
    expect(checked).toBe(10);
  });

  it('the one free-entry round is the unscored name round of Write Your Name q3, never a Check', () => {
    const free = QUESTS.flatMap((q) => q.scopes.flatMap((s) => (s.kind === 'write-frame' ? s.rounds.filter((r) => r.freeEntry).map((r) => `${s.ref} ${r.id}`) : [])));
    expect(free).toEqual(['minigame:s7-letters-q3-apply w3']);
  });

  it('each Cloze Pick Check plays its 2 rounds as its Listen & Pick fallback with game.cloze-pick off (section 12.2)', () => {
    const clozeChecks = QUESTS.map((q) => scopeOfStep(q, 'check')!).filter((s) => s.kind === 'cloze-pick');
    expect(clozeChecks).toHaveLength(5);
    for (const check of clozeChecks) {
      const runtime = scopeFor(check.ref)!;
      expect(validClozeRounds(runtime), check.ref).toHaveLength(2);
      const fallback = validRounds(clozeFallbackScope(runtime));
      expect(fallback, check.ref).toHaveLength(2);
      for (const round of fallback) expect(round.options.some((o) => o.id === round.answerId), `${check.ref} ${round.id}`).toBe(true);
    }
  });

  it('a Dictation round asks a word its cell showed on a Discover page before it, with its meaning', () => {
    let hear = 0;
    for (const cell of CELLS) {
      // Whole words only: a word item's Korean, or a whole word of a sentence, frame or example (아침에 is not 아침).
      const discovered = new Set<string>();
      const addWords = (ko: string): void => {
        for (const w of normalizeKo(ko).split(' ')) discovered.add(normalizeKo(w));
      };
      for (const quest of cell.quests) {
        for (const step of quest.steps) {
          for (const page of step.discover?.pages ?? []) {
            for (const item of page.items) {
              if (item.type === 'word') discovered.add(normalizeKo(item.word.ko));
              else if (item.type === 'sentence') addWords(item.sentence.ko);
              else if (item.type === 'pattern') for (const ex of item.examples) addWords(ex.ko);
            }
          }
        }
        for (const scope of quest.scopes) {
          if (scope.kind !== 'type-hangul') continue;
          for (const round of scope.rounds.filter((r) => r.mode === 'hear')) {
            hear += 1;
            expect(discovered.has(normalizeKo(round.target.ko)), `${scope.ref} ${round.id}: ${round.target.ko}`).toBe(true);
            expect(round.target.en.length, `${scope.ref} ${round.id}`).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(hear).toBe(4);
  });
});
