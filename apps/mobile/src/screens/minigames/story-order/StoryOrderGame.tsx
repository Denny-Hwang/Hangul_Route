import {
  Body,
  Button,
  ChoiceCard,
  Heading,
  HoyaBubble,
  KoreanText,
  KOREAN_LINE_BREAK,
  Pill,
  Progress,
  Screen,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
  useEffectiveFontScale,
  useLayoutClass,
  useMediaSize,
  useTypeScale,
} from '@hangul-route/design-system';
import { romanizationShown } from '@hangul-route/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Platform, Text, View } from 'react-native';
import { PromptPanel } from '../../../components/PromptPanel';
import { VoiceHelpSheet } from '../../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../../components/use-prompt-slot';
import { useMessages } from '../../../i18n/use-messages';
import { useRomanizationMode } from '../../../i18n/use-romanization-mode';
import type { MinigameScope } from '../../../logic/minigame-config';
import { playableStoryOrder } from '../../../logic/story-order/fallback';
import {
  startStoryOrder,
  stepStoryOrder,
  storyOrderCards,
  type StoryOrderAction,
  type StoryOrderCard,
  type StoryOrderEffect,
  type StoryOrderPlay,
  type StoryOrderState,
} from '../../../logic/story-order/story-order-player';
import {
  STORY_ORDER_AUDIO_SOURCE,
  lineSpeech,
  slotFace,
  storyOrderCardLabel,
  storyOrderColumns,
  storyOrderHeading,
  storyOrderSlotsPerRow,
  type StoryOrderCopy,
} from '../../../logic/story-order/story-order-view';
import { HIGHLIGHT_SLOT_AFTER_WRONG, remainingCards } from '../../../logic/story/sequence-player';
import { SEQUENCE_WRONG_FLASH_MS, autoAdvanceDue, replayAdvanceDelay, sequenceSeed, slotViews } from '../../../logic/story/sequence-view';
import { playPrompt, stop } from '../../../platform/audio';
import { nudge, success } from '../../../platform/haptics';
import { useReducedMotion } from '../../../platform/motion';
import { announceForScreenReader, focusForScreenReader } from '../../../platform/screen-reader';
import type { MinigameHost } from '../host';
import { PictureArt } from '../PictureArt';

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** The minigame ref: it seeds each round's start order. */
  sequenceId?: string;
  /** Per-mount random nonce for the start order; tests inject a fixed one. */
  nonce?: number;
}

type Note = 'none' | 'wrong' | 'look';

/** Column share of one card cell, by column count. */
const CELL_BASIS = { 1: '100%', 2: '45%', 4: '22%' } as const;

/** Read by assistive tech, not drawn: the live line that says where a placed card went. */
const VISUALLY_HIDDEN = { position: 'absolute' as const, width: 1, height: 1, overflow: 'hidden' as const, opacity: 0 };

/**
 * Story Order (F-CURR-002 §7.1 F5, row CM-34): read 3-5 Korean lines (with pictures, or captions only) and tap them
 * in the order they happen. The cards show Korean and romanization only; Show meanings is a hint for the rest of the
 * round, recorded as hinted, never a penalty. A card that comes next moves into the next slot and its line is said; one
 * that does not only nudges (amber, nothing moves); a second miss on a slot rings the right card. A full row replays
 * the lines in order with their meanings, then Done. Layout A of the minigame shell. The rules are
 * `logic/story-order/story-order-player.ts` over Story Sequence's player. Design: design/wireframes/minigame/story-order.md,
 * design/screens/minigame-variety/ (mock/story-order.html, board O).
 */
