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
 * F-CURR-002 row CM-44 S7, Stage 7 Letters & Books Volume 2, My Postcard (`content/episodes/stage-7/letters.v2.json`):
 * the §5.1 and §5.2 rules for this cell. The shared checks (U-1 to U-11, overlays, the curriculum lint over every
 * file, the review-item freeze, the switch-off pass and the shipped My Story steps) run over it with every other cell;
 * this file holds what is particular to it: three quests whose Practice / Apply / Check triples differ from Volume 1's,
 * Checks of three games, recycling, culture notes that are new beside Volume 1's, the §5.2 S7 content (a letter frame,
 * a one-line diary, and a word traced as in brush-written letters), and the My Story chain of q3 Apply (§7.1 F8, §6.6
 * risk notes): a postcard from 3-5 word-bank frames, a neutral option in every bank, receivers who are a friend or the
 * cast, no private topic, no free text, a fallback that reads as a postcard's first line, and a composed line that
 * reads well for every pick.
 */

const read = (rel: string): unknown => JSON.parse(readFileSync(new URL(`../../../../../${rel}`, import.meta.url), 'utf8'));
const cell: LessonCell = LessonCellSchema.parse(read('content/episodes/stage-7/letters.v2.json'));
const v1: LessonCell = LessonCellSchema.parse(read('content/episodes/stage-7/letters.json'));

const scopeOf = (quest: LessonQuest, kind: string): LessonScope | undefined => {
  const ref = quest.steps.find((s) => s.kind === kind)?.minigameRef;
  return quest.scopes.find((s) => s.ref === ref);
};
const tripleOf = (quest: LessonQuest): string => ['practice', 'apply', 'check'].map((k) => scopeOf(quest, k)?.kind).join(' / ');
const chainOf = (c: LessonCell) => c.quests.flatMap((q) => q.scopes.filter((s): s is Extract<LessonScope, { kind: 'my-story' }> => s.kind === 'my-story'));

