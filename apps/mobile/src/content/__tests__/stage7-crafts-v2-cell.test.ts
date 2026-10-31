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
 * F-CURR-002 row CM-42 S7, Stage 7 Play & Crafts Volume 2, My Own Game (`content/episodes/stage-7/crafts.v2.json`):
 * the §5.1 and §5.6 rules for this cell. The shared checks (U-1 to U-11, overlays, the curriculum lint over every
 * file, the review-item freeze, the switch-off pass and the shipped My Story steps) run over it with every other cell;
 * this file holds what is particular to it: three quests whose Practice / Apply / Check triples differ from Volume 1's,
 * Checks of three games, recycling, two sourced culture notes, and the My Story chain of q3 Apply (§7.1 F8, §6.6
 * risk notes): the rules of the learner's own game from 3-5 word-bank frames, a neutral option in every bank, no
 * private topic, no free text, a fallback that reads well alone, and a composed line that reads well for every pick.
 */

const read = (rel: string): unknown => JSON.parse(readFileSync(new URL(`../../../../../${rel}`, import.meta.url), 'utf8'));
const cell: LessonCell = LessonCellSchema.parse(read('content/episodes/stage-7/crafts.v2.json'));
const v1: LessonCell = LessonCellSchema.parse(read('content/episodes/stage-7/crafts.json'));

const scopeOf = (quest: LessonQuest, kind: string): LessonScope | undefined => {
  const ref = quest.steps.find((s) => s.kind === kind)?.minigameRef;
  return quest.scopes.find((s) => s.ref === ref);
};
const tripleOf = (quest: LessonQuest): string => ['practice', 'apply', 'check'].map((k) => scopeOf(quest, k)?.kind).join(' / ');
const chainOf = (c: LessonCell) => c.quests.flatMap((q) => q.scopes.filter((s): s is Extract<LessonScope, { kind: 'my-story' }> => s.kind === 'my-story'));
/** Every Korean string of a cell's rounds and Discover pages, normalized (what the learner reads or writes). */
const koOf = (value: unknown, out: string[] = []): string[] => {
  if (Array.isArray(value)) value.forEach((v) => koOf(v, out));
  else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'ko' && typeof v === 'string') out.push(normalizeKo(v));
      else koOf(v, out);
    }
  }
  return out;
};

