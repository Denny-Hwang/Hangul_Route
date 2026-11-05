import { ListenPickRoundSchema, LessonScopeSchema, PicWordRoundSchema, isSpellingRound, typeHangulMode, type MinigameKind } from '@hangul-route/content-schema';
import { decodeReviewItems } from '@hangul-route/content-schema/review-items';
import { describe, expect, it } from 'vitest';
import { localizeScope } from '../../logic/content-locale';
import { applyGameSwitches, DICTATION_SWITCH, needsDictationChunk, SPELLING_SWITCH } from '../../logic/game-switches';
import { picWordFallback } from '../../logic/hidden-heritage-fallback';
import { PLAYABLE_KINDS } from '../../logic/minigame-renderers';
import { scopeFor, type MinigameScope } from '../../logic/minigame-config';
import { soundKeyOf } from '../../logic/syllable-build/pool';
import { fallbackScope } from '../../logic/syllable-build/fallback';
import * as reviewChunk from '../__generated__/review-item-chunks/review-items';
import { volumeEpisodes } from '../episodes';
import { questsAll } from '../quests';
import { LESSON_STAGE_MODULES } from './helpers/lesson-stages';

/**
 * Letters & Books Volume 2, Stage 2 (F-CURR-002 §5.2 S2, row CM-44 S2): the cell ships behind `volumes` and its new
 * formats each behind their `game.<kind>` switch at built-in pct 0. With every switch off, each step of each quest still
 * plays a shipped kind: Syllable Build as Listen & Pick on the built block (row CM-32), Hidden Heritage as Pic-Word Match
 * on the same targets (row CM-36), the spelling round as Listen & Pick on the same word (row CM-31).
 */

const EPISODE = volumeEpisodes.find((e) => e.id === 'episode:stage2-letters-v2');
const QUESTS = questsAll.filter((q) => EPISODE?.questIds.includes(q.id));
const steps = QUESTS.flatMap((quest) =>
  quest.steps.flatMap((step) => {
    const scope = step.minigameRef ? scopeFor(step.minigameRef) : undefined;
    return scope ? [{ at: `${quest.id} ${step.kind}`, kind: step.minigameKind as MinigameKind, scope }] : [];
  }),
);

/** The four `game.<kind>` switches the cell's steps read. */
const SWITCHES = ['game.syllable-build', 'game.hidden-heritage', SPELLING_SWITCH, DICTATION_SWITCH] as const;
type CellSwitch = (typeof SWITCHES)[number];

/**
 * The scope a step plays, through the app's own off paths: `SyllableBuildStepBody` plays `fallbackScope` (a seed per
 * round), `HiddenHeritageStep` plays `picWordFallback`, and the Listen & Pick and Type Hangul steps play
 * `applyGameSwitches` (the spelling round and Dictation).
 */
function played(scope: MinigameScope, on: (flag: CellSwitch) => boolean): MinigameScope {
  if (scope.kind === 'syllable-build') return on('game.syllable-build') ? scope : fallbackScope(scope);
  if (scope.kind === 'hidden-heritage') return on('game.hidden-heritage') ? scope : picWordFallback(scope);
  return applyGameSwitches(scope, (flag) => on(flag as CellSwitch));
}

/** The scope a step plays with every `game.<kind>` switch off. */
const switchedOff = (scope: MinigameScope): MinigameScope => played(scope, () => false);

/** The cell's review items as the app decodes them (row CM-44 S2: Volume 2's items). */
const ITEMS = decodeReviewItems(reviewChunk);

