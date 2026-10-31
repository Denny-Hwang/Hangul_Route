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
 * F-CURR-002 row CM-45 S7, Stage 7 Holidays & Traditions Volume 2, My New Year Card (`content/episodes/stage-7/rites.v2.json`):
 * the §5.1 and §5.4 rules for this cell. The shared checks (U-1 to U-11, overlays, the curriculum lint over every file,
 * the review-item freeze, the switch-off pass and the shipped My Story steps) run over it with every other cell; this
 * file holds what is particular to it: three quests whose Practice / Apply / Check triples differ from Volume 1's,
 * Checks of three games, culture notes that are new beside Volume 1's, the receiver's honorific forms (NIKL 언어 예절:
 * 께 to an elder or a teacher, 에게 to a friend), and the My Story chain of q3 Apply (§7.1 F8, §6.6 risk notes): a New
 * Year card from 3 word-bank frames whose first frame chooses the receiver (Hoya's grandmother, a teacher or a friend),
 * a neutral option in every bank, no private topic, no free text, a fallback that reads well alone, and a composed line
 * that reads well for every pick.
 */

const read = (rel: string): unknown => JSON.parse(readFileSync(new URL(`../../../../../${rel}`, import.meta.url), 'utf8'));
const cell: LessonCell = LessonCellSchema.parse(read('content/episodes/stage-7/rites.v2.json'));
const v1: LessonCell = LessonCellSchema.parse(read('content/episodes/stage-7/rites.json'));
// CM-43 S7, the Volume 2 row this one is stacked on: its stamps are the catalogue this cell joins.
const lifeV2: LessonCell = LessonCellSchema.parse(read('content/episodes/stage-7/life.v2.json'));
const koOverlay = read('content/i18n/ko/lessons-stage7-rites-v2.json') as { entries: Record<string, Record<string, string>> };
const esOverlay = read('content/i18n/es/lessons-stage7-rites-v2.json') as { entries: Record<string, Record<string, string>> };

const scopeOf = (quest: LessonQuest, kind: string): LessonScope | undefined => {
  const ref = quest.steps.find((s) => s.kind === kind)?.minigameRef;
  return quest.scopes.find((s) => s.ref === ref);
};
const tripleOf = (quest: LessonQuest): string => ['practice', 'apply', 'check'].map((k) => scopeOf(quest, k)?.kind).join(' / ');
const chainOf = (c: LessonCell) => c.quests.flatMap((q) => q.scopes.filter((s): s is Extract<LessonScope, { kind: 'my-story' }> => s.kind === 'my-story'));

/** Every Korean string of the cell's quests (steps and scopes), for the honorific checks. */
const koStrings = (value: unknown, out: string[] = []): string[] => {
  if (Array.isArray(value)) for (const v of value) koStrings(v, out);
  else if (value !== null && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (key === 'ko' && typeof v === 'string') out.push(v);
      else koStrings(v, out);
    }
  }
  return out;
};

/** Every English string of the cell's quests: `en` glosses and the `...En` copy fields. */
const enStrings = (value: unknown, out: string[] = []): string[] => {
  if (Array.isArray(value)) for (const v of value) enStrings(v, out);
  else if (value !== null && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if ((key === 'en' || key.endsWith('En')) && typeof v === 'string') out.push(v);
      else enStrings(v, out);
    }
  }
  return out;
};