describe('My Postcard, Stage 7 Letters & Books Volume 2 (F-CURR-002 row CM-44 S7)', () => {
  it('is the Volume 2 of the Stage 7 Letters & Books cell: three quests, ready with both MAR sign-offs, stamped above the catalogue it joined', () => {
    expect(cell.id).toBe('episode:stage7-letters-v2');
    expect(cell.volume).toBe(2);
    expect(cell.theme).toBe('letters');
    expect(cell.titleEn).toBe('My Postcard');
    expect(cell.status).toBe('ready');
    expect(cell.review).toMatchObject({ language: 'native-reviewed', culture: 'culture-reviewed', reviewedBy: 'MAR' });
    expect(cell.quests.map((q) => q.id)).toEqual(['quest:stage7-letters-v2-q1', 'quest:stage7-letters-v2-q2', 'quest:stage7-letters-v2-q3']);
    // Main's catalogue version was 20261028 and the stacked Volume 2 cells stamp 20261030 (rows CM-41 to CM-43 S7).
    for (const quest of cell.quests) expect(quest.addedIn, quest.id).toBeGreaterThan(20261030);
    // Row CM-23: one card per upper cell, already Volume 1's (card:ireum); a Volume 2 gives none.
    expect(v1.rewardCardIds).toEqual(['card:ireum']);
    expect(cell.rewardCardIds).toEqual([]);
  });

  it('§5.1: its Practice, Apply and Check triples differ from every Volume 1 triple, and adjacent quests differ', () => {
    const volume1 = new Set(v1.quests.map(tripleOf));
    const triples = cell.quests.map(tripleOf);
    expect(triples).toEqual(['type-hangul / order-it / cloze-pick', 'trace-word / order-it / write-frame', 'type-hangul / my-story / order-it']);
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
    const findings = lintCurriculum(tree, { today: '2026-10-31' }).filter((f) => f.file === 'content/episodes/stage-7/letters.v2.json');
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

  it('the notes are new facts beside Volume 1\'s (loanword spelling): no note repeats a Volume 1 note or cites the same quote', () => {
    const v1Texts = new Set(v1.culture.map((n) => n.textEn));
    const v1Quotes = new Set(v1.culture.flatMap((n) => (n.sources ?? []).map((s) => s.quoteOrLocator)));
    for (const note of cell.culture) {
      expect(v1Texts.has(note.textEn), note.id).toBe(false);
      for (const source of note.sources ?? []) expect(v1Quotes.has(source.quoteOrLocator), `${note.id} ${source.url}`).toBe(false);
    }
    // One note on Hangul letters, one on 궁체 (the Hangul brush style), one on 께 (the polite form of 에게).
    expect(cell.culture.map((n) => [n.id, n.kind])).toEqual([['n1', 'culture'], ['n2', 'culture'], ['n3', 'language']]);
    expect(cell.culture[0]!.textEn).toMatch(/oldest Hangul letter/);
    expect(cell.culture[1]!.textEn).toMatch(/\{ko:궁체\} is a style of Hangul brush writing/);
    expect(cell.culture[2]!.textEn).toMatch(/\{ko:께\} in place of \{ko:에게\}/);
  });

  it('§5.2 S7: a letter frame (___에게), a one-line diary (일기, 오늘 ___을/를 썼어요) and a word traced as in brush-written letters', () => {
    const frames = cell.quests.map((q) =>
      q.steps.flatMap((s) => s.discover?.pages ?? []).flatMap((p) => p.items).flatMap((i) => (i.type === 'pattern' ? [i.frame.ko] : [])),
    );
    expect(frames).toEqual([['___에게'], ['오늘 ___을/를 썼어요.'], ['___에서 만나요.']]);
    const words = cell.quests.flatMap((q) => q.steps.flatMap((s) => s.discover?.pages ?? []).flatMap((p) => p.items).flatMap((i) => (i.type === 'word' ? [i.word.ko] : [])));
    expect(words).toEqual(['편지', '일기']);
    // q2 traces the letter words and the writing brush itself, beside the 궁체 note (n2, the q2 Did you know? tip).
    const trace = scopeOf(cell.quests[1]!, 'practice')!;
    expect(trace.kind).toBe('trace-word');
    if (trace.kind !== 'trace-word') return;
    expect(trace.rounds.map((r) => r.word.ko)).toEqual(['일기', '편지', '붓', '한글']);
  });

  it('asks nothing by ear (no Dictation round)', () => {
    for (const quest of cell.quests) {
      for (const scope of quest.scopes) {
        if (scope.kind === 'type-hangul') for (const round of scope.rounds) expect(round.mode, `${scope.ref} ${round.id}`).not.toBe('hear');
      }
    }
  });

  it('every letter goes to a friend or the cast, never to the learner\'s own family, and takes 에게 (§6.6; the 께 note, n3)', () => {
    const PERSONAL = /가족|엄마|아빠|할머니|할아버지|동생|언니|오빠|누나|형|선생님/;
    const receivers = new Set<string>();
    for (const quest of cell.quests) {
      for (const scope of quest.scopes) {
        const texts = JSON.stringify(scope).match(/"ko":"([^"]*)"/g) ?? [];
        for (const t of texts) expect(PERSONAL.test(t), `${scope.ref} ${t}`).toBe(false);
        for (const m of JSON.stringify(scope).matchAll(/([가-힣]+)에게/g)) receivers.add(m[1]!);
      }
    }
    expect([...receivers].sort()).toEqual(['미나', '친구', '호야']);
  });
});

describe('the My Story chain of q3 Apply (§7.1 F8, §6.6, rows CM-38 and CM-44 S7)', () => {
  const [chain] = chainOf(cell);

  it("is the cell's only chain, three word-bank frames that each parse as a My Story frame: who it is for, where you go today, where to meet", () => {
    expect(chainOf(cell)).toHaveLength(1);
    expect(chain!.ref).toBe('minigame:s7-letters-v2-q3-apply');
    expect(chain!.frames.map((f) => f.frame.ko)).toEqual(['___에게', '오늘 ___에 가요.', '___에서 만나요.']);
    for (const frame of chain!.frames) {
      expect(MyStoryFrameSchema.safeParse(frame).success, frame.id).toBe(true);
      expect(frame.freeEntry, frame.id).toBe(false);
      expect(MY_STORY_PRIVATE_TOPICS.test(frame.frame.en), frame.id).toBe(false);
    }
  });

  it('every slot offers exactly one neutral option, never first, that tells nothing about the learner: Hoya, and the park', () => {
    const neutral = chain!.frames.map((f) => f.slots.map((s) => s.bank.filter((w) => w.neutral === true).map((w) => w.ko)));
    expect(neutral).toEqual([[['호야']], [['공원']], [['공원']]]);
    for (const frame of chain!.frames) for (const slot of frame.slots) expect(slot.bank[0]!.neutral, `${frame.id} ${slot.id}`).toBeUndefined();
    const PERSONAL = /가족|엄마|아빠|할머니|할아버지|동생|언니|오빠|누나|형|기분|기뻐|슬퍼|행복|집/;
    for (const frame of chain!.frames) for (const slot of frame.slots) for (const w of slot.bank) expect(PERSONAL.test(w.ko), w.ko).toBe(false);
  });

  it('the frames after the first are taught by steps that play with the switch off (the CM-38 hand-off): Volume 1\'s 오늘 ___에 가요 and the q3 Discover and Check', () => {
    const life1 = LessonCellSchema.parse(read('content/episodes/stage-7/life.json'));
    const lifeFrames = life1.quests.flatMap((q) => q.steps.flatMap((s) => s.discover?.pages ?? []).flatMap((p) => p.items).flatMap((i) => (i.type === 'pattern' ? [normalizeKo(i.frame.ko)] : [])));
    expect(lifeFrames).toContain(normalizeKo(chain!.frames[1]!.frame.ko));
    const q3 = cell.quests[2]!;
    const q3Frames = q3.steps.flatMap((s) => s.discover?.pages ?? []).flatMap((p) => p.items).flatMap((i) => (i.type === 'pattern' ? [normalizeKo(i.frame.ko)] : []));
    expect(q3Frames).toContain(normalizeKo(chain!.frames[2]!.frame.ko));
  });

  it('with game.my-story off (its launch state) the step plays Write Frame on the first frame, a postcard\'s opening line', () => {
    const scope = LESSON_STAGE_MODULES[7].LESSON_SCOPES[chain!.ref]!;
    const played = playedScope(scope, () => false);
    expect(played.kind).toBe('write-frame');
    expect(played.writeFrame?.rounds.map((r) => r.frame.ko)).toEqual(['___에게']);
    expect(played.writeFrame?.rounds[0]!.slots[0]!.bank.map((w) => w.ko)).toEqual(['친구', '미나', '호야']);
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
    expect(lines).toBe(3 * 10);
  });
});
