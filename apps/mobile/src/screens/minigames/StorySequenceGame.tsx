import {
  Body,
  Button,
  Card,
  ChoiceCard,
  Heading,
  HoyaBubble,
  Icon,
  KoreanText,
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
  useLayoutClass,
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { storyById } from '../../content/stories';
import { useMessages } from '../../i18n/use-messages';
import type { MinigameScope } from '../../logic/minigame-config';
import { buildSequenceCards, type SequenceCard } from '../../logic/story/sequence-cards';
import {
  HIGHLIGHT_SLOT_AFTER_WRONG,
  initSequenceState,
  reduceSequence,
  remainingCards,
  type SequenceAction,
  type SequenceEffect,
  type SequenceState,
} from '../../logic/story/sequence-player';
import {
  SEQUENCE_REPLAY_MS,
  SEQUENCE_WRONG_FLASH_MS,
  autoAdvanceDue,
  longestKoreanGlyphs,
  sequenceCardLabel,
  sequenceCardRomanization,
  sequenceColumns,
  sequenceFinishedPayload,
  sequenceSeed,
  sequenceSummary,
  slotViews,
} from '../../logic/story/sequence-view';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success } from '../../platform/haptics';
import { useReducedMotion } from '../../platform/motion';
import { track } from '../../platform/telemetry';
import { useLocaleStore } from '../../store/locale-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useQuestRunStore } from '../../store/quest-run-store';

interface Props {
  scope: MinigameScope;
  onFinish: () => void;
  /** The minigame ref; seeds the start order and names the sequence in telemetry. */
  sequenceId?: string;
  /** Per-mount random nonce for the start order; tests inject a fixed one. */
  nonce?: number;
}

/** Column share of one card cell, by column count. */
const CELL_BASIS = { 1: '100%', 2: '45%', 3: '30%', 4: '22%' } as const;

type Note = 'hint' | 'wrong' | 'look';

/**
 * Story Order v2 (F-STORY-003 §3.5). The cards start in a derangement of the
 * correct order; the learner taps the one that comes next and it moves into
 * the next slot. A wrong card flashes amber and nothing moves (the slot is
 * scored once, first try); after two misses the right card gets a ring. When
 * every slot is filled the story replays in order (no scoring), then Done.
 * Serves the three legacy `storySteps` scopes and story scopes alike; scene art
 * arrives with PR 3.5b. Design: design/wireframes/story/check.md (F, G).
 */