describe('My New Year Card, Stage 7 Holidays & Traditions Volume 2 (F-CURR-002 row CM-45 S7)', () => {
  it('is the Volume 2 of the Stage 7 Holidays & Traditions cell: three quests, ready with both MAR sign-offs, stamped above the catalogue it joined', () => {
    expect(cell.id).toBe('episode:stage7-rites-v2');
    expect(cell.volume).toBe(2);
    expect(cell.titleEn).toBe('My New Year Card');
    expect(cell.status).toBe('ready');
    expect(cell.review).toMatchObject({ language: 'native-reviewed', culture: 'culture-reviewed', reviewedBy: 'MAR' });
    expect(cell.quests.map((q) => q.id)).toEqual(['quest:stage7-rites-v2-q1', 'quest:stage7-rites-v2-q2', 'quest:stage7-rites-v2-q3']);
    const before = Math.max(...lifeV2.quests.map((q) => q.addedIn ?? 0));
    for (const quest of cell.quests) expect(quest.addedIn, quest.id).toBeGreaterThan(before);
    // Row CM-23: one card per upper cell, already Volume 1's (card:saengil); a Volume 2 gives none.
    expect(v1.rewardCardIds).toEqual(['card:saengil']);
    expect(cell.rewardCardIds).toEqual([]);
  });

  it('§5.1: its Practice, Apply and Check triples differ from every Volume 1 triple, and adjacent quests differ', () => {
    const volume1 = new Set(v1.quests.map(tripleOf));
    const triples = cell.quests.map(tripleOf);
    expect(triples).toEqual(['trace-word / type-hangul / cloze-pick', 'order-it / type-hangul / write-frame', 'type-hangul / my-story / order-it']);
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
    const findings = lintCurriculum(tree, { today: '2026-10-31' }).filter((f) => f.file === 'content/episodes/stage-7/rites.v2.json');
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

  it('the notes are new facts: no note repeats a Volume 1 note or cites the same quote', () => {
    const v1Texts = new Set(v1.culture.map((n) => n.textEn));
    const v1Quotes = new Set(v1.culture.flatMap((n) => (n.sources ?? []).map((s) => s.quoteOrLocator)));
    for (const note of cell.culture) {
      expect(v1Texts.has(note.textEn), note.id).toBe(false);
      for (const source of note.sources ?? []) expect(v1Quotes.has(source.quoteOrLocator), `${note.id} ${source.url}`).toBe(false);
    }
    // The New Year card (연하장), New Year wishes (덕담) and the receiver's honorific 께 (NIKL 언어 예절).
    expect(cell.culture.map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
    expect(cell.culture[0]!.textEn).toMatch(/\{ko:연하장\}/);
    expect(cell.culture[1]!.textEn).toMatch(/\{ko:덕담\}/);
    expect(cell.culture[2]!.textEn).toMatch(/\{ko:께\}.*\{ko:에게\}/);
    expect(cell.culture[2]!.sources![0]!.url).toMatch(/^https:\/\/www\.korean\.go\.kr\//);
  });

  it('the receiver takes its honorific form (NIKL 언어 예절): 께 to Grandma and a teacher, 에게 to the friend Hoya, never the other way round', () => {
    const lines = koStrings(cell.quests);
    expect(lines.some((l) => l.includes('할머니께'))).toBe(true);
    expect(lines.some((l) => l.includes('선생님께'))).toBe(true);
    expect(lines.some((l) => l.includes('호야에게'))).toBe(true);
    for (const l of lines) expect(/할머니에게|선생님에게|호야께/.test(l), l).toBe(false);
    // The ko overlay keeps the rule its glosses teach: no honorific receiver (분, 어머니, 할머니, 선생님) before 에게.
    const koTexts = Object.values(koOverlay.entries).flatMap((entry) => Object.values(entry));
    expect(koTexts.length).toBeGreaterThan(100);
    for (const t of koTexts) expect(/(분|어머니|할머니|선생님)에게/.test(t), t).toBe(false);
    // The q1 Check offers no second right answer: the gap before 선생님 holds 께 and no 에게, the gap before 호야 에게 and no 께.
    const check = scopeOf(cell.quests[0]!, 'check')!;
    expect(check.kind).toBe('cloze-pick');
    if (check.kind !== 'cloze-pick') return;
    const [c1, c2] = check.rounds;
    expect(c1!.tiles[c1!.answerIndex]!.ko).toBe('께');
    expect(c1!.tiles.map((t) => t.ko)).not.toContain('에게');
    expect(c2!.tiles[c2!.answerIndex]!.ko).toBe('에게');
    expect(c2!.tiles.map((t) => t.ko)).not.toContain('께');
  });

  it('asks nothing by ear (no Dictation round)', () => {
    for (const quest of cell.quests) {
      for (const scope of quest.scopes) {
        if (scope.kind === 'type-hangul') for (const round of scope.rounds) expect(round.mode, `${scope.ref} ${round.id}`).not.toBe('hear');
      }
    }
  });
});

describe('the My Story chain of q3 Apply (§7.1 F8, §6.6, rows CM-38 and CM-45 S7)', () => {
  const [chain] = chainOf(cell);

  it("is the cell's only chain, three word-bank frames that each parse as a My Story frame: who the card is for with the New Year wish, a line of news, a holiday wish", () => {
    expect(chainOf(cell)).toHaveLength(1);
    expect(chain!.ref).toBe('minigame:s7-rites-v2-q3-apply');
    expect(chain!.frames.map((f) => f.frame.ko)).toEqual(['___, 새해 복 많이 받으세요.', '설날에 ___을/를 먹어요.', '___ 잘 보내세요.']);
    for (const frame of chain!.frames) {
      expect(MyStoryFrameSchema.safeParse(frame).success, frame.id).toBe(true);
      expect(frame.freeEntry, frame.id).toBe(false);
      expect(MY_STORY_PRIVATE_TOPICS.test(frame.frame.en), frame.id).toBe(false);
    }
  });

  it('the receiver is chosen from a word bank: Hoya\'s grandmother, the friend Hoya or a teacher (§5.4 S7), and every frame suits all three', () => {
    expect(chain!.frames[0]!.slots[0]!.bank.map((w) => w.ko)).toEqual(['할머니', '호야', '선생님']);
    expect(cell.subtitleEn).toMatch(/Hoya's grandmother/);
    // §6.6: the cast is Hoya's family, never the learner's own, so 할머니 reads as Hoya's grandma in every locale's bank.
    const grandma = chain!.frames[0]!.slots[0]!.bank[0]!;
    expect(grandma.en).toBe("Hoya's grandma");
    const bankKey = 'myStory.frames.f1.slots.who.bank.halmeoni.gloss';
    expect(esOverlay.entries[chain!.ref]![bankKey]).toBe('abuela de Hoya');
    expect(koOverlay.entries[chain!.ref]![bankKey]).toBe('호야의 할머니');
    // Every English line that names her (prompts, glosses, examples) says whose grandma she is.
    const enGrandma = enStrings(cell.quests).filter((l) => /grandma/i.test(l));
    expect(enGrandma.length).toBeGreaterThanOrEqual(6);
    for (const line of enGrandma) expect(line, line).toMatch(/Hoya's grandma/i);
    // The chain is one line of frames, so no later frame can follow the pick: a wish to the receiver ends in the
    // polite -(으)세요 (받으세요, 보내세요), safe to write to anyone (a learning-design choice; the Discover notes add that a
    // close friend also hears the plain form), and the line about the writer's holiday is plain polite 해요체 (먹어요).
    // No frame puts the receiver after a verb that would need its humble form for an elder (만나요 for 뵈어요).
    expect(chain!.frames.map((f) => /(받으세요|보내세요|먹어요)\.$/.test(f.frame.ko))).toEqual([true, true, true]);
    for (const frame of chain!.frames) expect(/만나요|줘요|있어요/.test(frame.frame.ko), frame.id).toBe(false);
  });

  it('every slot offers exactly one neutral option, never first, that tells nothing about the learner: Hoya, rice and the weekend', () => {
    const neutral = chain!.frames.map((f) => f.slots.map((s) => s.bank.filter((w) => w.neutral === true).map((w) => w.ko)));
    expect(neutral).toEqual([[['호야']], [['밥']], [['주말']]]);
    for (const frame of chain!.frames) for (const slot of frame.slots) expect(slot.bank[0]!.neutral, `${frame.id} ${slot.id}`).toBeUndefined();
    // The one family word is Hoya's grandmother, the receiver §5.4 names; no bank holds a feeling or another family word,
    // so nobody has to share either to finish (§6.6 risk notes).
    const PERSONAL = /가족|엄마|아빠|할아버지|동생|언니|오빠|누나|형|기분|기뻐|슬퍼|행복/;
    for (const frame of chain!.frames) for (const slot of frame.slots) for (const w of slot.bank) expect(PERSONAL.test(w.ko), w.ko).toBe(false);
  });

  it('frame 1 is the q3 Discover frame, and frames 2 and 3 and their words are the q2 Check, so the switch-off path has taught them (the CM-38 hand-off)', () => {
    const discover = cell.quests[2]!.steps.find((s) => s.kind === 'discover')!.discover!;
    const frames = discover.pages.flatMap((p) => p.items.flatMap((i) => (i.type === 'pattern' ? [normalizeKo(i.frame.ko)] : [])));
    expect(frames).toContain(normalizeKo(chain!.frames[0]!.frame.ko));
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
    expect(played.writeFrame?.rounds.map((r) => r.frame.ko)).toEqual(['___, 새해 복 많이 받으세요.']);
    expect(played.writeFrame?.rounds[0]!.slots[0]!.bank.map((w) => w.ko)).toEqual(['할머니', '호야', '선생님']);
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
          const words = line.split(/[\s,.:¡!]+/).filter(Boolean);
          expect(words.some((w, i) => i > 0 && w === words[i - 1]), `${locale} ${frame.id}: ${line}`).toBe(false);
          if (locale === 'ko') expect(word.en.length, word.en).toBeLessThanOrEqual(20);
        }
      }
    }
    expect(lines).toBe(3 * 9);
  });

  it('the whole card holds together for every combination of picks, in en, es and ko: a New Year card written before Seollal, then a wish for it', () => {
    const LOCALES: readonly UiLocale[] = ['en', 'es', 'ko'];
    const module = LESSON_STAGE_MODULES[7];
    const scope = module.LESSON_SCOPES[chain!.ref]!;
    // The Korean: frame 2 is present tense (the coming Seollal), and frame 3 wishes only Seollal, the holiday or the
    // weekend, so no card reports Seollal as past and then wishes for it, or wishes a Chuseok in a New Year card.
    expect(chain!.frames[1]!.frame.ko).not.toMatch(/었|았/);
    expect(chain!.frames[2]!.slots[0]!.bank.map((w) => w.ko)).toEqual(['설날', '명절', '주말']);
    let cards = 0;
    for (const locale of LOCALES) {
      const [f1, f2, f3] = localizeScope(scope, chain!.ref, locale, module.LESSON_SCOPE_OVERLAYS).myStory?.frames ?? [];
      for (const a of f1!.slots[0]!.bank) {
        for (const b of f2!.slots[0]!.bank) {
          for (const c of f3!.slots[0]!.bank) {
            const card = [fillGloss(f1!.frame.en, [a.en]), fillGloss(f2!.frame.en, [b.en]), fillGloss(f3!.frame.en, [c.en])].join(' ');
            cards += 1;
            expect(card, `${locale}: ${card}`).not.toContain('___');
            expect(/\b(ate|com[ií])\b|먹은|먹었/.test(card), `${locale}: ${card}`).toBe(false);
            expect(/Chuseok|cosecha|harvest|가을 보름/i.test(card), `${locale}: ${card}`).toBe(false);
          }
        }
      }
    }
    expect(cards).toBe(3 * 27);
  });
});
