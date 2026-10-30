import { SyllableBuildRoundSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { minigameScopes, type MinigameScope } from '../../logic/minigame-config';
import { validRounds } from '../../logic/listen-pick';
import { fallbackScope } from '../../logic/syllable-build/fallback';
import { isRealBlock } from '../../logic/syllable-build/pool';
import { questsAll } from '../quests';
import { ALL_LESSON_SCOPES } from './helpers/lesson-stages';

/**
 * F-CURR-002 sections 7.1 F3, 12.2 and 14 ("every quest renders with each `game.<kind>` off"), row CM-32: with
 * `game.syllable-build` off, every shipped quest step that plays Syllable Build plays Listen & Pick on the built block,
 * with every round playable; every shipped Syllable Build round keeps the round schema and asks a real block (a block
 * of the real-syllable lists, or a taught word with its meaning). No shipped step plays it yet (the S1 additions and S2
 * rows author them), so the fixture scope below stands in, and the loops cover every step as soon as one ships.
 */

const FIXTURE: MinigameScope = {
  kind: 'syllable-build',
  syllableBuild: {
    rounds: [
      { id: 'sb:bap', target: { ko: '밥', romanization: 'bap', en: 'rice, a meal' }, firstTiles: ['ㄱ', 'ㅂ', 'ㅁ', 'ㄷ'], vowelTiles: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ'], finalTiles: ['ㅂ', 'ㄴ', 'ㅇ'] },
      { id: 'sb:ga', target: { ko: '가', romanization: 'ga' }, firstTiles: ['ㄱ', 'ㄴ', 'ㄷ'], vowelTiles: ['ㅏ', 'ㅓ', 'ㅗ'], finalTiles: ['ㄴ', 'ㅇ'] },
      { id: 'sb:but', target: { ko: '붓', romanization: 'but', en: 'writing brush' }, firstTiles: ['ㅂ', 'ㄱ', 'ㅁ'], vowelTiles: ['ㅜ', 'ㅏ', 'ㅗ'], finalTiles: ['ㅅ', 'ㄴ', 'ㅇ'] },
    ],
  },
};

const shippedScopes: Array<[string, MinigameScope]> = [
  ...Object.entries(minigameScopes),
  ...Object.entries(ALL_LESSON_SCOPES).flatMap(([ref, scope]) => (scope ? [[ref, scope] as [string, MinigameScope]] : [])),
].filter(([, scope]) => scope.kind === 'syllable-build');

function fallbackProblems(ref: string, scope: MinigameScope): string[] {
  const rounds = scope.syllableBuild?.rounds ?? [];
  const out: string[] = [];
  if (rounds.length === 0) out.push(`${ref}: a syllable-build scope with no rounds`);
  for (const r of rounds) {
    if (!SyllableBuildRoundSchema.safeParse(r).success) out.push(`${ref}: ${r.id} breaks the round schema`);
    if (!isRealBlock(r.target.ko) && r.target.en === undefined) out.push(`${ref}: ${r.id} asks ${r.target.ko}, which is neither a real block of the lists nor a taught word`);
  }
  const fallback = fallbackScope(scope);
  if (fallback.kind !== 'listen-pick') out.push(`${ref}: the fallback is not Listen & Pick`);
  if (validRounds(fallback).length !== rounds.length) out.push(`${ref}: a fallback round cannot be played`);
  for (const r of fallback.listenPick?.rounds ?? []) if (r.options.length < 3) out.push(`${ref}: ${r.id} offers fewer than 3 blocks`);
  return out;
}

describe('every quest renders with game.syllable-build off', () => {
  it('the fixture scope falls back to playable Listen & Pick rounds of real blocks', () => {
    expect(fallbackProblems('fixture', FIXTURE)).toEqual([]);
  });

  it('every shipped syllable-build step does too', () => {
    expect(shippedScopes.flatMap(([ref, scope]) => fallbackProblems(ref, scope))).toEqual([]);
  });

  it('every shipped quest step names a scope that exists (so no step is left without a round to play)', () => {
    const missing = questsAll
      .flatMap((q) => q.steps.flatMap((s) => (s.minigameRef !== undefined && s.minigameKind === 'syllable-build' ? [s.minigameRef] : [])))
      .filter((ref) => minigameScopes[ref] === undefined && ALL_LESSON_SCOPES[ref] === undefined);
    expect(missing).toEqual([]);
  });
});
