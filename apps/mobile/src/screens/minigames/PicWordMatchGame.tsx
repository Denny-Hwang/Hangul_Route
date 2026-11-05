import {
  Body,
  Button,
  Caption,
  ChoiceCard,
  Heading,
  HoyaBubble,
  Pill,
  Progress,
  Screen,
  Spacer,
  TAP_LOCK_MS,
  TapBoard,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  useLayoutClass,
  useMediaSize,
  useTapLock,
} from '@hangul-route/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, ReactElement } from 'react';
import type { ViewStyle } from 'react-native';
import { View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { koSpeech } from '../../logic/audio/ko-speech';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import {
  announcement,
  canSkip,
  headerView,
  pictureSide,
  pictureTileView,
  shuffleBoard,
  startFlow,
  stepFlow,
  validBoards,
  wordTileView,
  type FlowEffect,
  type FlowEvent,
  type PicWordFlowState,
  type Side,
} from '../../logic/pic-word-flow';
import type { MinigameScope } from '../../logic/minigame-config';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import type { MinigameHost } from './host';
import { PictureArt } from './PictureArt';

/**
 * Pic-Word Match (F-QUEST-002 §3.11, catalog 2): pair 3-5 pictures with their
 * Korean words by tapping a picture then a word (or a word then a picture).
 * The behaviour lives in `logic/pic-word-flow.ts` (reducer, effects,
 * view-models); this file only renders it and runs the effects. It takes a
 * `host`, so one component serves a quest step and, later, vocabulary rounds.
 * Design: design/wireframes/minigame/pic-word-match.md.
 */

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** Leave an empty scope (never a dead end). */
  onBack?: () => void;
  /**
   * The header's "n / m" count beside the fill-only bar (default on, the quest step's header). The Words
   * Match screen turns it off: no fraction appears on the Words screens (F-VOC-003 §3.8, D3).
   */
  showCount?: boolean;
}

interface TileFrameProps {
  badge: number | undefined;
  /** The ChoiceCard, which takes `ringStyle(selected)` as its `targetStyle`. */
  children: ReactNode;
}

const RING_REST: ViewStyle = { padding: spacing.xs, borderRadius: radii.xl, borderWidth: borderWidth.thick, borderColor: colors.surface.canvas };
const RING_SELECTED: ViewStyle = { ...RING_REST, borderColor: colors.brand.primary };

/**
 * The selection ring around a ChoiceCard, drawn by the card's own target (`targetStyle`): the ring and its 4 px padding
 * are part of the tile, so a touch on them is a touch on the tile, never a dead ring (AMENDMENTS-TOUCH section 6, row
 * KT-4b). The ring is drawn around the card (not by it) so the card keeps its own five states.
 */
const ringStyle = (selected: boolean): ViewStyle => (selected ? RING_SELECTED : RING_REST);

/**
 * The match number on both tiles of a matched pair, next to the card's check mark, so a match never relies on colour
 * alone. It takes no touch: a touch under it reaches the tile.
 */
function TileFrame({ badge, children }: TileFrameProps): ReactElement {
  return (
    <View>
      {children}
      {badge !== undefined ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: spacing.sm, right: spacing.sm }}>
          <Pill label={String(badge)} tone="primary" size="sm" />
        </View>
      ) : null}
    </View>
  );
}