export function StorySequenceGame({ scope, onFinish, sequenceId = '', nonce }: Props): React.ReactElement {
  const cards = useMemo(
    () => buildSequenceCards(scope, scope.story ? storyById(scope.story.storyId) : undefined),
    [scope],
  );
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const [mountNonce] = useState(() => nonce ?? Math.floor(Math.random() * 0x7fffffff));
  const [state, setState] = useState<SequenceState>(() =>
    initSequenceState(cards, sequenceSeed(sequenceId, mountNonce)),
  );
  const stateRef = useRef(state);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const [note, setNote] = useState<Note>('hint');
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const answerRound = useQuestRunStore((s) => s.answerRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);
  const activeProfileId = useProfileStore((s) => activeProfileSelector(s)?.id);
  const romanizationMode = useLocaleStore((s) =>
    s.byProfile[activeProfileId ?? '']?.romanizationMode ?? 'always',
  );
  const reducedMotion = useReducedMotion();
  // F-LAYOUT-001 §3.12: the window from the layout class (3-4 card columns at tablet width, F-STORY-003 §3.5).
  const width = useLayoutClass().windowWidth;
  const story = useMessages().learner.story;
  const copy = story.sequence;

  const finish = useCallback(
    (finalState: SequenceState, skipped: boolean): void => {
      void track({
        name: 'story.sequence.finished',
        profileId: activeProfileId,
        payload: sequenceFinishedPayload(
          { storyId: scope.story?.storyId ?? null, sequenceId },
          sequenceSummary(finalState),
          skipped,
        ),
      });
      stop();
      markStepComplete();
      onFinish();
    },
    [activeProfileId, scope.story?.storyId, sequenceId, markStepComplete, onFinish],
  );

  const dispatch = useCallback(
    (action: SequenceAction): void => {
      const previous = stateRef.current;
      const out = reduceSequence(previous, action);
      stateRef.current = out.state;
      setState(out.state);
      const run = (effect: SequenceEffect): void => {
        if (effect.type === 'answer') {
          if (effect.correct) {
            success();
            setNote('hint');
            setWrongFlash(null); // a card that just missed may be the next right one: never leave it locked
          } else {
            nudge();
            setNote('wrong');
          }
          answerRound(effect.roundKey, effect.correct);
        } else if (effect.type === 'highlight') {
          setNote('look');
        } else {
          finish(out.state, false);
        }
      };
      out.effects.forEach(run);
      if (action.type === 'tap' && out.state.wrongBySlot !== previous.wrongBySlot) {
        // A miss: the card flashes amber for a moment and its romanization is shown (D2).
        setRevealed((prev) => new Set(prev).add(action.cardId));
        setWrongFlash(action.cardId);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setWrongFlash(null), SEQUENCE_WRONG_FLASH_MS);
      }
    },
    [answerRound, finish],
  );

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      stop();
    },
    [],
  );

  // Replay: speak the line of each card as it comes up (the text is always visible, so a silent browser loses nothing).
  const replayCard = state.phase === 'replay' ? cardById.get(state.solution[state.replayIndex] ?? '') : undefined;
  useEffect(() => {
    if (!replayCard?.ko) return;
    void playPrompt({
      text: replayCard.ko.spokenKo ?? replayCard.ko.ko,
      audioRef: replayCard.ko.audioRef,
      source: 'story-sequence',
    });
  }, [replayCard]);

  // Replay: move on by itself about every 2.5 s unless paused (never with reduced motion).
  const advance = autoAdvanceDue(state, reducedMotion);
  useEffect(() => {
    if (!advance) return undefined;
    const timer = setTimeout(() => dispatch({ type: 'replayNext' }), SEQUENCE_REPLAY_MS);
    return () => clearTimeout(timer);
  }, [advance, state.replayIndex, dispatch]);

  const total = state.solution.length;
  const placedCount = state.placed.length;

  if (total === 0) {
    return (
      <Screen tone="canvas" scrollable>
        <Body>{copy.emptyLine}</Body>
        <Spacer size="lg" />
        <Button label={copy.continue.cta} tone="primary" size="lg" fullWidth onPress={() => finish(state, true)} />
      </Screen>
    );
  }

  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Progress value={placedCount} max={total} tone="primary" />
      </View>
      <Pill label={story.check.position.pill(placedCount, total)} size="sm" />
    </View>
  );

  if (state.phase !== 'ordering') {
    return (
      <Screen tone="canvas" scrollable>
        {header}
        <Spacer size="lg" />
        <Heading level="prompt">{copy.replay.title}</Heading>
        <Spacer size="md" />
        <Card elevation="card" padding="lg" tone="paper" testID="story-sequence-replay-card">
          <View style={{ gap: spacing.md }}>
            <Pill label={story.check.position.pill(state.replayIndex + 1, total)} size="sm" tone="neutral" />
            {replayCard?.ko ? (
              <KoreanText
                ko={replayCard.ko.ko}
                romanization={sequenceCardRomanization(replayCard, romanizationMode, true)}
                size="md"
                testID="story-sequence-replay-ko"
                onPress={() =>
                  void playPrompt({
                    text: replayCard.ko?.spokenKo ?? replayCard.ko?.ko ?? '',
                    audioRef: replayCard.ko?.audioRef,
                    source: 'story-sequence',
                  })
                }
              />
            ) : null}
            <Body weight="semibold" testID="story-sequence-replay-caption">
              {replayCard?.caption ?? ''}
            </Body>
          </View>
        </Card>
        <Spacer size="lg" />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              fullWidth
              label={copy.replay.back.cta}
              tone="secondary"
              size="md"
              disabled={state.replayIndex === 0}
              onPress={() => dispatch({ type: 'replayBack' })}
              testID="story-sequence-replay-back"
            />
          </View>
          {reducedMotion ? null : (
            <View style={{ flex: 1 }}>
              <Button
                fullWidth
                label={state.paused ? copy.replay.play.cta : copy.replay.pause.cta}
                tone="secondary"
                size="md"
                onPress={() => dispatch({ type: 'togglePause' })}
                testID="story-sequence-replay-pause"
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Button
              fullWidth
              label={copy.replay.next.cta}
              tone="secondary"
              size="md"
              disabled={state.replayIndex >= total - 1}
              onPress={() => dispatch({ type: 'replayNext' })}
              testID="story-sequence-replay-next"
            />
          </View>
        </View>
        <Spacer size="xl" />
        <Button
          label={copy.replay.done.cta}
          tone="primary"
          size="lg"
          fullWidth
          onPress={() => dispatch({ type: 'finish' })}
          testID="story-sequence-done"
        />
        <Spacer size="sm" />
        <Button
          label={copy.replay.skip.cta}
          tone="ghost"
          size="md"
          fullWidth
          onPress={() => dispatch({ type: 'skipReplay' })}
          testID="story-sequence-skip-replay"
        />
      </Screen>
    );
  }

  const slot = placedCount;
  const hintId =
    (state.wrongBySlot[slot] ?? 0) >= HIGHLIGHT_SLOT_AFTER_WRONG ? (state.solution[slot] ?? null) : null;
  const columns = sequenceColumns(width, longestKoreanGlyphs(cards));
  const remaining = remainingCards(state)
    .map((id) => cardById.get(id))
    .filter((c): c is SequenceCard => c !== undefined);

  return (
    <Screen tone="canvas" scrollable>
      {header}

      <Spacer size="lg" />
      <Heading level="prompt">{copy.title}</Heading>
      <Body tone="muted">{copy.stepHint}</Body>

      <Spacer size="lg" />
      <View
        testID="story-sequence-slots"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, minHeight: touchTarget.min }}
      >
        {slotViews(state).map((s) => {
          const card = s.cardId ? cardById.get(s.cardId) : undefined;
          return (
            <View
              key={s.number}
              testID={`story-sequence-slot-${s.number}`}
              accessible
              accessibilityLabel={copy.slotLabel(s.number, total, card?.caption)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radii.pill,
                borderWidth: borderWidth.base,
                borderColor: card ? colors.feedback.success : colors.border.subtle,
                backgroundColor: card ? colors.feedback.successLight : colors.surface.sunken,
              }}
            >
              <Text
                style={{
                  fontSize: typography.size.bodySm,
                  fontWeight: typography.weight.bold,
                  color: colors.text.primary,
                }}
              >
                {s.number}
              </Text>
              {card ? (
                <>
                  <Icon name="check" size={spacing.lg} color={colors.feedback.success} />
                  <Text style={{ fontSize: typography.size.bodySm, color: colors.text.primary }}>{card.caption}</Text>
                </>
              ) : null}
            </View>
          );
        })}
      </View>

      <Spacer size="lg" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {remaining.map((card) => {
          const outcome = wrongFlash === card.id ? 'wrong' : hintId === card.id ? 'hint' : null;
          const romanization = sequenceCardRomanization(card, romanizationMode, revealed.has(card.id));
          return (
            <View
              key={card.id}
              style={{ flexGrow: 1, flexBasis: CELL_BASIS[columns], minWidth: touchTarget.hero }}
            >
              <ChoiceCard
                testID={`story-sequence-card-${card.id}`}
                state={outcome ?? 'idle'}
                ko={card.ko?.ko}
                romanization={romanization}
                label={card.caption}
                accessibilityLabel={sequenceCardLabel(card, romanization, outcome, copy)}
                onPress={() => dispatch({ type: 'tap', cardId: card.id })}
              />
            </View>
          );
        })}
      </View>

      <Spacer size="lg" />
      <View accessibilityLiveRegion="polite">
        {note === 'hint' ? null : (
          <HoyaBubble tone="thinking" message={note === 'wrong' ? copy.tryAnother : copy.lookHere} />
        )}
      </View>
      <Spacer size="xl" />
      <Button label={copy.skip.cta} tone="ghost" size="md" fullWidth onPress={() => finish(state, true)} />
    </Screen>
  );
}
