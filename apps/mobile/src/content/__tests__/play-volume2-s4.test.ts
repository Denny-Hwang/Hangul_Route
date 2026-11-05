import { describe, expect, it } from 'vitest';
import { clozeFallbackScope } from '../../logic/cloze-pick/round';
import type { MinigameScope } from '../../logic/minigame-config';
import { PLAYABLE_KINDS } from '../../logic/minigame-renderers';
import { playedScope, rolePlayMainPath } from '../../logic/role-play/fallback';
import { storyOrderFallbackScopes } from '../../logic/story-order/fallback';
import { episodeById, episodesAll, episodesWithVolumes, volumeEpisodes } from '../episodes';
import { questsAll } from '../quests';
import { ALL_LESSON_SCOPES } from './helpers/lesson-stages';

/**
 * F-CURR-002 row CM-42 S4 (Play Volume 2, Stage 4) at launch state: it ships behind `volumes` (built-in pct 0), and its
 * new formats behind their own `game.<kind>` switches (section 12.2). With each switch off, every step of its three
 * quests plays a shipped kind on the same content: Role Play as Tap to Respond on its main path (row CM-35), Story Order
 * as Story Sequence (row CM-34), Cloze Pick as Listen & Pick with a text prompt (row CM-30).
 */
const EPISODE = 'episode:stage4-crafts-v2';
const QUESTS = questsAll.filter((q) => q.id.startsWith('quest:stage4-crafts-v2-'));
const steps = QUESTS.flatMap((quest) =>
  quest.steps.flatMap((step) => (step.minigameRef === undefined ? [] : [{ at: `${quest.id} ${step.kind}`, scope: ALL_LESSON_SCOPES[step.minigameRef] as MinigameScope }])),
);

/** The kinds a step plays with its `game.<kind>` switch off. */
function playedOff(scope: MinigameScope): string[] {
  if (scope.kind === 'role-play') return [playedScope(scope, false).kind];
  if (scope.kind === 'story-order') return storyOrderFallbackScopes(scope).map((s) => s.kind);
  if (scope.kind === 'cloze-pick') return [clozeFallbackScope(scope).kind];
  return [scope.kind];
}

describe('Play Volume 2, Stage 4, in the app (row CM-42 S4)', () => {
  it('is a shipped later volume of its cell, off the route list', () => {
    expect(volumeEpisodes.map((e) => e.id)).toContain(EPISODE);
    expect(episodesAll.some((e) => e.id === EPISODE)).toBe(false);
    expect(episodesWithVolumes.some((e) => e.id === EPISODE)).toBe(true);
    expect(episodeById(EPISODE)?.questIds).toEqual(QUESTS.map((q) => q.id));
    expect(QUESTS).toHaveLength(3);
  });

  it('every game step has its scope in the bundle', () => {
    expect(steps).toHaveLength(9);
    for (const { at, scope } of steps) expect(scope, at).toBeDefined();
  });

  it('with each game switch off, every step plays a shipped kind on the same content', () => {
    for (const { at, scope } of steps) {
      const kinds = playedOff(scope);
      expect(kinds.length, at).toBeGreaterThan(0);
      for (const kind of kinds) expect(PLAYABLE_KINDS.has(kind as never) && !['role-play', 'story-order', 'cloze-pick'].includes(kind), `${at}: ${kind}`).toBe(true);
    }
  });

  it('a Role Play off plays Tap to Respond on its main path: four turns, one right reply each', () => {
    for (const { at, scope } of steps.filter((s) => s.scope.kind === 'role-play')) {
      const scene = scope.rolePlay?.scene;
      expect(scene, at).toBeDefined();
      const off = playedScope(scope, false);
      expect(off.dialogue?.length, at).toBe(4);
      expect(rolePlayMainPath(scene!)).toHaveLength(4);
      for (const turn of off.dialogue ?? []) {
        expect(turn.options.filter((o) => o.isCorrect), `${at} ${turn.npcKo}`).toHaveLength(1);
        expect(turn.options.length, `${at} ${turn.npcKo}`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
