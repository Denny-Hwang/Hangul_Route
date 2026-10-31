import { ListenPickRoundSchema, LessonScopeSchema, PicWordRoundSchema, isSpellingRound, type MinigameKind } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { localizeScope } from '../../logic/content-locale';
import { applyGameSwitches, needsDictationChunk } from '../../logic/game-switches';
import { picWordFallback } from '../../logic/hidden-heritage-fallback';
import { PLAYABLE_KINDS } from '../../logic/minigame-renderers';
import { scopeFor, type MinigameScope } from '../../logic/minigame-config';
import { soundKeyOf } from '../../logic/syllable-build/pool';
import { syllableBuildToListenPick } from '../../logic/syllable-build/fallback';
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

/** The scope a step plays with every `game.<kind>` switch off. */
function switchedOff(scope: MinigameScope): MinigameScope {
  if (scope.kind === 'syllable-build') {
    return { kind: 'listen-pick', listenPick: { rounds: (scope.syllableBuild?.rounds ?? []).map((r) => syllableBuildToListenPick(r)) } };
  }
  if (scope.kind === 'hidden-heritage') return picWordFallback(scope);
  return applyGameSwitches(scope, () => false);
}

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
    const build = steps.find((s) => s.kind === 'syllable-build')!.scope.syllableBuild!.rounds;
    for (const round of build) {
      const pick = syllableBuildToListenPick(round);
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
    }
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