export function PicWordMatchGame({ scope, host, onBack, showCount = true }: Props): ReactElement {
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const boards = useMemo(() => validBoards(scope), [scope]);
  const orders = useMemo(() => boards.map((board, i) => shuffleBoard(board, seed + i)), [boards, seed]);

  const m = useMessages();
  const copy = m.learner.minigame;
  const romanizationMode = useRomanizationMode();
  // F-LAYOUT-001 §3.6, §3.12: the window from the layout class; the picture grows with its media scale.
  const { windowWidth, windowHeight } = useLayoutClass();
  const side = useMediaSize(touchTarget[pictureSide(windowWidth, windowHeight)]);

  const appLock = useTapLock();
  const appLockRef = useRef(appLock);
  appLockRef.current = appLock;
  const [state, setState] = useState<PicWordFlowState>(() =>
    startFlow(boards.map((board) => board.pairs.length)),
  );
  const stateRef = useRef(state);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hostRef = useRef(host);
  hostRef.current = host;
  const boardsRef = useRef(boards);
  boardsRef.current = boards;
  const dispatchRef = useRef<(event: FlowEvent) => void>(() => undefined);

  // The matched word's sound: the word is printed on its card, so the panel only says why it is silent (A-5b).
  const slot = usePromptSlot({ source: PIC_WORD_AUDIO_SOURCE, textOnScreen: true });
  const { play: slotPlay, reset: slotReset } = slot;
  const [helpOpen, setHelpOpen] = useState(false);
  const lastPair = useRef<{ boardIdx: number; pairId: string } | null>(null);
  const sayPair = useCallback(
    (boardIdx: number, pairId: string): void => {
      const pair = boardsRef.current[boardIdx]?.pairs.find((p) => p.id === pairId);
      if (!pair) return;
      // A different word is a new prompt slot: what the last one could not play no longer applies.
      const last = lastPair.current;
      if (last === null || last.boardIdx !== boardIdx || last.pairId !== pairId) slotReset();
      lastPair.current = { boardIdx, pairId };
      void slotPlay(() => playPrompt(koSpeech(pair.word, 'word', PIC_WORD_AUDIO_SOURCE)));
    },
    [slotPlay, slotReset],
  );

  const runEffect = useCallback((effect: FlowEffect): void => {
    switch (effect.type) {
      case 'answer':
        hostRef.current.answer(effect.roundKey, effect.correct, { itemId: effect.pairId });
        return;
      case 'haptic':
        if (effect.kind === 'success') {
          tapLight();
          success();
        } else {
          nudge();
        }
        return;
      case 'play':
        sayPair(stateRef.current.boardIdx, effect.pairId);
        return;
      case 'cancel-clear':
        if (clearTimer.current) clearTimeout(clearTimer.current);
        clearTimer.current = null;
        return;
      case 'schedule-clear':
        clearTimer.current = setTimeout(() => dispatchRef.current({ type: 'clear-flash' }), effect.ms);
        return;
      case 'schedule-advance':
        advanceTimer.current = setTimeout(() => dispatchRef.current({ type: 'advance' }), effect.ms);
        return;
      case 'complete':
        hostRef.current.complete();
        return;
    }
  }, [sayPair]);

  const dispatch = useCallback(
    (event: FlowEvent): void => {
      const before = stateRef.current.status;
      const out = stepFlow(stateRef.current, event);
      stateRef.current = out.state;
      // The pair that ends a board (KT-D5): the board then moves on, so a bounce must not reach the next one.
      if (event.type === 'select' && before === 'playing' && out.state.status === 'resolved') appLockRef.current.lock(TAP_LOCK_MS);
      setState(out.state);
      out.effects.forEach(runEffect);
    },
    [runEffect],
  );
  dispatchRef.current = dispatch;

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      stop();
    },
    [],
  );

  const board = boards[state.boardIdx];
  const order = orders[state.boardIdx];
  if (state.status === 'empty' || !board || !order) {
    return (
      <Screen>
        <Body>{copy.picWord.empty}</Body>
        {onBack ? (
          <>
            <Spacer size="lg" />
            <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={onBack} />
          </>
        ) : null}
      </Screen>
    );
  }

  const header = headerView(state, copy);
  // A Check has no Skip and shows the Check's header, fill-only dots (one a board) and "Quick check", never "n / N"
  // (F-QUEST-002 L2 and D3; the Stage 2 Pic-Word Match Checks, F-CURR-002 row CM-3A S2).
  const check = host.mode === 'check';
  const pairById = new Map(board.pairs.map((p) => [p.id, p]));
  const select = (tileSide: Side, pairId: string) => (): void => dispatch({ type: 'select', side: tileSide, pairId });
  const showMissHoya = state.selected !== null && (state.missCounts[state.selected.pairId] ?? 0) > 0;

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          {check ? (
            <Progress variant="dots" value={state.boardIdx + (state.status === 'resolved' ? 1 : 0)} max={state.pairCounts.length} tone="primary" />
          ) : (
            <Progress value={header.value} max={header.max} tone="primary" />
          )}
        </View>
        {check ? <Pill label={copy.listenPick.checkTitle.pill} tone="primary" size="sm" /> : showCount ? <Pill label={header.label} tone="neutral" size="sm" /> : null}
        {canSkip(state) && !check ? (
          <Button label={copy.skip.cta} tone="ghost" size="sm" onPress={() => dispatch({ type: 'skip' })} testID="pic-word-skip" />
        ) : null}
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">{copy.picWord.heading}</Heading>
      <View accessibilityLiveRegion="polite">
        <Caption tone="muted">{announcement(state, board, copy)}</Caption>
      </View>

      <Spacer size="lg" />
      {/* Two target boards (AMENDMENTS-TOUCH section 6, row KT-4b): a graze counts, a bounce on one tile never counts twice, a quick tap on another tile does. */}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TapBoard lock="target" testID="pic-word-pictures">
            <View style={{ gap: spacing.sm }}>
              {order.pictureOrder.map((pairId) => {
                const pair = pairById.get(pairId);
                if (!pair) return null;
                const view = pictureTileView(pair, state, m.a11y.minigame);
                return (
                  <TileFrame key={pairId} badge={view.badge}>
                    <ChoiceCard
                      testID={`pic-word-picture-${pairId}`}
                      state={view.cardState}
                      art={<PictureArt pictureRef={view.pictureRef} gloss={view.gloss} size={side} />}
                      accessibilityLabel={view.accessibilityLabel}
                      onPress={select('picture', pairId)}
                      targetStyle={ringStyle(view.selected)}
                    />
                  </TileFrame>
                );
              })}
            </View>
          </TapBoard>
        </View>
        <View style={{ flex: 1 }}>
          <TapBoard lock="target" testID="pic-word-words">
            <View style={{ gap: spacing.sm }}>
              {order.wordOrder.map((pairId) => {
                const pair = pairById.get(pairId);
                if (!pair) return null;
                const view = wordTileView(pair, state, { romanizationMode }, m.a11y.minigame);
                return (
                  <TileFrame key={pairId} badge={view.badge}>
                    <ChoiceCard
                      testID={`pic-word-word-${pairId}`}
                      state={view.cardState}
                      ko={view.ko}
                      romanization={view.romanization}
                      gloss={view.gloss}
                      accessibilityLabel={view.accessibilityLabel}
                      onPress={select('word', pairId)}
                      targetStyle={ringStyle(view.selected)}
                    />
                  </TileFrame>
                );
              })}
            </View>
          </TapBoard>
        </View>
      </View>

      <Spacer size="md" />
      <PromptPanel
        variant="status"
        view={slot.view}
        onAction={(action) =>
          slot.act(action, () => {
            const last = lastPair.current;
            if (last) sayPair(last.boardIdx, last.pairId);
          })
        }
        onHelp={() => setHelpOpen(true)}
        testID="pic-word-sound"
      />
      <View accessibilityLiveRegion="polite">
        {showMissHoya ? (
          <>
            <Spacer size="lg" />
            <HoyaBubble tone="thinking" message={copy.picWord.missHoya} />
          </>
        ) : null}
      </View>
      <Spacer size="xl" />
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </Screen>
  );
}

/** The surface id of Pic-Word Match for the audio telemetry (F-AUDIO-004 §3.14). */
const PIC_WORD_AUDIO_SOURCE = 'pic-word';