export function StoryOrderGame({ scope, host, sequenceId = '', nonce }: Props): ReactElement {
  const m = useMessages();
  const copy: StoryOrderCopy = { storyOrder: m.learner.storyOrder, sequence: m.learner.story.sequence };
  const pill = m.learner.story.check.position.pill;
  const textScale = useTypeScale();
  const fontScale = useEffectiveFontScale();
  const lc = useLayoutClass();
  const reducedMotion = useReducedMotion();
  const romanizationMode = useRomanizationMode();
  const pictureSize = useMediaSize(touchTarget.hero);

  const [mountNonce] = useState(() => nonce ?? Math.floor(Math.random() * 0x7fffffff));
  const play: StoryOrderPlay = useMemo(() => {
    const rounds = playableStoryOrder(scope);
    return { rounds, seeds: rounds.map((r) => sequenceSeed(`${sequenceId}#${r.id}`, mountNonce)) };
  }, [scope, sequenceId, mountNonce]);

  const [state, setState] = useState<StoryOrderState>(() => startStoryOrder(play));
  const stateRef = useRef(state);
  const hostRef = useRef(host);
  hostRef.current = host;
  const [note, setNote] = useState<Note>('none');
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const [announce, setAnnounce] = useState('');
  const [replayAnnounce, setReplayAnnounce] = useState('');
  // Show meanings unmounts its button: focus moves to the line that replaces it, so it is never lost.
  const meaningsRef = useRef<View | null>(null);
  useEffect(() => {
    if (state.meanings) focusForScreenReader(meaningsRef.current);
  }, [state.meanings]);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A placed card leaves the row of cards with the focus on it (WCAG 2.4.3, the wireframe's Accessibility): focus moves
  // to the first card still to place, to the first card of a new round, or to the replay's title once the row is full,
  // so a keyboard, switch or screen-reader learner never starts again from the top of the screen.
  const cardNodes = useRef(new Map<string, View>());
  const replayTitleRef = useRef<View | null>(null);
  const [focusTurn, setFocusTurn] = useState(0);
  useEffect(() => {
    if (focusTurn === 0) return;
    const now = stateRef.current;
    if (now.seq.phase !== 'ordering') {
      focusForScreenReader(replayTitleRef.current);
      return;
    }
    const next = remainingCards(now.seq)[0];
    focusForScreenReader(next === undefined ? null : (cardNodes.current.get(next) ?? null));
  }, [focusTurn]);

  const round = play.rounds[state.roundIndex];
  const cards = useMemo(() => (round ? storyOrderCards(round) : []), [round]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const total = state.seq.solution.length;

  // The sound of a placed line (while ordering) and of the replayed line share one prompt slot: a new line starts it again.
  const slot = usePromptSlot({ source: STORY_ORDER_AUDIO_SOURCE, textOnScreen: true });
  const { play: slotPlay, reset: slotReset } = slot;
  const [helpOpen, setHelpOpen] = useState(false);
  const lastLine = useRef<StoryOrderCard | null>(null);
  const say = useCallback(
    (card: StoryOrderCard): Promise<void> => {
      if (lastLine.current?.id !== card.id) slotReset();
      lastLine.current = card;
      return slotPlay(() => playPrompt(lineSpeech(card.line))).then(
        () => undefined,
        () => undefined,
      );
    },
    [slotPlay, slotReset],
  );

  const run = useCallback(
    (effect: StoryOrderEffect, next: StoryOrderState): void => {
      switch (effect.type) {
        case 'answer':
          // The last slot names no item (one card left): it scores, and the memory store hears nothing.
          hostRef.current.answer(effect.roundKey, effect.correct, { ...(effect.itemId === undefined ? {} : { itemId: effect.itemId }), ...(effect.hinted ? { hinted: true } : {}) });
          return;
        case 'placed': {
          success();
          setNote('none');
          setWrongFlash(null);
          const card = cardById.get(effect.cardId);
          if (card) {
            const line = copy.sequence.slotLabel(next.seq.placed.length, next.seq.solution.length, card.line.ko);
            // Android and the web read the polite live line below; iOS has no live regions, so VoiceOver is told.
            setAnnounce(line);
            announceForScreenReader(line);
            void say(card);
          }
          setFocusTurn((n) => n + 1);
          return;
        }
        case 'miss':
          nudge();
          setNote('wrong');
          setRevealed((prev) => new Set(prev).add(effect.cardId));
          setWrongFlash(effect.cardId);
          if (flashTimer.current) clearTimeout(flashTimer.current);
          flashTimer.current = setTimeout(() => setWrongFlash(null), SEQUENCE_WRONG_FLASH_MS);
          return;
        case 'highlight':
          setNote('look');
          return;
        case 'nextRound':
          stop();
          slotReset();
          setNote('none');
          setRevealed(new Set());
          setAnnounce('');
          setFocusTurn((n) => n + 1);
          return;
        case 'complete':
          stop();
          hostRef.current.complete();
      }
    },
    [cardById, copy.sequence, say, slotReset],
  );

  const dispatch = useCallback(
    (action: StoryOrderAction): void => {
      const out = stepStoryOrder(play, stateRef.current, action);
      stateRef.current = out.state;
      setState(out.state);
      out.effects.forEach((e) => run(e, out.state));
    },
    [play, run],
  );

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      stop();
    },
    [],
  );

  // Replay: say each line as it comes up, then move on by itself after the line and a short gap (never sooner than the
  // replay interval from its start), unless paused; never with reduced motion (Back and Next step through instead).
  const replaying = state.seq.phase === 'replay';
  const replayIndex = state.seq.replayIndex;
  const replayCard = replaying ? cardById.get(state.seq.solution[replayIndex] ?? '') : undefined;
  const linePlay = useRef<{ index: number; startedAt: number; settled: Promise<void> } | null>(null);
  useEffect(() => {
    if (!replayCard) {
      linePlay.current = null;
      return;
    }
    // One persistent live line says the replayed line (a row that turns live with its text in place is not read); iOS is told.
    const spoken = /[.?!]$/u.test(replayCard.line.ko) ? `${replayCard.line.ko} ${replayCard.line.en}` : `${replayCard.line.ko}. ${replayCard.line.en}`;
    setReplayAnnounce(spoken);
    announceForScreenReader(spoken);
    linePlay.current = { index: replayIndex, startedAt: Date.now(), settled: say(replayCard) };
    // The card is what starts a line; the index changes with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayCard]);
  const advance = autoAdvanceDue(state.seq, reducedMotion);
  useEffect(() => {
    if (!advance) return undefined;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const line = linePlay.current?.index === replayIndex ? linePlay.current : null;
    const startedAt = line?.startedAt ?? Date.now();
    void (line?.settled ?? Promise.resolve()).then(() => {
      if (!live) return;
      timer = setTimeout(() => dispatch({ type: 'replayNext' }), replayAdvanceDelay(Date.now() - startedAt));
    });
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [advance, replayIndex, dispatch]);

  const soundPanel = (testID: string): ReactElement => (
    <PromptPanel
      variant="status"
      view={slot.view}
      onAction={(action) => slot.act(action, () => (lastLine.current ? void say(lastLine.current) : undefined))}
      onHelp={() => setHelpOpen(true)}
      testID={testID}
    />
  );

  if (!round) {
    return (
      <Screen tone="canvas" scrollable>
        <Body>{copy.sequence.emptyLine}</Body>
        <Spacer size="lg" />
        <Button label={copy.sequence.continue.cta} tone="primary" size="lg" fullWidth onPress={() => hostRef.current.complete()} testID="story-order-continue" />
      </Screen>
    );
  }

  const placedCount = state.seq.placed.length;
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        {/* Fills across the step's rounds and never drops. */}
        <Progress value={state.roundIndex * total + placedCount} max={Math.max(1, play.rounds.length * total)} tone="primary" />
      </View>
      <Pill label={pill(state.roundIndex + 1, play.rounds.length)} size="sm" />
    </View>
  );

  if (replaying || state.seq.phase === 'done') {
    return (
      <Screen tone="canvas" scrollable>
        {header}
        <Spacer size="lg" />
        {/* The row filled with the focus on a card that is gone: focus lands here (web: the DOM node). */}
        <View
          ref={replayTitleRef}
          tabIndex={-1}
          testID="story-order-replay-title"
          accessible={Platform.OS !== 'web'}
          accessibilityRole={Platform.OS !== 'web' ? 'header' : undefined}
          accessibilityLabel={Platform.OS !== 'web' ? copy.sequence.replay.title : undefined}
        >
          <Heading level="prompt">{copy.sequence.replay.title}</Heading>
        </View>
        <Text {...KOREAN_LINE_BREAK} testID="story-order-replay-announce" accessibilityLiveRegion="polite" aria-live="polite" style={VISUALLY_HIDDEN}>
          {replayAnnounce}
        </Text>
        <Spacer size="md" />
        <View role="list" testID="story-order-replay" style={{ gap: spacing.md }}>
          {state.seq.solution.map((id, i) => {
            const card = cardById.get(id);
            if (!card) return null;
            const current = i === replayIndex;
            return (
              <View
                key={id}
                role="listitem"
                testID={`story-order-replay-line-${id}`}
                style={{
                  flexDirection: 'row',
                  gap: spacing.md,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radii.md,
                  backgroundColor: colors.surface.paper,
                }}
              >
                {/* The line being said: a bar at its side and the bold weight, never colour alone. */}
                <View style={{ width: spacing.xs, borderRadius: radii.pill, backgroundColor: current ? colors.brand.secondary : colors.surface.paper }} />
                <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, fontWeight: current ? typography.weight.bold : typography.weight.regular, color: colors.text.primary }}>
                  {String(i + 1)}
                </Text>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <KoreanText ko={card.line.ko} romanization={card.line.romanization} size="sm" onPress={() => void say(card)} />
                  <Body weight={current ? 'bold' : 'regular'}>{card.line.en}</Body>
                  {current ? soundPanel('story-order-replay-sound') : null}
                </View>
              </View>
            );
          })}
        </View>
        <Spacer size="lg" />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button fullWidth label={copy.sequence.replay.back.cta} tone="secondary" size="md" disabled={replayIndex === 0} onPress={() => dispatch({ type: 'replayBack' })} testID="story-order-replay-back" />
          </View>
          {reducedMotion ? null : (
            <View style={{ flex: 1 }}>
              <Button
                fullWidth
                label={state.seq.paused ? copy.sequence.replay.play.cta : copy.sequence.replay.pause.cta}
                tone="secondary"
                size="md"
                onPress={() => dispatch({ type: 'togglePause' })}
                testID="story-order-replay-pause"
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Button fullWidth label={copy.sequence.replay.next.cta} tone="secondary" size="md" disabled={replayIndex >= total - 1} onPress={() => dispatch({ type: 'replayNext' })} testID="story-order-replay-next" />
          </View>
        </View>
        <Spacer size="xl" />
        <Button label={copy.sequence.replay.done.cta} tone="primary" size="lg" fullWidth onPress={() => dispatch({ type: 'finish' })} testID="story-order-done" />
        <Spacer size="sm" />
        <Button label={copy.sequence.replay.skip.cta} tone="ghost" size="md" fullWidth onPress={() => dispatch({ type: 'skipReplay' })} testID="story-order-skip-replay" />
        <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
      </Screen>
    );
  }

  const heading = storyOrderHeading(round, copy);
  const pictures = cards.some((c) => c.pictureRef !== undefined);
  const columns = storyOrderColumns(lc.width, lc.windowWidth, pictures);
  const perRow = storyOrderSlotsPerRow(lc.width, total, fontScale);
  const slots = slotViews(state.seq);
  const rows: (typeof slots)[] = [];
  for (let i = 0; i < slots.length; i += perRow) rows.push(slots.slice(i, i + perRow));
  const hintId = (state.seq.wrongBySlot[placedCount] ?? 0) >= HIGHLIGHT_SLOT_AFTER_WRONG ? (state.seq.solution[placedCount] ?? null) : null;
  const remaining = remainingCards(state.seq)
    .map((id) => cardById.get(id))
    .filter((c): c is StoryOrderCard => c !== undefined);

  return (
    <Screen tone="canvas" scrollable>
      {header}
      <Spacer size="lg" />
      <Heading level="prompt">{heading.title}</Heading>
      <Body tone="muted">{heading.hint}</Body>
      <Spacer size="lg" />
      <View testID="story-order-slots" style={{ gap: spacing.sm }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: spacing.sm }}>
            {row.map((s) => {
              const card = s.cardId ? cardById.get(s.cardId) : undefined;
              const face = card ? slotFace(card.line) : null;
              return (
                <View
                  key={s.number}
                  testID={`story-order-slot-${s.number}`}
                  accessible
                  accessibilityLabel={copy.sequence.slotLabel(s.number, total, card?.line.ko)}
                  style={{
                    flex: 1,
                    minHeight: touchTarget.min,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                    borderRadius: radii.md,
                    borderWidth: borderWidth.base,
                    borderStyle: face ? 'solid' : 'dashed',
                    borderColor: face ? colors.brand.secondary : colors.border.shape,
                    backgroundColor: face ? colors.brand.secondaryLight : colors.surface.canvas,
                  }}
                >
                  {face ? (
                    <KoreanText ko={face.ko} romanization={face.romanization} size="sm" />
                  ) : (
                    <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.body, color: colors.text.secondary }}>
                      {String(s.number)}
                    </Text>
                  )}
                </View>
              );
            })}
            {/* A short last row keeps its slots half the column wide on a phone. */}
            {Array.from({ length: perRow - row.length }, (_, i) => (
              <View key={`pad-${i}`} style={{ flex: 1 }} />
            ))}
          </View>
        ))}
      </View>
      <Text {...KOREAN_LINE_BREAK} testID="story-order-announce" accessibilityLiveRegion="polite" aria-live="polite" style={VISUALLY_HIDDEN}>
        {announce}
      </Text>
      {placedCount > 0 ? soundPanel('story-order-sound') : null}
      <Spacer size="lg" />
      <View testID="story-order-cards" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {remaining.map((card) => {
          const outcome = wrongFlash === card.id ? 'wrong' : hintId === card.id ? 'hint' : null;
          const romanization = romanizationShown(romanizationMode, revealed.has(card.id) || state.meanings) ? card.line.romanization : '';
          return (
            <View key={card.id} style={{ flexGrow: 1, flexBasis: CELL_BASIS[columns], minWidth: touchTarget.hero }}>
              <ChoiceCard
                testID={`story-order-card-${card.id}`}
                pressableRef={(node) => {
                  if (node) cardNodes.current.set(card.id, node);
                  else cardNodes.current.delete(card.id);
                }}
                art={card.pictureRef !== undefined ? <PictureArt pictureRef={card.pictureRef} gloss={card.line.en} size={pictureSize} decorative /> : null}
                state={outcome ?? 'idle'}
                ko={card.line.ko}
                romanization={romanization}
                {...(state.meanings ? { gloss: card.line.en } : {})}
                accessibilityLabel={storyOrderCardLabel(card, romanization, state.meanings, outcome, copy)}
                onPress={() => dispatch({ type: 'tap', cardId: card.id })}
              />
            </View>
          );
        })}
      </View>
      <Spacer size="lg" />
      {state.meanings ? (
        // Web: focusable by script only (tabIndex -1), so the line is not a Tab stop that does nothing (WCAG 2.4.3).
        <View ref={meaningsRef} accessible {...(Platform.OS === 'web' ? { tabIndex: -1 as const } : { focusable: true })}>
          <Body tone="muted" testID="story-order-meanings-shown">
            {copy.storyOrder.meaningsShown}
          </Body>
        </View>
      ) : (
        <Button label={copy.storyOrder.showMeanings} tone="secondary" size="md" onPress={() => dispatch({ type: 'showMeanings' })} testID="story-order-show-meanings" />
      )}
      <Spacer size="lg" />
      <View accessibilityLiveRegion="polite">
        {note === 'none' ? null : <HoyaBubble tone="thinking" message={note === 'wrong' ? copy.sequence.tryAnother : copy.sequence.lookHere} />}
      </View>
      {/* The Check has no Skip (check-launcher.ts): a Check step completes on the learner's answers only. */}
      {host.mode === 'check' ? null : (
        <>
          <Spacer size="xl" />
          <Button label={copy.sequence.skip.cta} tone="ghost" size="md" fullWidth onPress={() => dispatch({ type: 'skip' })} testID="story-order-skip" />
        </>
      )}
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </Screen>
  );
}
