import { MinigameKindSchema, RoundSchema, isSpellingRound, typeHangulMode, type KoText, type ListenPickRound, type MinigameKind, type TypeHangulRound } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { currBuiltInPct, currBuildFloor, type CurrFlagName } from '../../config/flags';
import { questsAll } from '../../content';
import { STORY_ORDER_FIXTURES } from '../../navigation/story-order-e2e-fixture';
import { DICTATION_SWITCH, GAME_SWITCHES, SPELLING_SWITCH, applyGameSwitches, needsDictationChunk, renderedKind, switchedFromHear } from '../game-switches';
import { scopeFor, type MinigameScope } from '../minigame-config';
import { PLAYABLE_KINDS } from '../minigame-renderers';
import { STORY_ORDER_FLAG, playableStoryOrder, storyOrderFallbackScopes, storyOrderKeyPrefix } from '../story-order/fallback';

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

  it('the shipped Stage 2 Dictation Checks (row CM-3A S2): 7 steps, 14 hear rounds, each a see round with the switch off', () => {
    const dictation = scopes.filter(({ at, scope }) => at.startsWith('quest:stage2-') && (scope.typeHangul?.rounds ?? []).some((r) => typeHangulMode(r) === 'hear'));
    expect(dictation).toHaveLength(7);
    expect(dictation.flatMap(({ scope }) => scope.typeHangul!.rounds)).toHaveLength(14);
    for (const { at, scope } of dictation) {
      expect(needsDictationChunk(scope), at).toBe(true);
      const off = applyGameSwitches(scope, ALL_OFF);
      expect(off.typeHangul!.rounds.map((r) => typeHangulMode(r)), at).toEqual(['see', 'see']);
    }
  });

  it('renders as shipped rounds only: no Dictation or spelling round is left, and every round still parses', () => {
    // The seven Stage 2 Dictation Checks (row CM-3A S2) are shipped hear rounds; no shipped quest has a spelling round
    // yet, and each scope is also checked written as one, so the off path has more to turn (the render loop in
    // screens/minigames/__tests__/switched-step.test.tsx mounts them).
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

/**
 * F-CURR-002 section 12.2: no `game.<kind>` switch bricks shipped content. A table check over the whole catalogue: each
 * game step's kind, with every switch off, is a kind the app plays, and a Story Order step's fallback has a Story
 * Sequence to play for each of its rounds (row CM-34). `StoryOrderStep` reads the same table (`renderedKind`); the
 * fallback itself is rendered, switch off, in `screens/minigames/story-order/__tests__/StoryOrderStep.test.tsx` and the
 * fixture e2e, since no catalogue quest plays Story Order yet.
 */

const OFF = (): boolean => false;

describe('GAME_SWITCHES', () => {
  it('each switch is a game.<kind> flag at built-in pct 0 (merges dark) whose fallback is a shipped, playable kind', () => {
    for (const [kind, gate] of Object.entries(GAME_SWITCHES) as Array<[MinigameKind, { flag: CurrFlagName; fallback: MinigameKind }]>) {
      expect(MinigameKindSchema.options).toContain(kind);
      expect(gate.flag).toBe(`game.${kind}`);
      expect(currBuiltInPct(gate.flag)).toBe(0);
      expect(currBuildFloor(gate.flag)).toBe(true);
      expect(PLAYABLE_KINDS.has(gate.fallback)).toBe(true);
      expect(GAME_SWITCHES[gate.fallback]).toBeUndefined();
    }
    expect(GAME_SWITCHES['story-order']).toEqual({ flag: STORY_ORDER_FLAG, fallback: 'story-sequence' });
  });

  it('renderedKind: the kind itself while its switch is on, its fallback while off; an ungated kind is itself', () => {
    expect(renderedKind('story-order', () => true)).toBe('story-order');
    expect(renderedKind('story-order', OFF)).toBe('story-sequence');
    expect(renderedKind('listen-pick', OFF)).toBe('listen-pick');
  });

  it('every gated kind, switch off, renders its fallback and never itself; the fallback is ungated, so off is never a gated game', () => {
    for (const kind of Object.keys(GAME_SWITCHES) as MinigameKind[]) {
      const off = renderedKind(kind, OFF);
      expect(off, kind).not.toBe(kind);
      expect(GAME_SWITCHES[off], kind).toBeUndefined();
      expect(renderedKind(off, OFF), kind).toBe(off);
      expect(PLAYABLE_KINDS.has(off), kind).toBe(true);
    }
  });
});

describe('every quest step maps to a playable kind with every game switch off (table check)', () => {
  const steps = questsAll.flatMap((quest) => quest.steps.flatMap((step, i) => (step.minigameRef ? [{ quest: quest.id, i, ref: step.minigameRef }] : [])));

  it('walks the whole catalogue', () => {
    expect(steps.length).toBeGreaterThan(200);
  });

  it('each game step plays a kind the app can play (voice-echo stays behind its own flag)', () => {
    for (const { quest, i, ref } of steps) {
      const scope = scopeFor(ref);
      if (!scope || scope.kind === 'voice-echo') continue;
      expect(PLAYABLE_KINDS.has(renderedKind(scope.kind, OFF)), `${quest} step ${i} ${ref}`).toBe(true);
      // A gated kind in the catalogue (CM-3A's Story Order Checks, once authored) never plays itself with its switch off.
      if (GAME_SWITCHES[scope.kind]) expect(renderedKind(scope.kind, OFF), `${quest} step ${i} ${ref}`).not.toBe(scope.kind);
    }
  });

  it('a Story Order step falls back to one Story Sequence of three or more text cards per round', () => {
    const scopes = [...steps.map((s) => scopeFor(s.ref)).filter((s) => s?.kind === 'story-order'), ...Object.values(STORY_ORDER_FIXTURES)];
    for (const scope of scopes) {
      const rounds = playableStoryOrder(scope!);
      const fallback = storyOrderFallbackScopes(scope!);
      expect(fallback).toHaveLength(rounds.length);
      fallback.forEach((seq, i) => {
        expect(seq.kind).toBe('story-sequence');
        expect(seq.storySteps!.length).toBeGreaterThanOrEqual(3);
        expect(seq.storySteps!.map((s) => s.id)).toEqual(rounds[i]!.panels.map((p) => p.id));
        for (const s of seq.storySteps!) expect(s.romanization, s.labelKo).toBeTruthy();
      });
    }
    expect(storyOrderKeyPrefix('day')).toBe('so:day:');
  });

  it('the fallback keeps the lines, their romanization and their gloss, and draws no picture', () => {
    const [seq] = storyOrderFallbackScopes(STORY_ORDER_FIXTURES.twoRounds);
    expect(seq!.storySteps![0]).toEqual({ id: 'sun', labelEn: 'In the morning the sun comes up.', labelKo: '아침에 해가 떠요.', romanization: 'achime haega tteoyo' });
    expect(storyOrderFallbackScopes(STORY_ORDER_FIXTURES.empty)).toEqual([]);
    expect(playableStoryOrder({ kind: 'story-order' })).toEqual([]);
  });
});
