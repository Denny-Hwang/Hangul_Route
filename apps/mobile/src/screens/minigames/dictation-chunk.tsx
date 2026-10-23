import { a11yRomanization, typeHangulMode, type KoText, type ListenPickRound, type TypeHangulRound } from '@hangul-route/content-schema';
import { spellByLetterNames } from '@hangul-route/content-schema/letter-names';
import {
  Body,
  Button,
  Caption,
  Icon,
  borderWidth,
  colors,
  motion,
  radii,
  spacing,
  KOREAN_LINE_BREAK,
  touchTarget,
  typography,
  useMediaSize,
  useTypeScale,
} from '@hangul-route/design-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { PictureArt } from '../../components/PictureArt';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot, type PromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { failureFromStore } from '../../logic/audio/prompt-view';
import {
  HEAR_HOLD_MS,
  afterFailedPlay,
  hearAnswerHinted,
  hearOpening,
  hearSpeech,
  type HearOpening,
  type HearSeeReason,
} from '../../logic/type-hangul/hear-mode';
import { hasClip, playPrompt, stop } from '../../platform/audio';
import { useReducedMotion } from '../../platform/motion';
import { useAudioStore } from '../../store/audio-store';

/**
 * The dictation chunk (F-CURR-002 sections 4.5, 7.1 F2 and 10, row CM-31): Type Hangul's `hear` mode and the
 * spelling round's prompt, loaded only when a step plays one of them with its switch on (`dictation-entry.ts`), so the
 * start bundle carries none of it. Design: design/wireframes/minigame/type-hangul.md ("Hear mode: Dictation", "The
 * spelling round"), audio-fallback.md W11, design/screens/minigame-variety/README.md D4 and mock/dictation.html.
 *
 * - `useHearRound` decides how a hear round opens before it opens (hold while the voice list is unknown, at most
 *   1.5 s; `see` with the sound notice with no voice or sound off), plays the word, and turns the round into `see`
 *   after a second failed play. Round 1 of a step waits for a tap on the speaker (the first sound needs a gesture).
 * - `HearPrompt` draws the speaker, the meaning and "Show how it sounds" (a hint: the romanization, recorded as
 *   hinted); the Korean and its romanization are not drawn before Done.
 * - `SpellingCue` and `spellingOptionLabel`: the spelling round's picture and meaning, and the screen-reader label that
 *   spells an option block by block with the letter names, so two options that sound the same are told apart by ear.
 */

export const DICTATION_AUDIO_SOURCE = 'type-hangul-hear';
export const SPELLING_AUDIO_SOURCE = 'spelling-pick';

export interface HearRound {
  /** `see` for a round that is not a hear round, or one that opened (or turned) as `see`. */
  mode: 'hold' | 'hear' | 'see';
  /** Why a hear round is a `see` round: the sound notice's reason; null otherwise. */
  reason: HearSeeReason | null;
  /** "Show how it sounds" was tapped this round (the romanization shows; the answer is recorded as hinted). */
  revealed: boolean;
  reveal: () => void;
  /** The speaker: plays the word (unlimited). Does nothing while the round holds or once it is `see`. */
  play: () => void;
  slot: PromptSlot;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
}

interface ForRound<T> {
  round: number;
  value: T;
}

