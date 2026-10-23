import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { renderedKind } from '../../../logic/game-switches';
import type { MinigameScope } from '../../../logic/minigame-config';
import { STORY_ORDER_FLAG, playableStoryOrder, storyOrderFallbackItem, storyOrderFallbackScopes, storyOrderKeyPrefix } from '../../../logic/story-order/fallback';
import { useCurrFlag } from '../../../store/remote-config-store';
import { LessonWaiting } from '../../lesson-content';
import type { MinigameHost } from '../host';
import { StorySequenceGame } from '../StorySequenceGame';

/*
 * The start bundle's door to Story Order (F-CURR-002 sections 7.1, 10 and 12.2, row CM-34). With `game.story-order`
 * on, the game loads from its chunk (`./story-order-chunk.tsx`, marker `screen-chunk:story-order`), reached only
 * through the literal `import()` below. Off (its built-in pct is 0, so it merges dark), every round plays as the
 * shipped Story Sequence with text cards, one after the other, and nothing loads. The switch is read once, when the
 * step opens, so a remote copy that lands mid-step never swaps the game under the learner.
 */

type Chunk = typeof import('./story-order-chunk');
let loading: Promise<Chunk> | null = null;
let loaded: Chunk | null = null;

function loadChunk(): Promise<Chunk> {
  loading ??= import('./story-order-chunk').then(
    (chunk) => (loaded = chunk),
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** The minigame ref: seeds the start orders and names the fallback's sequences in telemetry. */
  sequenceId: string;
  /** The fallback ended the step (Story Sequence completes it itself). */
  onFallbackFinish: () => void;
}

export function StoryOrderStep({ scope, host, sequenceId, onFallbackFinish }: Props): ReactElement {
  const live = useCurrFlag(STORY_ORDER_FLAG);
  const decided = useRef<boolean | null>(null);
  // `GAME_SWITCHES` is the one table of switch and fallback (section 12.2); this step reads it.
  decided.current ??= renderedKind('story-order', (name) => name === STORY_ORDER_FLAG && live) === 'story-order';
  return decided.current ? (
    <StoryOrderLazy scope={scope} host={host} sequenceId={sequenceId} onFallbackFinish={onFallbackFinish} />
  ) : (
    <StoryOrderFallback scope={scope} host={host} sequenceId={sequenceId} onFinish={onFallbackFinish} />
  );
}

function StoryOrderLazy({ scope, host, sequenceId, onFallbackFinish }: Props): ReactElement {
  const [chunk, setChunk] = useState<Chunk | null>(loaded);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (chunk !== null || failed) return undefined;
    let on = true;
    loadChunk().then(
      (c) => on && setChunk(c),
      () => on && setFailed(true),
    );
    return () => {
      on = false;
    };
  }, [chunk, failed]);
  // The chunk did not load (offline before the service worker cached it, a stale worker after a deploy): the rounds
  // play as the fallback, which is in the start bundle, so the step is never a dead end.
  if (failed) return <StoryOrderFallback scope={scope} host={host} sequenceId={sequenceId} onFinish={onFallbackFinish} />;
  if (chunk === null) return <LessonWaiting />;
  const { StoryOrderGame } = chunk;
  return <StoryOrderGame scope={scope} host={host} sequenceId={sequenceId} />;
}

/**
 * Board O3: each round as Story Sequence with text cards, in order; its last round, or a skip, ends the step. Each slot
 * answers through the host with the line it asked, so the memory model records the round at the read rung (§12.2):
 * hinted, since the fallback cards show each line's meaning, and nothing for the last slot (one card left).
 */
function StoryOrderFallback({ scope, host, sequenceId, onFinish }: { scope: MinigameScope; host: MinigameHost; sequenceId: string; onFinish: () => void }): ReactElement {
  const rounds = useMemo(() => playableStoryOrder(scope), [scope]);
  const scopes = useMemo(() => storyOrderFallbackScopes(scope), [scope]);
  const [index, setIndex] = useState(0);
  const round = rounds[index];
  const current = scopes[index];
  if (round === undefined || current === undefined) {
    // No round to put in order: Story Sequence's own empty line and Continue.
    return <StorySequenceGame scope={{ kind: 'story-sequence', storySteps: [] }} sequenceId={sequenceId} onFinish={onFinish} />;
  }
  const last = index === scopes.length - 1;
  return (
    <StorySequenceGame
      key={round.id}
      scope={current}
      sequenceId={`${sequenceId}#${round.id}`}
      chain={{
        keyPrefix: storyOrderKeyPrefix(round.id),
        last,
        answer: (roundKey, slot, correct) => {
          const itemId = storyOrderFallbackItem(round, slot);
          // Hinted with a right answer only: a miss stays a plain miss (the host records a hinted answer as right).
          host.answer(roundKey, correct, itemId === undefined ? undefined : { itemId, ...(correct ? { hinted: true } : {}) });
        },
      }}
      onFinish={(skipped) => (last || skipped === true ? onFinish() : setIndex(index + 1))}
    />
  );
}
