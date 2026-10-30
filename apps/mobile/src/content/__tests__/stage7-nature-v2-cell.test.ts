import { readFileSync, readdirSync } from 'node:fs';
import {
  CHECK_ROUNDS,
  LessonCellSchema,
  MY_STORY_PRIVATE_TOPICS,
  MyStoryFrameSchema,
  checkKindsFor,
  scopeRoundCount,
  type LessonCell,
  type LessonQuest,
  type LessonScope,
} from '@hangul-route/content-schema';
import { PRODUCE_KINDS, allowlistedInstitution, lintCurriculum, normalizeKo } from '@hangul-route/content-schema/lint';
import type { UiLocale } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { localizeScope } from '../../logic/content-locale';
import { playedScope } from '../../logic/game-fallback';
import { fillGloss } from '../../logic/write-frame/view';
import { LESSON_STAGE_MODULES } from './helpers/lesson-stages';

/**
 * F-CURR-002 row CM-41 S7, Stage 7 Nature Volume 2, My Favorite Season (`content/episodes/stage-7/nature.v2.json`):
 * the §5.1 and §5.5 rules for this cell. The shared checks (U-1 to U-11, overlays, the curriculum lint over every
 * file, the review-item freeze) run over it with every other cell; this file holds what is particular to it:
 * three quests whose Practice / Apply / Check triples differ from Volume 1's, a Check rotation of its own (no game in
 * more than 40 in 100 of the Volume 2 Stage 7 Checks), recycling, two sourced culture notes, and the My Story chain of
 * q3 Apply (§7.1 F8, §6.6 risk notes): 3-5 word-bank frames, a neutral option in every bank, no private topic, no
 * free text, a fallback that reads well alone, and a composed line that reads well for every pick in en, es and ko.
 */

const read = (rel: string): unknown => JSON.parse(readFileSync(new URL(`../../../../../${rel}`, import.meta.url), 'utf8'));
const cell: LessonCell = LessonCellSchema.parse(read('content/episodes/stage-7/nature.v2.json'));
const v1: LessonCell = LessonCellSchema.parse(read('content/episodes/stage-7/nature.json'));

const scopeOf = (quest: LessonQuest, kind: string): LessonScope | undefined => {
  const ref = quest.steps.find((s) => s.kind === kind)?.minigameRef;
  return quest.scopes.find((s) => s.ref === ref);
};
const tripleOf = (quest: LessonQuest): string => ['practice', 'apply', 'check'].map((k) => scopeOf(quest, k)?.kind).join(' / ');
const chainOf = (c: LessonCell) => c.quests.flatMap((q) => q.scopes.filter((s): s is Extract<LessonScope, { kind: 'my-story' }> => s.kind === 'my-story'));

