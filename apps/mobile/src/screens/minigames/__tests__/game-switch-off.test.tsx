import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scopeFor, type MinigameScope } from '../../../logic/minigame-config';
import { PLAYABLE_KINDS } from '../../../logic/minigame-renderers';
import { byTestId, press, render } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { MatchShapeStepBody } from '../MatchShapeStepBody';
import { questsAll } from '../../../content/quests';

/**
 * F-CURR-002 sections 7.1 and 12.2, row CM-33: a `game.<kind>` switch never bricks a quest. With every new round
 * format switched off (`game.match-shape` is the first such format a quest plays), every quest still plays to its end:
 * each game step is a kind the screen draws, and each switched step plays its fallback (Match Shape: Read Pick) on
 * every round, scoring each once and completing the step.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

/** The round kinds that sit behind a `game.<kind>` switch and the fallback they report while it is off. */
const SWITCHED: Readonly<Record<string, string>> = { 'match-shape': 'listen-pick' };

type Host = MinigameHost & { answers: Array<string | number>; completes: number };
function host(): Host {
  const h: Host = {
    mode: 'quest',
    answers: [],
    completes: 0,
    answer: (key) => void h.answers.push(key),
    complete: () => {
      h.completes += 1;
    },
  };
  return h;
}

const switchedSteps = questsAll.flatMap((q) =>
  q.steps.filter((s) => s.minigameKind !== undefined && s.minigameKind in SWITCHED).map((s) => ({ quest: q.id, step: s.id, ref: s.minigameRef as string })),
);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('every quest with its game switches off (row CM-33)', () => {
  it('every game step of every quest is a kind the screen draws', () => {
    for (const q of questsAll) {
      for (const s of q.steps) if (s.minigameKind !== undefined) expect(PLAYABLE_KINDS.has(s.minigameKind), `${q.id}/${s.id} ${s.minigameKind}`).toBe(true);
    }
  });

  it('there are switched steps to check (the Stage 1 addition plays Match Shape)', () => {
    expect(switchedSteps.map((s) => s.quest)).toContain('quest:stage1-crafts-q4');
  });

  it.each(switchedSteps)('$quest $step plays its fallback to the end while its switch is off', async ({ ref }) => {
    const scope = scopeFor(ref) as MinigameScope;
    const played: MinigameScope[] = [];
    const h = host();
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
        <MatchShapeStepBody scope={scope} hostFor={(s) => (played.push(s), h)} onBack={() => undefined} on={false} />
      </LayoutProvider>,
    );
    expect(byTestId(r.root, 'match-shape-game')).toHaveLength(0);
    const fallback = played[0] as MinigameScope;
    expect(fallback.kind).toBe(SWITCHED[scope.kind]);
    const rounds = fallback.readPick?.rounds ?? [];
    expect(rounds.length).toBe(scope.matchShape?.rounds.length);
    for (const round of rounds) {
      const node = byTestId(r.root, `read-pick-option-${round.answerId}`).find((n) => typeof n.props.onClick === 'function');
      expect(node, `${ref} ${round.id}`).toBeDefined();
      await press(node!);
      await act(async () => {
        vi.advanceTimersByTime(2_000);
      });
    }
    expect(h.answers).toEqual(rounds.map((round) => round.id));
    expect(h.completes).toBe(1);
  });
});
