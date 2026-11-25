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
import { useSoundPacing } from '../../components/use-sound-pacing';
import { useMessages } from '../../i18n/use-messages';
import { afterMiss, afterRightAnswer, lookHereLine, type AnswerResult } from '../../logic/answer-feedback';
import { koSpeech } from '../../logic/audio/ko-speech';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import {
  announcement,
  canSkip,
  headerView,
  hintTarget,
  pictureSide,
  pictureTileView,
  shuffleBoard,
  startFlow,
  stepFlow,
  tileItem,
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
import { AnswerAnnouncer } from './answer-announcer';
import type { MinigameHost } from './host';
import { PictureArt } from './PictureArt';
import { useAnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

/**
 * Pic-Word Match (F-QUEST-002 §3.11, catalog 2): pair 3-5 pictures with their
 * Korean words by tapping a picture then a word (or a word then a picture).
 * The behaviour lives in `logic/pic-word-flow.ts` (reducer, effects,
 * view-models); this file only renders it and runs the effects. It takes a
 * `host`, so one component serves a quest step and, later, vocabulary rounds.
 * Design: design/wireframes/minigame/pic-word-match.md.
 *
 * Answer feedback (F-A11Y-001 row AF-4b, OD-AF7): a wrong second tile keeps its amber and `replay` mark, and its
 * "Not this one" name, until the learner's next tap that changes the board (no timer). Each result is said once by the
 * answer announcer (a pair by its meaning and word, a miss by the tile tried; the miss that rings the partner carries the
 * look-here line) and Hoya's miss line is not live; the selection caption stays live. The last pair of a board waits
 * the 1000 ms result floor with a screen reader off; with one on, Next shows (OD-AF9 (b)) and the word's sound starts
 * after the line. A pair before the last moves nothing and no focus.
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
  /** The corner of the number: `end` for a picture card (its mark sits in the row), `start` for a word card (F6: its mark takes the end corner). */
  badgeCorner: 'start' | 'end';
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
 * alone. It takes no touch: a touch under it reaches the tile. A word card is a tile (F-A11Y-001 F6), its mark on the
 * end corner, so its number takes the start corner and never covers the mark.
 */
function TileFrame({ badge, badgeCorner, children }: TileFrameProps): ReactElement {
  return (
    <View>
      {children}
      {badge !== undefined ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: spacing.sm, ...(badgeCorner === 'end' ? { right: spacing.sm } : { left: spacing.sm }) }}>
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
  // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-4: the next board, or the end of the step, waits for the matched word to be said.
  const pacing = useSoundPacing();
  const hostRef = useRef(host);
  hostRef.current = host;
  const boardsRef = useRef(boards);
  boardsRef.current = boards;
  const dispatchRef = useRef<(event: FlowEvent) => void>(() => undefined);
  // F-A11Y-001 AF-4b: each result is said once, by the answer announcer; with a screen reader on the last pair shows Next.
  const a = useAnswerAnnouncement();
  const { clear, focusPrompt } = a;
  const nextButton = useRoundNext();
  const mounted = useRef(false);
  /** The board last moved on from: a second Next for the same board does nothing. */
  const movedFrom = useRef(-1);
  /** One count per result and per advance: a word's sound that waited for its line is dropped if anything came after it. */
  const turn = useRef(0);

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
      const spec = koSpeech(pair.word, 'word', PIC_WORD_AUDIO_SOURCE);
      void pacing.track(slotPlay(() => playPrompt(spec), spec));
    },
    [slotPlay, slotReset, pacing],
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
      case 'schedule-advance':
        pacing.after(effect.ms, () => dispatchRef.current({ type: 'advance' }));
        return;
      case 'complete':
        hostRef.current.complete();
        return;
    }
  }, [sayPair, pacing]);

  /** What a result needs from this render: read when the tap comes, so `dispatch` keeps one identity. */
  const latest = useRef({ a, next: nextButton, a11y: m.a11y });
  latest.current = { a, next: nextButton, a11y: m.a11y };

  /** A tile that scored a pair or missed one: the line is said once, and the effects that follow are the result's own (§3.4). */
  const settle = useCallback(
    (before: PicWordFlowState, after: PicWordFlowState, event: Extract<FlowEvent, { type: 'select' }>, effects: FlowEffect[]): void => {
      const { a: say, next, a11y } = latest.current;
      const board = boardsRef.current[before.boardIdx];
      const first = before.selected;
      const answer = effects.find((e) => e.type === 'answer');
      const play = effects.find((e) => e.type === 'play');
      const advanceNow = effects.find((e) => e.type === 'schedule-advance');
      effects.filter((e) => e !== play && e !== advanceNow).forEach(runEffect);
      if (!board || !first || answer?.type !== 'answer') return;
      const mine = (turn.current += 1);
      const pairOf = (id: string) => board.pairs.find((p) => p.id === id);
      if (answer.correct) {
        const pair = pairOf(first.pairId);
        if (!pair) return;
        const speak = (): Promise<void> => say.announce({ kind: 'right', item: tileItem(pair, 'word', a11y, true) });
        const sound = (): void => {
          // A reader on may press Next, or tap on, before the line ends: this turn is over, so its word is not said.
          if (turn.current !== mine || !mounted.current) return;
          if (play) runEffect(play);
        };
        if (advanceNow?.type !== 'schedule-advance') {
          // A pair before the last: said once, no Next, focus stays where it is (§3.4). A reader hears the line first.
          if (say.readerOn) void speak().then(sound);
          else {
            void speak();
            sound();
          }
          return;
        }
        void afterRightAnswer({
          readerOn: say.readerOn,
          gameMinMs: advanceNow.ms,
          announce: say.readerOn ? () => next.afterFocus(speak) : speak,
          play: sound,
          showNext: next.show,
          waitThenAdvance: (minMs) => runEffect({ type: 'schedule-advance', ms: minMs }),
        });
        return;
      }
      const tried = pairOf(event.pairId);
      if (!tried) return;
      const item = tileItem(tried, event.side, a11y, false);
      const ringed = hintTarget(after);
      const partner = ringed !== null && hintTarget(before) === null ? pairOf(ringed.pairId) : undefined;
      // The miss that rings the partner carries the look-here line; every other miss is a plain retry.
      const result: AnswerResult = partner && ringed ? { kind: 'missHint', item, hint: lookHereLine(a11y, tileItem(partner, ringed.side, a11y, false)) } : { kind: 'miss', item };
      afterMiss({ readerOn: say.readerOn, announce: () => say.announce(result) });
    },
    [runEffect],
  );

  const dispatch = useCallback(
    (event: FlowEvent): void => {
      const before = stateRef.current;
      const out = stepFlow(before, event);
      stateRef.current = out.state;
      // The pair that ends a board (KT-D5): the board then moves on, so a bounce must not reach the next one.
      if (event.type === 'select' && before.status === 'playing' && out.state.status === 'resolved') appLockRef.current.lock(TAP_LOCK_MS);
      setState(out.state);
      if (event.type === 'select' && out.effects.some((e) => e.type === 'answer')) settle(before, out.state, event, out.effects);
      else out.effects.forEach(runEffect);
    },
    [runEffect, settle],
  );
  dispatchRef.current = dispatch;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stop();
    };
  }, []);

  // A new board empties the announcer and, with a reader on, moves focus to the board's header node (§3.4).
  const { boardIdx } = state;
  useEffect(() => {
    clear();
    if (boardIdx > 0) focusPrompt();
  }, [boardIdx, clear, focusPrompt]);

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
  /** Next (a reader on): the board moves on once; a second press, or one after the board has moved, does nothing. */
  const advanceNow = (): void => {
    if (movedFrom.current === state.boardIdx) return;
    movedFrom.current = state.boardIdx;
    turn.current += 1;
    nextButton.hide();
    dispatch({ type: 'advance' });
  };

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
      {/* The board's header node (§3.4): the heading; the selection caption under it stays its own live status. */}
      <View ref={a.promptRef} testID="pic-word-round" accessible accessibilityRole="header" accessibilityLabel={m.a11y.answer.round(state.boardIdx + 1, boards.length, copy.picWord.heading)}>
        <Heading level="prompt">{copy.picWord.heading}</Heading>
      </View>
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
                  <TileFrame key={pairId} badge={view.badge} badgeCorner="end">
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
                  <TileFrame key={pairId} badge={view.badge} badgeCorner="start">
                    <ChoiceCard
                      testID={`pic-word-word-${pairId}`}
                      state={view.cardState}
                      ko={view.ko}
                      romanization={view.romanization}
                      gloss={view.gloss}
                      layout="tile"
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

      {nextButton.shown ? (
        <>
          <Spacer size="lg" />
          <Button pressableRef={nextButton.nextRef} label={copy.trace.next.cta} tone="primary" size="hero" fullWidth onPress={advanceNow} testID="pic-word-next" />
        </>
      ) : null}
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
      <View>
        {showMissHoya ? (
          <>
            <Spacer size="lg" />
            {/* The announcer says the result once, so this result bubble is not a live region too (§3.3). */}
            <HoyaBubble tone="thinking" message={copy.picWord.missHoya} live={false} />
          </>
        ) : null}
      </View>
      <AnswerAnnouncer line={a.line} />
      <Spacer size="xl" />
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </Screen>
  );
}

/** The surface id of Pic-Word Match for the audio telemetry (F-AUDIO-004 §3.14). */
const PIC_WORD_AUDIO_SOURCE = 'pic-word';
