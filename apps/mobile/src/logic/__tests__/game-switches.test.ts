import { RoundSchema, isSpellingRound, typeHangulMode, type KoText, type ListenPickRound, type TypeHangulRound } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { questsAll } from '../../content';
import { DICTATION_SWITCH, SPELLING_SWITCH, applyGameSwitches, needsDictationChunk, switchedFromHear } from '../game-switches';
import { scopeFor, type MinigameScope } from '../minigame-config';

/**
 * F-CURR-002 section 12.2 (row CM-31): with `game.type-hangul-hear` off a Dictation round is the Type Hangul `see`
 * round of the same word, and with `game.spelling-pick` off a spelling round is Listen & Pick on the same word, both
 * decided before the step opens; every quest still renders and plays with the switches off.
 */

const k = (ko: string, romanization: string, en: string): KoText => ({ ko, romanization, en });
const apple: TypeHangulRound = { id: 't1', promptEn: 'Type the word you hear.', mode: 'hear', target: k('사과', 'sagwa', 'apple') };
const water: TypeHangulRound = { id: 't2', promptEn: 'Type this word', target: k('물', 'mul', 'water') };
const book = k('책이', 'chaegi', 'book');
const spelling: ListenPickRound = {
  id: 'sp',
  promptKind: 'spelling',
  prompt: book,
  pictureRef: 'word:book',
  options: [{ id: 'a', text: book }, { id: 'b', text: k('채기', 'chaegi', 'book') }],
  answerId: 'a',
  fallbackOptions: [{ id: 'c', text: k('학교', 'hakgyo', 'school') }, { id: 'd', text: k('우유', 'uyu', 'milk') }],
};
const plainPick: ListenPickRound = { id: 'lp', prompt: k('나무', 'namu', 'tree'), options: [{ id: 'a', text: k('나무', 'namu', 'tree') }, { id: 'b', text: k('바다', 'bada', 'sea') }], answerId: 'a' };
const typeScope: MinigameScope = { kind: 'type-hangul', typeHangul: { rounds: [apple, water] } };
const pickScope: MinigameScope = { kind: 'listen-pick', listenPick: { rounds: [spelling, plainPick] } };
const ALL_OFF = (): boolean => false;
const ALL_ON = (): boolean => true;

describe('applyGameSwitches', () => {
  it('names the switches the design fixes', () => {
    expect([DICTATION_SWITCH, SPELLING_SWITCH]).toEqual(['game.type-hangul-hear', 'game.spelling-pick']);
  });

  it('keeps every round, and the scope object, when the switches are on', () => {
    expect(applyGameSwitches(typeScope, ALL_ON)).toBe(typeScope);
    expect(applyGameSwitches(pickScope, ALL_ON)).toBe(pickScope);
    expect(needsDictationChunk(typeScope)).toBe(true);
    expect(needsDictationChunk(pickScope)).toBe(true);
  });

  it('with game.type-hangul-hear off, plays a Dictation round as the see round of the same word', () => {
    const asked: string[] = [];
    const out = applyGameSwitches(typeScope, (flag) => {
      asked.push(flag);
      return flag !== DICTATION_SWITCH;
    });
    expect(asked).toContain(DICTATION_SWITCH);
    expect(out.typeHangul?.rounds).toEqual([{ ...apple, mode: 'see' }, water]);
    expect(out.typeHangul?.rounds.map(typeHangulMode)).toEqual(['see', 'see']);
    expect(needsDictationChunk(out)).toBe(false);
    // The game draws the turned round as an ordinary see round (its heading too); a round written as see is untouched.
    expect(switchedFromHear(out.typeHangul!.rounds[0]!)).toBe(true);
    expect(switchedFromHear(out.typeHangul!.rounds[1]!)).toBe(false);
    expect(switchedFromHear(apple)).toBe(false);
    // The input is not changed.
    expect(typeScope.typeHangul?.rounds[0]?.mode).toBe('hear');
  });

  it('with game.spelling-pick off, plays a spelling round as Listen & Pick on the same word', () => {
    const out = applyGameSwitches(pickScope, (flag) => flag !== SPELLING_SWITCH);
    expect(out.listenPick?.rounds[0]).toEqual({ id: 'sp', prompt: book, options: [{ id: 'a', text: book }, ...(spelling.fallbackOptions ?? [])], answerId: 'a' });
    expect(out.listenPick?.rounds[1]).toBe(plainPick);
    expect(needsDictationChunk(out)).toBe(false);
  });

  it('leaves a scope with neither format alone, and asks no switch for it', () => {
    const scope: MinigameScope = { kind: 'listen-pick', listenPick: { rounds: [plainPick] } };
    expect(applyGameSwitches(scope, () => {
      throw new Error('no switch is read');
    })).toBe(scope);
    expect(needsDictationChunk({})).toBe(false);
  });
});

describe('every quest with the switches off (section 14)', () => {
  const scopes = questsAll.flatMap((quest) =>
    quest.steps.flatMap((step, i) => {
      const scope = step.minigameRef ? scopeFor(step.minigameRef) : undefined;
      return scope ? [{ at: `${quest.id} step ${i}`, scope }] : [];
    }),
  );

  it('reaches the game scopes of the shipped quests', () => {
    expect(scopes.length).toBeGreaterThan(100);
  });

  it('renders as shipped rounds only: no Dictation or spelling round is left, and every round still parses', () => {
    // No shipped quest has a Dictation or spelling round yet, so each scope is also checked written as one: the off
    // path then has something to turn (the render loop in screens/minigames/__tests__/switched-step.test.tsx mounts them).
    const written = scopes.flatMap(({ at, scope }) => {
      const variants = [{ at, scope }];
      if (scope.typeHangul) variants.push({ at: `${at} (as Dictation)`, scope: { ...scope, typeHangul: { rounds: scope.typeHangul.rounds.map((r) => ({ ...r, mode: 'hear' as const })) } } });
      if (scope.listenPick) variants.push({ at: `${at} (with a spelling round)`, scope: { ...scope, listenPick: { rounds: [spelling, ...scope.listenPick.rounds] } } });
      return variants;
    });
    const turned = written.filter(({ scope }) => needsDictationChunk(scope));
    expect(turned.length).toBeGreaterThan(0);
    for (const { at, scope } of turned) expect(applyGameSwitches(scope, ALL_OFF), at).not.toBe(scope);
    for (const { at, scope } of written) {
      const off = applyGameSwitches(scope, ALL_OFF);
      expect(needsDictationChunk(off), at).toBe(false);
      for (const round of off.typeHangul?.rounds ?? []) {
        expect(typeHangulMode(round), at).toBe('see');
        expect(RoundSchema.safeParse({ kind: 'type-hangul', data: round }).success, at).toBe(true);
      }
      for (const round of off.listenPick?.rounds ?? []) {
        expect(isSpellingRound(round), at).toBe(false);
        expect(RoundSchema.safeParse({ kind: 'listen-pick', data: round }).success, at).toBe(true);
      }
    }
  });
});
