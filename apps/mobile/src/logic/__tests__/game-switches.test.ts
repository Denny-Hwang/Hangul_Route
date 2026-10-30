import { MinigameKindSchema, type MinigameKind } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { currBuiltInPct, currBuildFloor, type CurrFlagName } from '../../config/flags';
import { questsAll } from '../../content';
import { STORY_ORDER_FIXTURES } from '../../navigation/story-order-e2e-fixture';
import { GAME_SWITCHES, renderedKind } from '../game-switches';
import { scopeFor } from '../minigame-config';
import { PLAYABLE_KINDS } from '../minigame-renderers';
import { STORY_ORDER_FLAG, playableStoryOrder, storyOrderFallbackScopes, storyOrderKeyPrefix } from '../story-order/fallback';

/**
 * F-CURR-002 section 12.2: no `game.<kind>` switch bricks shipped content. A table check over the whole catalogue: each
 * game step's kind, with every switch off, is a kind the app plays, and a Story Order step's fallback has a Story
 * Sequence to play for each of its rounds (row CM-34). `StoryOrderStep` reads the same table (`renderedKind`); the
 * fallback itself is rendered, switch off, for every catalogue step of a gated kind (none authored yet) and every fixture
 * in `screens/minigames/story-order/__tests__/StoryOrderStep.test.tsx`, and in the fixture e2e.
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