describe('My Own Game, Stage 7 Play & Crafts Volume 2 (F-CURR-002 row CM-42 S7)', () => {
  it('is the Volume 2 of the Stage 7 Play & Crafts cell: three quests, ready with both MAR sign-offs, stamped above the catalogue it joined', () => {
    expect(cell.id).toBe('episode:stage7-crafts-v2');
    expect(cell.volume).toBe(2);
    expect(cell.titleEn).toBe('My Own Game');
    expect(cell.status).toBe('ready');
    expect(cell.review).toMatchObject({ language: 'native-reviewed', culture: 'culture-reviewed', reviewedBy: 'MAR' });
    expect(cell.quests.map((q) => q.id)).toEqual(['quest:stage7-crafts-v2-q1', 'quest:stage7-crafts-v2-q2', 'quest:stage7-crafts-v2-q3']);
    for (const quest of cell.quests) expect(quest.addedIn, quest.id).toBeGreaterThan(20261028);
    // Row CM-23: one card per upper cell, already Volume 1's (card:bihaenggi); a Volume 2 gives none.
    expect(v1.rewardCardIds).toEqual(['card:bihaenggi']);
    expect(cell.rewardCardIds).toEqual([]);
  });

  it('§5.1: its Practice, Apply and Check triples differ from every Volume 1 triple, and adjacent quests differ', () => {
    const volume1 = new Set(v1.quests.map(tripleOf));
    const triples = cell.quests.map(tripleOf);
    expect(triples).toEqual(['trace-word / type-hangul / cloze-pick', 'type-hangul / order-it / write-frame', 'type-hangul / my-story / order-it']);
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
    const findings = lintCurriculum(tree, { today: '2026-10-30' }).filter((f) => f.file === 'content/episodes/stage-7/crafts.v2.json');
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

  it('asks nothing by ear (no Dictation round), and never asks 차례 alone: 차례 (茶禮), the rite, is written the same', () => {
    for (const quest of cell.quests) {
      for (const scope of quest.scopes) {
        if (scope.kind === 'type-hangul') for (const round of scope.rounds) expect(round.mode, `${scope.ref} ${round.id}`).not.toBe('hear');
      }
    }
    expect(koOf(cell.quests)).not.toContain('차례');
    expect(koOf(cell.quests)).toContain('차례대로');
  });

  it('the rules are about the game, never the learner: no frame, sentence or bank word says I, me or my (§6.6)', () => {
    const FIRST_PERSON = new Set(['제', '제가', '저', '저는', '저도', '내', '내가', '나', '나는', '우리']);
    for (const ko of koOf(cell.quests)) for (const w of ko.split(/[\s.,]+/)) expect(FIRST_PERSON.has(w), ko).toBe(false);
    const writeFrames = cell.quests.flatMap((q) => q.scopes.flatMap((s) => (s.kind === 'write-frame' ? s.rounds : s.kind === 'my-story' ? s.frames : [])));
    expect(writeFrames.length).toBe(5);
    for (const round of writeFrames) expect(round.frame.en, round.id).not.toMatch(/\b(my|me|mine|I)\b/);
  });
});

describe('the My Story chain of q3 Apply (§7.1 F8, §6.6, rows CM-38 and CM-42 S7)', () => {
  const [chain] = chainOf(cell);

  it('is the cell\'s only chain, three to five word-bank frames that each parse as a My Story frame: what you need, taking turns, one more go', () => {
    expect(chainOf(cell)).toHaveLength(1);
    expect(chain!.ref).toBe('minigame:s7-crafts-v2-q3-apply');
    expect(chain!.frames.map((f) => f.frame.ko)).toEqual(['___이/가 필요해요.', '차례대로 ___.', '한 번 더 ___.']);
    for (const frame of chain!.frames) {
      expect(MyStoryFrameSchema.safeParse(frame).success, frame.id).toBe(true);
      expect(frame.freeEntry, frame.id).toBe(false);
      expect(MY_STORY_PRIVATE_TOPICS.test(frame.frame.en), frame.id).toBe(false);
    }
  });

  it('every slot offers exactly one neutral option, never first, that tells nothing about the learner: a friend, and play', () => {
    const neutral = chain!.frames.map((f) => f.slots.map((s) => s.bank.filter((w) => w.neutral === true).map((w) => w.ko)));
    expect(neutral).toEqual([[['친구']], [['해요']], [['해요']]]);
    for (const frame of chain!.frames) for (const slot of frame.slots) expect(slot.bank[0]!.neutral, `${frame.id} ${slot.id}`).toBeUndefined();
    // No family or feeling word in any bank: nobody has to share either to finish (§6.6 risk notes).
    const PERSONAL = /가족|엄마|아빠|할머니|할아버지|동생|언니|오빠|누나|형|기분|기뻐|슬퍼|행복/;
    for (const frame of chain!.frames) for (const slot of frame.slots) for (const w of slot.bank) expect(PERSONAL.test(w.ko), w.ko).toBe(false);
  });

  it('frames 2 and 3 and their actions are the q2 Check, so the switch-off path has taught them (the CM-38 hand-off)', () => {
    const check = scopeOf(cell.quests[1]!, 'check')!;
    expect(check.kind).toBe('write-frame');
    if (check.kind !== 'write-frame') return;
    const checkFrames = new Set(check.rounds.map((r) => normalizeKo(r.frame.ko)));
    const checkWords = new Set(check.rounds.flatMap((r) => r.slots.flatMap((s) => s.bank.map((w) => w.ko))));
    for (const frame of chain!.frames.slice(1)) {
      expect(checkFrames.has(normalizeKo(frame.frame.ko)), frame.id).toBe(true);
      for (const w of frame.slots[0]!.bank) expect(checkWords.has(w.ko), `${frame.id} ${w.ko}`).toBe(true);
    }
  });

  it('with game.my-story off (its launch state) the step plays Write Frame on the first frame, which reads well alone', () => {
    const scope = LESSON_STAGE_MODULES[7].LESSON_SCOPES[chain!.ref]!;
    const played = playedScope(scope, () => false);
    expect(played.kind).toBe('write-frame');
    expect(played.writeFrame?.rounds.map((r) => r.frame.ko)).toEqual(['___이/가 필요해요.']);
    expect(played.writeFrame?.rounds[0]!.slots[0]!.bank.map((w) => w.ko)).toEqual(['공', '윷', '제기', '종이', '친구']);
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
    expect(lines).toBe(3 * 13);
  });
});
