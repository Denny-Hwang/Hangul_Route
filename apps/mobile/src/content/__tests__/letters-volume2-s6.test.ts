import { describe, expect, it } from 'vitest';
import { clozeFallbackScope, validClozeRounds } from '../../logic/cloze-pick/round';
import { applyGameSwitches, DICTATION_SWITCH, switchedFromHear } from '../../logic/game-switches';
import { validRounds } from '../../logic/listen-pick';
import type { MinigameScope } from '../../logic/minigame-config';
import { PLAYABLE_KINDS } from '../../logic/minigame-renderers';
import { episodeById, episodesAll, episodesWithVolumes, volumeEpisodes } from '../episodes';
import { questsAll } from '../quests';
import { ALL_LESSON_SCOPES } from './helpers/lesson-stages';

/**
 * F-CURR-002 row CM-44 S6 (Letters Volume 2, Stage 6, "Library Day") at launch state: it ships behind `volumes`
 * (built-in pct 0), and its switched formats behind their own flags (section 12.2). With each switch off, every step
 * of its three quests plays a shipped kind on the same content: Cloze Pick as Listen & Pick with a text prompt (row
 * CM-30), and the Dictation Check's hear rounds as Type Hangul see rounds while `game.type-hangul-hear` is at pct 0.
 */
const EPISODE = 'episode:stage6-letters-v2';
const QUESTS = questsAll.filter((q) => q.id.startsWith('quest:stage6-letters-v2-'));
const steps = QUESTS.flatMap((quest) =>
  quest.steps.flatMap((step) => (step.minigameRef === undefined ? [] : [{ at: `${quest.id} ${step.kind}`, scope: ALL_LESSON_SCOPES[step.minigameRef] as MinigameScope }])),
);
const allOff = (): boolean => false;

describe('Letters Volume 2, Stage 6, in the app (row CM-44 S6)', () => {
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

  it('with every game switch off, each step plays a shipped kind with a renderer', () => {
    for (const { at, scope } of steps) {
      const played = scope.kind === 'cloze-pick' ? clozeFallbackScope(scope) : applyGameSwitches(scope, allOff);
      expect(PLAYABLE_KINDS.has(played.kind), `${at}: ${played.kind}`).toBe(true);
      expect(['cloze-pick'].includes(played.kind), at).toBe(false);
    }
  });

  it('a Cloze Pick off plays every one of its rounds as Listen & Pick, each answerable', () => {
    const cloze = steps.filter((s) => s.scope.kind === 'cloze-pick');
    expect(cloze).toHaveLength(3);
    for (const { at, scope } of cloze) {
      const rounds = validRounds(clozeFallbackScope(scope));
      expect(rounds.length, at).toBe(validClozeRounds(scope).length);
      for (const r of rounds) expect(r.options.length >= 2 && r.options.some((o) => o.id === r.answerId), `${at} ${r.id}`).toBe(true);
    }
  });

  it('the Dictation Check plays its hear rounds as see rounds while game.type-hangul-hear is dark', () => {
    const dictation = steps.filter((s) => s.scope.kind === 'type-hangul');
    expect(dictation.map((s) => s.at)).toEqual(['quest:stage6-letters-v2-q1 check']);
    const scope = dictation[0]!.scope;
    expect(scope.typeHangul?.rounds.every((r) => r.mode === 'hear')).toBe(true);
    const off = applyGameSwitches(scope, (flag) => flag !== DICTATION_SWITCH);
    expect(off.typeHangul?.rounds.map((r) => r.mode)).toEqual(['see', 'see']);
    for (const r of off.typeHangul?.rounds ?? []) expect(switchedFromHear(r)).toBe(true);
    expect(off.typeHangul?.rounds.map((r) => r.target.ko)).toEqual(['도서관', '책']);
  });
});
