import {
  Body,
  Button,
  Caption,
  Card,
  ChoiceCard,
  Heading,
  HoyaBubble,
  KOREAN_LANGUAGE,
  KoreanText,
  Pill,
  spacing,
  supportedCardIds,
  touchTarget,
  typography,
  useMediaSize,
} from '@hangul-route/design-system';
import type { Messages, RomanizationMode } from '@hangul-route/i18n';
import React, { useEffect, useRef } from 'react';
import { Platform, Text, View } from 'react-native';
import {
  checkBubble,
  checkOptionCell,
  checkOptionColumns,
  optionCardView,
  revealNeeded,
  targetAccessibilityLabel,
  targetView,
} from '../../logic/story/check-game';
import type { CheckState } from '../../logic/story/check-player';
import type { CheckView } from '../../logic/story/check-view';
import { PictureArt } from '../minigames/PictureArt';
import { SpeakerButton } from './ReaderParts';

type CheckCopy = Messages['learner']['story']['check'];
type ReaderCopy = Messages['learner']['story']['reader'];

/** Taught Korean inside an English line: read in a Korean voice (web `lang`, iOS `accessibilityLanguage`). */
const koreanSpeech = { lang: KOREAN_LANGUAGE, accessibilityLanguage: KOREAN_LANGUAGE };

/** Hidden from assistive tech: a visual cue whose words a labelled element already says. */
const a11yHidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants', 'aria-hidden': true } as const;

/** Focus target on the web (react-native-web forwards `focus`); a no-op where the node has none. */
export interface CheckpointFocusable {
  focus?: (options?: { preventScroll?: boolean }) => void;
}

export interface CheckpointCardProps {
  item: CheckView;
  /** The card's check state (`reader-checkpoint.ts` keeps one per checkpoint). */
  check: CheckState;
  /** "Quick question" (quest) or "Try it" (replay). */
  heading: string;
  checkCopy: CheckCopy;
  readerCopy: ReaderCopy;
  romanizationMode: RomanizationMode;
  /** The learner tapped "Show how to say it" on this card (hide-until-tap, D2). */
  revealed: boolean;
  /** No Korean voice: the "Say it yourself" pill stands in for the Korean speaker (F-AUDIO-004 §3.8). */
  sayIt: boolean;
  onHearQuestion: () => void;
  onHearTarget: () => void;
  onReveal: () => void;
  onChoose: (optionId: string) => void;
  onSkip: () => void;
  /**
   * Native only: Hoya's hint or explanation has been laid out under the options, so the host can scroll its
   * text area to it (the web brings it into view with `scrollIntoView`).
   */
  onBubbleShown?: () => void;
  /** The reader's shared sound state (`PromptPanel`: muted, no Korean voice, tap to hear). */
  promptPanel?: React.ReactNode;
  /** The card region, for the focus move when it opens (web). */
  regionRef: (node: CheckpointFocusable | null) => void;
}

/**
 * The inline checkpoint question of the story reader (F-STORY-002 §3.7, PR
 * 2.9; wireframe design/wireframes/story/reader.md G2; component spec
 * design/components/StoryReaderView/spec.md, "Checkpoint"). The same pieces as
 * the story check step (F-STORY-003 §3.4): the prompt with its speaker, the
 * Korean target, `ChoiceCard` options with the written outcome next to a
 * tapped card, Hoya's hint or explanation, and a Skip that is always there.
 * No state and no rules: `StoryReaderView` passes everything in.
 */