describe('My Favorite Season, Stage 7 Nature Volume 2 (F-CURR-002 row CM-41 S7)', () => {
  it('is the Volume 2 of the Stage 7 Nature cell: three quests, ready with both MAR sign-offs, stamped above the catalogue it joined', () => {
    expect(cell.id).toBe('episode:stage7-nature-v2');
    expect(cell.volume).toBe(2);
    expect(cell.titleEn).toBe('My Favorite Season');
    expect(cell.status).toBe('ready');
    expect(cell.review).toMatchObject({ language: 'native-reviewed', culture: 'culture-reviewed', reviewedBy: 'MAR' });
    expect(cell.quests.map((q) => q.id)).toEqual(['quest:stage7-nature-v2-q1', 'quest:stage7-nature-v2-q2', 'quest:stage7-nature-v2-q3']);
    for (const quest of cell.quests) expect(quest.addedIn, quest.id).toBeGreaterThan(20261028);
    // Row CM-23: one card per upper cell, already Volume 1's (card:tokki); a Volume 2 gives none.
    expect(cell.rewardCardIds).toEqual([]);
  });

  it('§5.1: its Practice, Apply and Check triples differ from every Volume 1 triple, and adjacent quests differ', () => {
    const volume1 = new Set(v1.quests.map(tripleOf));
    const triples = cell.quests.map(tripleOf);
    expect(triples).toEqual(['trace-word / type-hangul / order-it', 'order-it / type-hangul / write-frame', 'order-it / my-story / cloze-pick']);
    for (const t of triples) expect(volume1.has(t), t).toBe(false);
    triples.forEach((t, i) => i > 0 && expect(t).not.toBe(triples[i - 1]));
  });

  it('§7.1 Check rotation: three Stage 7 Checks of three games, two rounds each, every one a produce game', () => {
    const checks = cell.quests.map((q) => scopeOf(q, 'check')!);
    expect(new Set(checks.map((c) => c.kind)).size).toBe(3);
    for (const check of checks) {
      expect(checkKindsFor('stage7')).toContain(check.kind);
      expect(scopeRoundCount(check)).toBe(CHECK_ROUNDS);
      expect(PRODUCE_KINDS.has(check.kind), check.ref).toBe(true);
    }
  });

  it('§5.1 and §9.3: the curriculum lint reports nothing for the cell (recycle, new load, check variety, culture coverage and sources, dictation, review copy)', () => {
    // The whole route before it: every lesson cell file of Stages 2-7 (recycle reads what earlier quests taught).
    const tree = new Map<string, unknown>();
    for (const n of [2, 3, 4, 6, 7]) {
      const dir = new URL(`../../../../../content/episodes/stage-${n}/`, import.meta.url);
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) tree.set(`content/episodes/stage-${n}/${f}`, read(`content/episodes/stage-${n}/${f}`));
    }
    const findings = lintCurriculum(tree, { today: '2026-10-30' }).filter((f) => f.file === 'content/episodes/stage-7/nature.v2.json');
    expect(findings).toEqual([]);
  });

  it('§5.1: at least two culture notes, each with a first source from the §6.6 allowlist, named as on its access date, and every note checked three times', () => {
    const culture = cell.culture.filter((n) => n.kind === 'culture');
    expect(culture.length).toBeGreaterThanOrEqual(2);
    for (const note of cell.culture) {
      const first = note.sources?.[0];
      expect(first, note.id).toBeDefined();
      expect(allowlistedInstitution(first!.publisher, first!.accessed, first!.url)?.nameAsOfAccess, note.id).toBe(true);
      expect(note.sources!.length, note.id).toBeGreaterThanOrEqual(2);
      expect(note.verification.passes, note.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('a Dictation round asks a word a Discover page of its quest showed whole, with its meaning, and no sound change', () => {
    let hear = 0;
    for (const quest of cell.quests) {
      const words = quest.steps.flatMap((s) => s.discover?.pages.flatMap((p) => p.items) ?? []).flatMap((i) => (i.type === 'word' ? [normalizeKo(i.word.ko)] : []));
      const discovered = new Set(words);
      for (const scope of quest.scopes) {
        if (scope.kind !== 'type-hangul') continue;
        for (const round of scope.rounds.filter((r) => r.mode === 'hear')) {
          hear += 1;
          expect(discovered.has(normalizeKo(round.target.ko)), `${scope.ref} ${round.id}`).toBe(true);
          expect(round.target.en.length).toBeGreaterThan(0);
        }
      }
    }
    expect(hear).toBe(2);
  });

  it('the Write Frame Check is about Hoya or about things, never the learner, and its liking frame names Hoya (§6.6)', () => {
    const check = scopeOf(cell.quests[1]!, 'check')!;
    expect(check.kind).toBe('write-frame');
    if (check.kind !== 'write-frame') return;
    const FIRST_PERSON = new Set(['제', '제가', '저', '저는', '저도', '내', '내가', '나', '나는', '우리']);
    for (const round of check.rounds) {
      for (const w of round.frame.ko.split(/[\s.,]+/)) expect(FIRST_PERSON.has(w), `${round.id}: ${w}`).toBe(false);
      expect(round.frame.en).not.toMatch(/\b(my|me|mine|I)\b/);
      if (/좋아/.test(round.frame.ko)) expect(round.frame.ko.startsWith('호야')).toBe(true);
    }
  });
});

describe('the My Story chain of q3 Apply (§7.1 F8, §6.6, rows CM-38 and CM-41 S7)', () => {
  const [chain] = chainOf(cell);

  it('is the only chain, three to five word-bank frames that each parse as a My Story frame', () => {
    expect(chainOf(cell)).toHaveLength(1);
    expect(chain!.ref).toBe('minigame:s7-nature-v2-q3-apply');
    expect(chain!.frames.length).toBeGreaterThanOrEqual(3);
    expect(chain!.frames.length).toBeLessThanOrEqual(5);
    for (const frame of chain!.frames) {
      expect(MyStoryFrameSchema.safeParse(frame).success, frame.id).toBe(true);
      expect(frame.freeEntry, frame.id).toBe(false);
      expect(MY_STORY_PRIVATE_TOPICS.test(frame.frame.en), frame.id).toBe(false);
    }
  });

  it('every slot offers exactly one neutral option, never first, that tells nothing about the learner: all four seasons, nice weather, the park', () => {
    const neutral = chain!.frames.map((f) => f.slots.map((s) => s.bank.filter((w) => w.neutral === true).map((w) => w.ko)));
    expect(neutral).toEqual([[['사계절']], [['좋아요']], [['공원']]]);
    for (const frame of chain!.frames) for (const slot of frame.slots) expect(slot.bank[0]!.neutral, `${frame.id} ${slot.id}`).toBeUndefined();
    // No family or feeling word in any bank: nobody has to share either to finish (§6.6 risk notes).
    const PERSONAL = /가족|엄마|아빠|할머니|할아버지|동생|언니|오빠|누나|형|기분|기뻐|슬퍼|행복/;
    for (const frame of chain!.frames) for (const slot of frame.slots) for (const w of slot.bank) expect(PERSONAL.test(w.ko), w.ko).toBe(false);
  });

  it('with game.my-story off (its launch state) the step plays Write Frame on the first frame, which reads well alone', () => {
    const scope = LESSON_STAGE_MODULES[7].LESSON_SCOPES[chain!.ref]!;
    const played = playedScope(scope, () => false);
    expect(played.kind).toBe('write-frame');
    expect(played.writeFrame?.rounds.map((r) => r.frame.ko)).toEqual(['___이/가 좋아요.']);
    expect(played.writeFrame?.rounds[0]!.slots[0]!.bank.map((w) => w.ko)).toEqual(['봄', '여름', '가을', '겨울', '사계절']);
  });

  it('the composed line reads as one clean line for every pick, in en, es and ko (no blank left, no word twice in a row)', () => {
    const LOCALES: readonly UiLocale[] = ['en', 'es', 'ko'];
    const module = LESSON_STAGE_MODULES[7];
    const scope = module.LESSON_SCOPES[chain!.ref]!;
    let lines = 0;
    for (const locale of LOCALES) {
      const frames = localizeScope(scope, chain!.ref, locale, module.LESSON_SCOPE_OVERLAYS).myStory?.frames ?? [];
      expect(frames).toHaveLength(chain!.frames.length);
      for (const frame of frames) {
        for (const word of frame.slots[0]!.bank) {
          const line = fillGloss(frame.frame.en, [word.en]);
          lines += 1;
          expect(line, `${locale} ${frame.id}`).not.toContain('___');
          const words = line.split(/[\s,.:]+/).filter(Boolean);
          expect(words.some((w, i) => i > 0 && w === words[i - 1]), `${locale} ${frame.id}: ${line}`).toBe(false);
          if (locale === 'ko') expect(word.en.length, word.en).toBeLessThanOrEqual(20);
        }
      }
    }
    expect(lines).toBe(3 * 14);
  });
});