/** One hear round's opening, sound and hint (a round that is not `hear` is `see`, untouched). */
export function useHearRound(round: Pick<TypeHangulRound, 'mode' | 'audioRef' | 'target'> | undefined, roundIdx: number): HearRound {
  const isHear = round !== undefined && typeHangulMode(round) === 'hear';
  const speech = round === undefined ? null : hearSpeech(round);
  const clip = hasClip(speech?.audioRef);
  // Only a hear round reports its fallback: a `see` round beside it in the scope plays nothing and shows no notice.
  const slot = usePromptSlot({ source: DICTATION_AUDIO_SOURCE, hasClip: clip, reportFallback: isHear });
  const { play: slotPlay, reset: slotReset } = slot;
  const tts = useAudioStore((s) => s.tts.state);
  const muted = useAudioStore((s) => s.muted);
  const [heldFor, setHeldFor] = useState<number | null>(null);
  const [opened, setOpened] = useState<ForRound<HearOpening> | null>(null);
  const [revealedFor, setRevealedFor] = useState<number | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const failures = useRef<ForRound<number>>({ round: roundIdx, value: 0 });

  // Each round holds afresh: the hold ends at 1.5 s whatever the voice list says by then.
  useEffect(() => {
    slotReset();
    if (!isHear) return undefined;
    const timer = setTimeout(() => setHeldFor(roundIdx), HEAR_HOLD_MS);
    return () => clearTimeout(timer);
  }, [roundIdx, isHear, slotReset]);

  const decided = opened !== null && opened.round === roundIdx ? opened.value : null;
  const live = hearOpening({ tts, hasClip: clip, muted, held: heldFor === roundIdx });
  const opening: HearOpening = decided ?? live;
  // Once decided, the round keeps its opening: turning sound on keeps a `see` round as it is (no flicker).
  useEffect(() => {
    if (isHear && decided === null && live.kind !== 'hold') setOpened({ round: roundIdx, value: live });
  }, [isHear, decided, live.kind, live, roundIdx]);

  const mode: HearRound['mode'] = !isHear ? 'see' : opening.kind;
  const text = speech?.text;
  const audioRef = speech?.audioRef;
  const play = useCallback((): void => {
    if (text === undefined) return;
    const forRound = roundIdx;
    void slotPlay(() => playPrompt({ text, kind: 'word', source: DICTATION_AUDIO_SOURCE, ...(audioRef === undefined ? {} : { audioRef }) })).then((result) => {
      if (result !== 'unavailable') return;
      // A sound the browser blocked waits for the tap the speaker asks for; any other failure counts.
      if (failureFromStore(useAudioStore.getState().lastFailure) === 'blocked') return;
      const count = failures.current.round === forRound ? failures.current.value + 1 : 1;
      failures.current = { round: forRound, value: count };
      const next = afterFailedPlay(count);
      if (next.kind === 'see') setOpened({ round: forRound, value: next });
    });
  }, [text, audioRef, roundIdx, slotPlay]);

  // The word is said when a hear round opens, from round 2 on; round 1 waits for a tap on the speaker.
  const opensHeard = mode === 'hear' && roundIdx > 0;
  useEffect(() => {
    if (opensHeard) play();
  }, [opensHeard, play]);
  useEffect(() => () => stop(), []);

  return {
    mode,
    reason: isHear && opening.kind === 'see' ? opening.reason : null,
    revealed: revealedFor === roundIdx,
    reveal: () => setRevealedFor(roundIdx),
    play: () => {
      if (mode === 'hear') play();
    },
    slot,
    helpOpen,
    setHelpOpen,
  };
}

/** Whether the memory store records this first Done as hinted (section 4.3; the hint, or one letter off). */
export function hearAnswerIsHinted(round: Pick<TypeHangulRound, 'target'>, typed: string, revealed: boolean): boolean {
  return hearAnswerHinted(round.target.ko, typed, revealed);
}

interface HearPromptProps {
  hear: HearRound;
  round: Pick<TypeHangulRound, 'target' | 'pictureRef'>;
  /** Below `layout.compactHeight`: one row of speaker and meaning button (the parent adds Skip). */
  compact: boolean;
  /** Round 1 waits for a tap: the speaker pulses once (static under reduced motion). */
  first: boolean;
  testID?: string;
}