export function CheckpointCard({
  item,
  check,
  heading,
  checkCopy,
  readerCopy,
  romanizationMode,
  revealed,
  sayIt,
  onHearQuestion,
  onHearTarget,
  onReveal,
  onChoose,
  onSkip,
  onBubbleShown,
  promptPanel,
  regionRef,
}: CheckpointCardProps): React.ReactElement {
  const pictureSize = useMediaSize(touchTarget.hero);
  const ctx = { romanizationMode, revealed };
  const target = targetView(item, check, ctx);
  const bubble = checkBubble(item, check, checkCopy);
  const cell = checkOptionCell(checkOptionColumns(item));
  const reveal = revealNeeded(item, check, ctx);

  // Hoya's line (hint or explanation) comes into view inside the text area when it changes (web here; native
  // through `onBubbleShown` once the bubble is laid out, below).
  const bubbleRef = useRef<View | null>(null);
  useEffect(() => {
    if (!bubble) return;
    const node = bubbleRef.current as unknown as { scrollIntoView?: (o: { block: 'nearest' }) => void } | null;
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [bubble?.message]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View
      ref={(node) => regionRef(node as unknown as CheckpointFocusable | null)}
      tabIndex={-1}
      role="region"
      aria-label={heading}
      testID="story-reader-checkpoint"
      style={{ gap: spacing.lg }}
    >
      <Card tone="paper" padding="lg" elevation="card">
        <View style={{ gap: spacing.md }}>
          <Caption tone="muted" testID="story-reader-checkpoint-heading">
            {heading}
          </Caption>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Heading level="prompt" testID="story-reader-checkpoint-prompt">
                {item.promptParts.map((part, i) =>
                  'target' in part ? (
                    <Text key={i} {...koreanSpeech} style={{ fontWeight: typography.weight.bold }}>
                      {part.target.ko}
                    </Text>
                  ) : (
                    part.text
                  ),
                )}
              </Heading>
            </View>
            <SpeakerButton label={checkCopy.speakerPrompt} onPress={onHearQuestion} testID="story-reader-checkpoint-hear" />
          </View>

          {target ? (
            <View style={{ alignSelf: 'flex-start' }}>
              <KoreanText
                ko={target.ko}
                romanization={target.romanization}
                gloss={target.gloss}
                size="md"
                // Without a Korean voice the speaker gives way to the "Say it yourself" pill.
                onPress={sayIt ? undefined : onHearTarget}
                accessibilityLabel={sayIt ? undefined : targetAccessibilityLabel(target, checkCopy)}
                testID="story-reader-checkpoint-target"
              />
            </View>
          ) : null}

          {sayIt || reveal ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
              {sayIt ? <Pill label={readerCopy.sayItYourself.pill} tone="info" testID="story-reader-checkpoint-say-it" /> : null}
              {reveal ? (
                <Button
                  label={checkCopy.showRomanization.cta}
                  tone="ghost"
                  size="md"
                  onPress={onReveal}
                  testID="story-reader-checkpoint-reveal"
                />
              ) : null}
            </View>
          ) : null}

          {promptPanel}

          <View testID="story-reader-checkpoint-options" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {item.options.map((option) => {
              const card = optionCardView(item, option, check, { ...ctx, copy: checkCopy });
              const art =
                card.art !== undefined && supportedCardIds.includes(card.art) ? (
                  <PictureArt pictureRef={card.art} gloss={card.label ?? ''} size={pictureSize} />
                ) : undefined;
              return (
                <View key={option.id} style={{ ...cell, minWidth: touchTarget.hero, gap: spacing.xs }}>
                  <ChoiceCard
                    testID={`story-reader-checkpoint-option-${option.id}`}
                    state={card.state}
                    label={card.label}
                    ko={card.ko}
                    romanization={card.romanization}
                    gloss={card.gloss}
                    art={art}
                    accessibilityLabel={card.accessibilityLabel}
                    onPress={() => onChoose(option.id)}
                  />
                  {card.status ? (
                    // The visible non-colour cue; the card's accessible name already ends with these words.
                    <View {...a11yHidden}>
                      <Body size="sm" weight="semibold" testID={`story-reader-checkpoint-status-${option.id}`}>
                        {card.status === 'correct' ? checkCopy.correct : checkCopy.tryAnother}
                      </Body>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </Card>

      {/* A live region on the web only: native announces the outcome line itself (one announcement, no overlap). */}
      <View
        ref={bubbleRef}
        accessibilityLiveRegion={Platform.OS === 'web' ? 'polite' : 'none'}
        onLayout={Platform.OS === 'web' || !bubble ? undefined : () => onBubbleShown?.()}
      >
        {bubble ? <HoyaBubble tone={bubble.tone} message={bubble.message} testID="story-reader-checkpoint-bubble" /> : null}
      </View>

      {/* Under the question, as in wireframe G2: a ghost, never a second primary. */}
      <View style={{ alignSelf: 'flex-start' }}>
        <Button label={readerCopy.checkpoint.skip.cta} tone="ghost" size="md" onPress={onSkip} testID="story-reader-checkpoint-skip" />
      </View>
    </View>
  );
}
