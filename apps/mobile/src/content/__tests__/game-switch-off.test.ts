import type { MinigameKind } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { clozeFixtureScope } from '../../logic/cloze-pick/e2e-rounds';
import { clozeFallbackScope, validClozeRounds } from '../../logic/cloze-pick/round';
import { validRounds } from '../../logic/listen-pick';
import { scopeFor, type MinigameScope } from '../../logic/minigame-config';
import { PLAYABLE_KINDS } from '../../logic/minigame-renderers';
import { questsAll } from '../quests';
import { ALL_LESSON_SCOPES, ALL_LESSON_STEPS } from './helpers/lesson-stages';

/**
 * F-CURR-002 sections 12.2 and 14: "every quest renders with each `game.<kind>` off". A round kind behind a
 * `game.<kind>` switch renders its fallback round of a shipped kind when the switch is off (section 7.1), so no switch
 * bricks a quest. For every step of every quest whose game has a switch, the fallback plays every round the game
 * would: as many rounds, each with two or more options and its answer among them. The renderer of each fallback is a
 * shipped game. Row CM-3A authors the shipped Cloze Pick steps (the Stage 3 Checks of part S3); the fixture keeps the
 * check honest on every gap kind, and the e2e answers a fallback round of the fixture step.
 */

/** Each switched game kind (row CM-30 onward), its fallback kind and how its fallback scope is built. */
const SWITCHED: ReadonlyArray<{ kind: MinigameKind; fallback: MinigameKind; plays: (s: MinigameScope) => number; fallbackOf: (s: MinigameScope) => MinigameScope }> = [
  { kind: 'cloze-pick', fallback: 'listen-pick', plays: (s) => validClozeRounds(s).length, fallbackOf: clozeFallbackScope },
];

const steps = questsAll.flatMap((q) => (ALL_LESSON_STEPS[q.id] ?? q.steps).map((step, i) => ({ questId: q.id, i, ref: step.minigameRef })));
const scopeOf = (ref: string | undefined): MinigameScope | undefined => (ref === undefined ? undefined : (scopeFor(ref) ?? ALL_LESSON_SCOPES[ref]));

function fallbackProblems(scope: MinigameScope, where: string): string[] {
  const spec = SWITCHED.find((s) => s.kind === scope.kind);
  if (!spec) return [];
  const fallback = spec.fallbackOf(scope);
  const out: string[] = [];
  if (fallback.kind !== spec.fallback) out.push(`${where}: falls back to ${fallback.kind}, not ${spec.fallback}`);
  if (!PLAYABLE_KINDS.has(fallback.kind)) out.push(`${where}: its fallback ${fallback.kind} has no renderer`);
  const rounds = validRounds(fallback);
  if (rounds.length !== spec.plays(scope)) out.push(`${where}: the fallback plays ${rounds.length} of the game's ${spec.plays(scope)} rounds`);
  if (rounds.length === 0) out.push(`${where}: nothing to play with the switch off`);
  for (const round of rounds) {
    if (round.options.length < 2 || !round.options.some((o) => o.id === round.answerId)) out.push(`${where} ${round.id}: the fallback round cannot be answered`);
  }
  return out;
}

describe('every quest with each game.<kind> off (section 12.2)', () => {
  it('reads every step of every quest', () => {
    expect(steps.length).toBeGreaterThan(100);
  });

  it.each(SWITCHED.map((s) => s.kind))('%s off: each of its steps plays every round as its fallback', (kind) => {
    const problems = steps.flatMap(({ questId, i, ref }) => {
      const scope = scopeOf(ref);
      return scope?.kind === kind ? fallbackProblems(scope, `${questId} step ${i}`) : [];
    });
    expect(problems).toEqual([]);
  });

  it('reads the shipped Cloze Pick steps: the six Stage 3 Checks of the rotation (row CM-3A S3)', () => {
    const cloze = steps.filter(({ ref }) => scopeOf(ref)?.kind === 'cloze-pick').map(({ questId }) => questId);
    expect(cloze.filter((id) => id.startsWith('quest:stage3-')).sort()).toEqual([
      'quest:stage3-crafts-q1',
      'quest:stage3-letters-q1',
      'quest:stage3-life-q1',
      'quest:stage3-life-q3',
      'quest:stage3-nature-q1',
      'quest:stage3-rites-q3',
    ]);
  });

  it('the check finds a fallback that cannot play (on the e2e fixture step)', () => {
    expect(fallbackProblems(clozeFixtureScope(['word', 'particle', 'value']), 'fixture')).toEqual([]);
    const broken = clozeFixtureScope(['word']);
    broken.clozePick!.rounds[0] = { ...broken.clozePick!.rounds[0]!, answerIndex: 7 };
    expect(fallbackProblems(broken, 'fixture')).toEqual(['fixture: nothing to play with the switch off']);
  });
});