describe('Letters & Books Volume 2, Stage 2 (row CM-44 S2)', () => {
  it('ships three quests of six steps on its own Volume 2 episode', () => {
    expect(EPISODE?.volume).toBe(2);
    expect(QUESTS.map((q) => q.id)).toEqual(['quest:stage2-letters-v2-q1', 'quest:stage2-letters-v2-q2', 'quest:stage2-letters-v2-q3']);
    for (const q of QUESTS) expect(q.steps.map((s) => s.kind)).toEqual(['intro', 'discover', 'practice', 'apply', 'check', 'reward']);
  });

  it('plays Syllable Build, Hidden Heritage (scene:letters-school) and the spelling round, each in one Apply', () => {
    const applies = steps.filter((s) => s.at.endsWith(' apply'));
    expect(applies.map((s) => s.kind)).toEqual(['syllable-build', 'hidden-heritage', 'listen-pick']);
    expect(applies[1]?.scope.hiddenHeritage?.rounds[0]?.sceneId).toBe('scene:letters-school');
    expect(applies[2]?.scope.listenPick?.rounds.every(isSpellingRound)).toBe(true);
    // The lesson scope parses as authored (the syllable-build arm of LessonScopeSchema).
    const build = applies[0]!.scope.syllableBuild!.rounds;
    expect(LessonScopeSchema.safeParse({ ref: 'minigame:s2-letters-v2-q1-apply', kind: 'syllable-build', rounds: build }).success).toBe(true);
    expect(build.map((r) => r.target.ko)).toEqual(['손', '곰', '강', '입']);
  });

  it("shows each built block's meaning in the UI language, from the cell's overlay (syllableBuild...target.gloss)", () => {
    const ref = 'minigame:s2-letters-v2-q1-apply';
    const scope = steps.find((s) => s.kind === 'syllable-build')!.scope;
    const overlays = LESSON_STAGE_MODULES[2].LESSON_SCOPE_OVERLAYS;
    const meanings = (locale: 'en' | 'es' | 'ko') => localizeScope(scope, ref, locale, overlays).syllableBuild!.rounds.map((r) => r.target.en);
    expect(meanings('en')).toEqual(['hand', 'bear', 'river', 'mouth']);
    expect(meanings('es')).toEqual(['mano', 'oso', 'río', 'boca']);
    // ko meanings describe the word and never name the block being built.
    const ko = meanings('ko');
    expect(ko.every((m) => typeof m === 'string' && m.length > 0)).toBe(true);
    scope.syllableBuild!.rounds.forEach((r, i) => expect(ko[i], r.id).not.toContain(r.target.ko));
  });

  it('with every game switch off, every step plays a shipped kind whose rounds parse', () => {
    expect(steps).toHaveLength(9);
    for (const { at, scope } of steps) {
      const off = switchedOff(scope);
      expect(PLAYABLE_KINDS, at).toContain(off.kind);
      expect(['syllable-build', 'hidden-heritage'], at).not.toContain(off.kind);
      for (const r of off.listenPick?.rounds ?? []) {
        // The built-block fallback (row CM-32) is derived at run time: its other blocks are bare blocks with no meaning,
        // which the authored round schema does not take, so it is held to the shape the game reads instead.
        if (scope.kind === 'syllable-build') {
          expect(r.options.length, `${at} ${r.id}`).toBeGreaterThanOrEqual(3);
          expect(r.options.map((o) => o.id), `${at} ${r.id}`).toContain(r.answerId);
        } else {
          expect(ListenPickRoundSchema.safeParse(r).success, `${at} ${r.id}`).toBe(true);
        }
        expect(isSpellingRound(r), `${at} ${r.id}`).toBe(false);
      }
      for (const b of off.picWord?.boards ?? []) expect(PicWordRoundSchema.safeParse(b).success, at).toBe(true);
      expect(needsDictationChunk(off), at).toBe(false);
    }
  });

  it('Syllable Build off: Listen & Pick on the built block, the target among blocks that never sound alike', () => {
    const scope = steps.find((s) => s.kind === 'syllable-build')!.scope;
    const build = scope.syllableBuild!.rounds;
    // The app's off path (SyllableBuildStepBody): fallbackScope, a seed per round.
    const picks = fallbackScope(scope).listenPick!.rounds;
    expect(picks).toHaveLength(build.length);
    for (const [i, round] of build.entries()) {
      const pick = picks[i]!;
      const options = pick.options.map((o) => o.text!.ko);
      expect(options[0], round.id).toBe(round.target.ko);
      expect(options.length, round.id).toBeGreaterThanOrEqual(3);
      expect(new Set(options.map(soundKeyOf)).size, round.id).toBe(options.length);
      expect(pick.prompt.en, round.id).toBe(round.target.en);
    }
  });

  it('the spelling round off: the look-alike goes, and the options left all sound different', () => {
    const spelling = steps.find((s) => s.scope.listenPick?.rounds.some(isSpellingRound))!;
    const off = applyGameSwitches(spelling.scope, () => false);
    for (const [i, r] of off.listenPick!.rounds.entries()) {
      const before = spelling.scope.listenPick!.rounds[i]!;
      const lookAlike = before.options.find((o) => o.id !== before.answerId)!.text!.ko;
      expect(r.options.map((o) => o.text?.ko), r.id).not.toContain(lookAlike);
      expect(r.options[0]?.id, r.id).toBe(before.answerId);
      // The romanization is the pronunciation (F-CNT-002 converter), so options that sound alike share it (책이 and 채기
      // are both chaegi): every option left has its own.
      const sounds = r.options.map((o) => o.text!.romanization);
      expect(new Set(sounds).size, r.id).toBe(sounds.length);
    }
  });

  it('every quest with each game switch off, one at a time, plays shipped kinds whose rounds parse', () => {
    for (const off of SWITCHES) {
      const on = (flag: CellSwitch): boolean => flag !== off;
      for (const { at, scope } of steps) {
        const now = played(scope, on);
        const where = `${off} off: ${at}`;
        expect(PLAYABLE_KINDS, where).toContain(now.kind);
        if (off === 'game.syllable-build') expect(now.kind, where).not.toBe('syllable-build');
        if (off === 'game.hidden-heritage') expect(now.kind, where).not.toBe('hidden-heritage');
        if (off === SPELLING_SWITCH) expect((now.listenPick?.rounds ?? []).some(isSpellingRound), where).toBe(false);
        if (off === DICTATION_SWITCH) expect((now.typeHangul?.rounds ?? []).some((r) => typeHangulMode(r) === 'hear'), where).toBe(false);
        if (scope.kind !== 'syllable-build') for (const r of now.listenPick?.rounds ?? []) expect(ListenPickRoundSchema.safeParse(r).success, `${where} ${r.id}`).toBe(true);
        for (const b of now.picWord?.boards ?? []) expect(PicWordRoundSchema.safeParse(b).success, where).toBe(true);
      }
    }
  });

  it('every word with a sound change keeps hear-pick and stays out of Dictation (section 4.2), liaison included', () => {
    // 책이 [채기] and 음악 [으막] (liaison) carry `soundChange: true` on their Discover word, since the converter reads liaison
    // as no change; 국물, 박물관 and 학년 (nasalization) and 학교 and 학생 (tensification) are read by the converter.
    const words = ['책이', '음악', '국물', '박물관', '학년', '학교', '학생'];
    for (const ko of words) {
      const item = ITEMS.find((i) => i.kind === 'lex' && i.ko === ko);
      expect(item, ko).toBeDefined();
      expect(item!.soundChange, ko).toBe(true);
      expect(item!.formats, ko).not.toContain('dictation');
    }
    // No q2 or q3 step asks one of them by ear in Type Hangul.
    for (const { at, scope } of steps) for (const r of scope.typeHangul?.rounds ?? []) expect(typeHangulMode(r), `${at} ${r.id}`).toBe('see');
  });

  it('ko: a typed word or a spelling round never shows a block of its answer in its prompt or meaning', () => {
    const overlays = LESSON_STAGE_MODULES[2].LESSON_SCOPE_OVERLAYS;
    const leaks: string[] = [];
    const check = (where: string, answer: string, shown: readonly string[]): void => {
      const blocks = [...answer].filter((c) => /[가-힣]/.test(c));
      for (const text of shown) for (const b of blocks) if (text.includes(b)) leaks.push(`${where}: ${b} in ${text}`);
    };
    for (const { at, scope } of steps) {
      const ref = QUESTS.flatMap((q) => q.steps).find((st) => st.minigameRef !== undefined && scopeFor(st.minigameRef) === scope)?.minigameRef;
      const ko = ref === undefined ? undefined : localizeScope(scope, ref, 'ko', overlays);
      for (const r of ko?.typeHangul?.rounds ?? []) check(`${at} ${r.id}`, scope.typeHangul!.rounds.find((x) => x.id === r.id)!.target.ko, [r.promptEn, r.target.en]);
      for (const r of (ko?.listenPick?.rounds ?? []).filter(isSpellingRound)) {
        const answer = r.options.find((o) => o.id === r.answerId)!.text!.ko;
        check(`${at} ${r.id}`, answer, [r.prompt.en]);
      }
    }
    expect(leaks).toEqual([]);
  });

  it('Hidden Heritage off: one Pic-Word Match board of the three targets, each with its own picture', () => {
    const scope = steps.find((s) => s.kind === 'hidden-heritage')!.scope;
    const board = picWordFallback(scope).picWord!.boards[0]!;
    expect(board.pairs.map((p) => [p.word.ko, p.pictureRef])).toEqual([
      ['책', 'card:book'],
      ['붓', 'card:brush'],
      ['나무', 'word:nature-tree'],
    ]);
  });
});
