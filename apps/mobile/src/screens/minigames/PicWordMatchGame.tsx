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
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  useLayoutClass,
  useMediaSize,
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
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
  /** Drawn above the board's header row: a host's own way out (the Words Match screen's Back, F-VOC-003 C-6). */
  leading?: React.ReactNode;
}

interface TileFrameProps {
  selected: boolean;
  badge: number | undefined;
  children: React.ReactNode;
}

/**
 * Selection ring and match number around a ChoiceCard. The ring is drawn
 * around the card (not by it) so the card keeps its own five states; the
 * number sits on both tiles of a matched pair next to the card's check mark,
 * so a match never relies on colour alone.
 */
function TileFrame({ selected, badge, children }: TileFrameProps): React.ReactElement {
  return (
    <View
      style={{
        padding: spacing.xs,
        borderRadius: radii.xl,
        borderWidth: borderWidth.thick,
        borderColor: selected ? colors.brand.primary : colors.surface.canvas,
      }}
    >
      {children}
      {badge !== undefined ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: spacing.sm, right: spacing.sm }}>
          <Pill label={String(badge)} tone="primary" size="sm" />
        </View>
      ) : null}
    </View>
  );
}

export function PicWordMatchGame({ scope, host, onBack, leading }: Props): React.ReactElement {
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const boards = useMemo(() => validBoards(scope), [scope]);
  const orders = useMemo(() => boards.map((board, i) => shuffleBoard(board, seed + i)), [boards, seed]);

  const m = useMessages();
  const copy = m.learner.minigame;
  const romanizationMode = useRomanizationMode();
  // F-LAYOUT-001 §3.6, §3.12: the window from the layout class; the picture grows with its media scale.
  const { windowWidth, windowHeight } = useLayoutClass();
  const side = useMediaSize(touchTarget[pictureSide(windowWidth, windowHeight)]);

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
      case 'play': {
        const board = boardsRef.current[stateRef.current.boardIdx];
        const pair = board?.pairs.find((p) => p.id === effect.pairId);
        if (pair) void playPrompt({ text: pair.word.spokenKo ?? pair.word.ko, audioRef: pair.word.audioRef });
        return;
      }
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
  }, []);

  const dispatch = useCallback(
    (event: FlowEvent): void => {
      const out = stepFlow(stateRef.current, event);
      stateRef.current = out.state;
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
  const pairById = new Map(board.pairs.map((p) => [p.id, p]));
  const select = (tileSide: Side, pairId: string) => (): void => dispatch({ type: 'select', side: tileSide, pairId });
  const showMissHoya = state.selected !== null && (state.missCounts[state.selected.pairId] ?? 0) > 0;

  return (
    <Screen tone="canvas" scrollable>
      {leading}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={header.value} max={header.max} tone="primary" />
        </View>
        <Pill label={header.label} tone="neutral" size="sm" />
        {canSkip(state) ? (
          <Button label={copy.skip.cta} tone="ghost" size="sm" onPress={() => dispatch({ type: 'skip' })} testID="pic-word-skip" />
        ) : null}
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">{copy.picWord.heading}</Heading>
      <View accessibilityLiveRegion="polite">
        <Caption tone="muted">{announcement(state, board, copy)}</Caption>
      </View>

      <Spacer size="lg" />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          {order.pictureOrder.map((pairId) => {
            const pair = pairById.get(pairId);
            if (!pair) return null;
            const view = pictureTileView(pair, state, m.a11y.minigame);
            return (
              <TileFrame key={pairId} selected={view.selected} badge={view.badge}>
                <ChoiceCard
                  testID={`pic-word-picture-${pairId}`}
                  state={view.cardState}
                  art={<PictureArt pictureRef={view.pictureRef} gloss={view.gloss} size={side} />}
                  accessibilityLabel={view.accessibilityLabel}
                  onPress={select('picture', pairId)}
                />
              </TileFrame>
            );
          })}
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          {order.wordOrder.map((pairId) => {
            const pair = pairById.get(pairId);
            if (!pair) return null;
            const view = wordTileView(pair, state, { romanizationMode }, m.a11y.minigame);
            return (
              <TileFrame key={pairId} selected={view.selected} badge={view.badge}>
                <ChoiceCard
                  testID={`pic-word-word-${pairId}`}
                  state={view.cardState}
                  ko={view.ko}
                  romanization={view.romanization}
                  gloss={view.gloss}
                  accessibilityLabel={view.accessibilityLabel}
                  onPress={select('word', pairId)}
                />
              </TileFrame>
            );
          })}
        </View>
      </View>

      <View accessibilityLiveRegion="polite">
        {showMissHoya ? (
          <>
            <Spacer size="lg" />
            <HoyaBubble tone="thinking" message={copy.picWord.missHoya} />
          </>
        ) : null}
      </View>
      <Spacer size="xl" />
    </Screen>
  );
}