/** The hear prompt: the speaker, the meaning (and picture), and "Show how it sounds". Never the Korean before Done. */
export function HearPrompt({ hear, round, compact, first, testID = 'dictation-prompt' }: HearPromptProps): ReactElement {
  const m = useMessages();
  const t = m.learner.minigame.typeHangul;
  const reduced = useReducedMotion();
  const textScale = useTypeScale();
  const heroSize = useMediaSize(touchTarget.hero);
  const pictureSize = useMediaSize(touchTarget.hero);
  const holding = hear.mode === 'hold';
  const view = hear.slot.view;
  const speakerLabel = view.reason === 'muted' || view.reason === 'blocked' ? view.speakerLabel : m.a11y.minigame.dictation.speaker;
  const gloss = round.target.en;
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced || !first || holding) return;
    pulse.value = withSequence(withTiming(1.12, { duration: motion.duration.slow }), withTiming(1, { duration: motion.duration.slow }));
  }, [reduced, first, holding, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const size = compact ? touchTarget.min : heroSize;

  const speaker = (
    <Animated.View style={first && !reduced ? pulseStyle : undefined}>
      <Pressable
        testID={`${testID}-speaker`}
        onPress={hear.play}
        disabled={holding}
        accessibilityRole="button"
        accessibilityLabel={speakerLabel}
        accessibilityState={{ disabled: holding }}
        style={{
          width: size,
          height: size,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: holding ? colors.surface.paper : colors.brand.secondaryLight,
          borderColor: holding ? colors.border.subtle : colors.brand.secondary,
          borderWidth: borderWidth.base,
        }}
      >
        <Icon name="speaker" size={compact ? spacing.xl : spacing.xxxl} color={holding ? colors.text.muted : colors.brand.secondaryDark} />
      </Pressable>
    </Animated.View>
  );
  const romanization = (
    <Text {...KOREAN_LINE_BREAK} accessibilityLiveRegion="polite" style={{ fontSize: textScale.size.bodySm, fontStyle: 'italic', color: colors.text.secondary }} testID={`${testID}-romanization`}>
      {hear.revealed ? round.target.romanization : ''}
    </Text>
  );
  const status = (
    <PromptPanel view={view} variant="status" compact={compact} onAction={(action) => hear.slot.act(action, hear.play)} onHelp={() => hear.setHelpOpen(true)} testID={`${testID}-status`} />
  );

  if (compact) {
    // The meaning button is one hit area at least 64 tall: the meaning, then "Show how it sounds" (the romanization once tapped).
    return (
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {speaker}
          <Pressable
            testID={`${testID}-meaning`}
            onPress={hear.reveal}
            disabled={hear.revealed}
            accessibilityRole="button"
            accessibilityLabel={hear.revealed ? `${t.hear.meaning(gloss)}. ${a11yRomanization(round.target.romanization)}` : `${t.hear.meaning(gloss)}. ${t.hear.showSound}`}
            style={{ flex: 1, minWidth: 0, minHeight: touchTarget.min, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radii.md }}
          >
            <Text {...KOREAN_LINE_BREAK} numberOfLines={2} style={{ fontSize: textScale.size.body, fontWeight: typography.weight.bold, color: colors.text.primary }} testID={`${testID}-gloss`}>
              {gloss}
            </Text>
            {hear.revealed ? romanization : <Caption tone="secondary" style={{ textDecorationLine: 'underline' }}>{t.hear.showSound}</Caption>}
          </Pressable>
        </View>
        {status}
        <VoiceHelpSheet visible={hear.helpOpen} onClose={() => hear.setHelpOpen(false)} />
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }} testID={testID}>
      {speaker}
      <Button label={m.learner.minigame.listenPick.hearAgain.cta} tone="secondary" size="md" disabled={holding} onPress={hear.play} testID={`${testID}-again`} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center' }}>
        {round.pictureRef ? <PictureArt pictureRef={round.pictureRef} gloss={gloss} size={pictureSize} /> : null}
        <Body weight="bold" testID={`${testID}-gloss`}>
          {t.hear.meaning(gloss)}
        </Body>
      </View>
      {hear.revealed ? romanization : <Button label={t.hear.showSound} tone="ghost" size="sm" onPress={hear.reveal} testID={`${testID}-show-sound`} />}
      {status}
      <VoiceHelpSheet visible={hear.helpOpen} onClose={() => hear.setHelpOpen(false)} />
    </View>
  );
}

/** The sound notice of a hear round that opened (or turned) as `see`: the read line, why, and the one action. */
export function SeeNotice({ hear, testID = 'dictation-notice' }: { hear: HearRound; testID?: string }): ReactElement | null {
  if (hear.reason === null) return null;
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <PromptPanel view={hear.slot.view} onAction={(action) => hear.slot.act(action, hear.play)} onHelp={() => hear.setHelpOpen(true)} testID={testID} />
      <VoiceHelpSheet visible={hear.helpOpen} onClose={() => hear.setHelpOpen(false)} />
    </View>
  );
}

// ---- the spelling round ---------------------------------------------------------------------------------------

/** The spelling round's cue: the picture of the word and its meaning, which settle the spelling (section 4.5). */
export function SpellingCue({ round, testID = 'spelling-cue' }: { round: Pick<ListenPickRound, 'prompt' | 'pictureRef'>; testID?: string }): ReactElement {
  const pictureSize = useMediaSize(touchTarget.hero);
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm }} testID={testID}>
      {round.pictureRef ? <PictureArt pictureRef={round.pictureRef} gloss={round.prompt.en} size={pictureSize} /> : null}
      <Body weight="bold" align="center" testID={`${testID}-gloss`}>
        {round.prompt.en}
      </Body>
    </View>
  );
}

/**
 * A spelling option's screen-reader name: its Hangul block by block with the letter names (`spellByLetterNames`),
 * then its romanization, so two options that sound the same never read the same.
 */
export function spellingOptionLabel(text: Pick<KoText, 'ko' | 'romanization'>): string {
  return `${spellByLetterNames(text.ko)}. ${a11yRomanization(text.romanization)}`;
}
