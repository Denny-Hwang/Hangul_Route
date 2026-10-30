import type { ListenPickRound, TypeHangulRound } from '@hangul-route/content-schema';
import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { Text } from 'react-native';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { questsAll } from '../../../content';
import { scopeFor, type MinigameScope } from '../../../logic/minigame-config';
import { FIXTURE_SPELLING_ROUNDS } from '../../../logic/type-hangul/e2e-rounds';
import { byTestId, render, screenTexts } from '../../../test-support/render';
import type { MinigameHost } from '../host';
import { ListenPickGame } from '../ListenPickGame';
import { TypeHangulGame } from '../TypeHangulGame';
import { useSwitchedScope } from '../dictation-entry';

/**
 * F-CURR-002 sections 12.2 and 14 (row CM-31): every quest renders with `game.type-hangul-hear` and
 * `game.spelling-pick` off (their built-in pct 0). A step goes through `useSwitchedScope` as MinigameScreen's does,
 * and each Type Hangul and Listen & Pick scope of the shipped quests is mounted twice: as shipped, and with its rounds
 * written as Dictation or with a spelling round added (no shipped content has either yet), so the off path is the one
 * rendered. A step never waits on the dictation chunk with the switches off, and the game renders its first round.
 *
 * And the chunk's one load per step: when it fails, the step plays its fallback and stays on it, even if the chunk
 * would load on a second try (a later step tries again), so a game never changes under the learner.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const chunkLoads = vi.hoisted(() => ({ count: 0, failFirst: false }));
vi.mock('../dictation-chunk', async (importOriginal) => {
  chunkLoads.count += 1;
  if (chunkLoads.failFirst && chunkLoads.count === 1) throw new Error('offline before the precache');
  return importOriginal<object>();
});
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async () => undefined),
}));

const host: MinigameHost = { mode: 'quest', answer: () => undefined, complete: () => undefined };

/** A quest step as MinigameScreen draws it: the switches applied as it opens, waiting while the chunk loads. */
function Step({ scope }: { scope: MinigameScope }): ReactElement {
  const switched = useSwitchedScope(scope);
  if (switched.kind === 'loading') return <Text testID="step-waiting">waiting</Text>;
  const key = switched.kit === null ? 'plain' : 'kit';
  return switched.scope.kind === 'listen-pick' ? (
    <ListenPickGame key={key} scope={switched.scope} host={host} spelling={switched.kit} />
  ) : (
    <TypeHangulGame key={key} scope={switched.scope} host={host} hear={switched.kit} />
  );
}

async function mount(scope: MinigameScope): Promise<ReactTestRenderer> {
  return render(
    <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
      <Step scope={scope} />
    </LayoutProvider>,
    { createNodeMock: () => ({ focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }) },
  );
}

const asDictation = (scope: MinigameScope): MinigameScope => ({
  ...scope,
  typeHangul: { rounds: (scope.typeHangul?.rounds ?? []).map((r): TypeHangulRound => ({ ...r, mode: 'hear' })) },
});
const withSpelling = (scope: MinigameScope): MinigameScope => ({
  ...scope,
  listenPick: { rounds: [FIXTURE_SPELLING_ROUNDS.book as unknown as ListenPickRound, ...(scope.listenPick?.rounds ?? [])] },
});

const shipped = questsAll.flatMap((quest) =>
  quest.steps.flatMap((step, i) => {
    const scope = step.minigameRef ? scopeFor(step.minigameRef) : undefined;
    return scope && (scope.kind === 'type-hangul' || scope.kind === 'listen-pick') ? [{ at: `${quest.id} step ${i}`, scope }] : [];
  }),
);

afterEach(() => {
  chunkLoads.count = 0;
  chunkLoads.failFirst = false;
});

describe('every quest with the game switches off renders its game (sections 12.2 and 14)', () => {
  it('reaches the Type Hangul and Listen & Pick steps of the shipped quests', () => {
    expect(shipped.some((s) => s.scope.kind === 'type-hangul')).toBe(true);
    expect(shipped.some((s) => s.scope.kind === 'listen-pick')).toBe(true);
  });

  it('mounts each step as shipped and with a Dictation or spelling round: never waiting, never empty', async () => {
    for (const { at, scope } of shipped) {
      const variants = scope.kind === 'type-hangul' ? [scope, asDictation(scope)] : [scope, withSpelling(scope)];
      for (const variant of variants) {
        const r = await mount(variant);
        expect(byTestId(r.root, 'step-waiting'), at).toHaveLength(0);
        if (variant.kind === 'type-hangul') {
          expect(byTestId(r.root, 'type-hangul').length, at).toBeGreaterThan(0);
          expect(byTestId(r.root, 'dictation-prompt-speaker'), at).toHaveLength(0);
        } else {
          expect(byTestId(r.root, 'listen-pick-options').length, at).toBeGreaterThan(0);
          // The spelling round played as Listen & Pick: the look-alike spelling and the cue are left out.
          expect(byTestId(r.root, 'spelling-cue'), at).toHaveLength(0);
        }
        expect(screenTexts(r.root).length, at).toBeGreaterThan(0);
        await act(async () => {
          r.unmount();
        });
      }
    }
    // With the switches off nothing reaches for the dictation chunk.
    expect(chunkLoads.count).toBe(0);
  }, 120_000);
});

describe('the dictation chunk loads once per step', () => {
  it('a failed load plays the fallback and keeps it for the step, though a second try would load', async () => {
    chunkLoads.failFirst = true;
    // A switched-on step: Dictation rounds with the switch read as on.
    const { DICTATION_SWITCH } = await import('../../../logic/game-switches');
    const store = await import('../../../store/remote-config-store');
    const spy = vi.spyOn(store, 'currFlagOn').mockImplementation((flag) => flag === DICTATION_SWITCH);
    try {
      const scope = asDictation(shipped.find((s) => s.scope.kind === 'type-hangul')!.scope);
      const r = await mount(scope);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      // The load failed: the step plays the see round of the word, and stays so (no second load in this step).
      expect(byTestId(r.root, 'type-hangul').length).toBeGreaterThan(0);
      expect(byTestId(r.root, 'dictation-prompt-speaker')).toHaveLength(0);
      expect(chunkLoads.count).toBe(1);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(chunkLoads.count).toBe(1);
      expect(byTestId(r.root, 'dictation-prompt-speaker')).toHaveLength(0);
      await act(async () => {
        r.unmount();
      });
      // The next step tries again, and that try reaches the chunk: so the count above would have seen a retry.
      const next = await mount(scope);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });
      expect(chunkLoads.count).toBe(2);
      expect(byTestId(next.root, 'step-waiting')).toHaveLength(0);
      expect(byTestId(next.root, 'type-hangul').length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
    }
  });
});
