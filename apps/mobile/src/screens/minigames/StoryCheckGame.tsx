import {
  Body,
  Button,
  ChoiceCard,
  Heading,
  HoyaBubble,
  KOREAN_LANGUAGE,
  KoreanText,
  Pill,
  Progress,
  Screen,
  Spacer,
  spacing,
  supportedCardIds,
  touchTarget,
  typography,
  useMediaSize,
  KOREAN_LINE_BREAK,
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Text, View } from 'react-native';
import { storyById } from '../../content/stories';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { localizeStory } from '../../logic/content-locale';
import type { MinigameScope } from '../../logic/minigame-config';
import {
  EMPTY_CHECK_TALLY,
  STORY_CHECK_AUDIO_SOURCE,
  checkAnsweredPayload,
  checkBubble,
  checkFallbackReason,
  checkFinishedPayload,
  checkGameItems,
  checkHasKorean,
  checkOptionCell,
  checkOptionColumns,
  checkOutcomeLine,
  checkProgress,
  checkSpeech,
  optionCardView,
  revealNeeded,
  tallyResolved,
  targetAccessibilityLabel,
  targetView,
  uiSpeechLang,
  type CheckIds,
  type CheckTally,
} from '../../logic/story/check-game';
import {
  initCheckState,
  reduceCheck,
  type CheckAction,
  type CheckPlayerView,
  type CheckState,
} from '../../logic/story/check-player';
import { recapWords } from '../../logic/story/recap';
import { sayItYourselfShown } from '../../logic/story/reader-effects';
import { effectiveReadToMe } from '../../logic/story/reader-settings';
import { noteFallbackShown } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { focusForScreenReader } from '../../platform/screen-reader';
import { track } from '../../platform/telemetry';
import { useLocaleStore } from '../../store/locale-store';
import { activeProfileSelector, useProfileStore } from '../../store/profile-store';
import { useQuestRunStore } from '../../store/quest-run-store';
import { SpeakerButton } from '../story/ReaderParts';
import { StoryWordRecap } from '../story/StoryWordRecap';
import { useReaderAudio } from '../story/use-reader-audio';
import { useRouteBackGuard } from '../use-back-guard';
import { PictureArt } from './PictureArt';

interface Props {
  scope: MinigameScope;
  /** The shell's close (`minigame.finished`, then back); called after the step is marked complete. */
  onFinish: () => void;
}

/** Taught Korean inside an English line: read in a Korean voice (spec §3.10; web `lang`, iOS `accessibilityLanguage`). */
const koreanSpeech = { lang: KOREAN_LANGUAGE, accessibilityLanguage: KOREAN_LANGUAGE };

/** Hidden from assistive tech: a visual cue whose words a labelled element already says. */
const a11yHidden = { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants', 'aria-hidden': true } as const;

/** Native screen readers hear the outcome line; iOS queues it behind the focus move to Next, Android has no queue option. */
function announce(line: string, queue: boolean): void {
  if (queue && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions(line, { queue: true });
  else AccessibilityInfo.announceForAccessibility(line);
}

/**
 * The story check step (F-STORY-003 §3.4; wireframe design/wireframes/story/check.md
 * A-D; option card design/components/ChoiceCard/spec.md). Three to five
 * questions about the story just read, one at a time. The first tap on an item
 * scores it (`answerRound('check:<id>', …)`, first try only); a wrong tap is an
 * amber "Try another" that locks that card, a second one rings the right card,
 * and the item resolves only on the right card, with the explanation and a
 * Next button (never an auto-advance). The rules live in
 * `logic/story/check-player.ts` and `logic/story/check-game.ts`; this file
 * paints them and runs their effects. After the last item, Next opens the
 * word recap (`StoryWordRecap`, §3.6, PR 3.4b) when the story has words to
 * recap; its Done (or Close) ends the step. Without words, Next ends the step at once.
 */
export function StoryCheckGame({ scope, onFinish }: Props): React.ReactElement {
  const locale = useLocale();
  const m = useMessages();
  const copy = m.learner.story.check;
  const level = scope.story?.level ?? 'listen';
  const checkIds = scope.story?.checkIds;
  // The items as shown (UI-language overlay) and as authored (tells translated text from English for speech).
  // The recap words carry the gloss in the UI language (overlay); only the Korean is spoken.
  const { items, sourceItems, words } = useMemo(() => {
    const story = scope.story ? storyById(scope.story.storyId) : undefined;
    const shown = story && localizeStory(story, locale);
    return {
      items: checkGameItems(shown, level, checkIds),
      sourceItems: checkGameItems(story, level, checkIds),
      words: shown ? recapWords(shown, level) : [],
    };
  }, [scope.story, locale, level, checkIds]);
  const playerView = useMemo<CheckPlayerView>(() => ({ items, hasRecap: words.length > 0 }), [items, words]);
  const ids: CheckIds = { storyId: scope.story?.storyId ?? null, level: scope.story?.level ?? null };
  const idsRef = useRef(ids);
  idsRef.current = ids;

  const [state, setState] = useState<CheckState>(() => initCheckState(playerView));
  const stateRef = useRef(state);
  const tally = useRef<CheckTally>(EMPTY_CHECK_TALLY);
  const finished = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const nextRef = useRef<View | null>(null);

  const answerRound = useQuestRunStore((s) => s.answerRound);
  const markStepComplete = useQuestRunStore((s) => s.markStepComplete);
  const profile = useProfileStore(activeProfileSelector);
  const profileId = profile?.id ?? null;
  const settings = useLocaleStore((s) => (profileId === null ? undefined : s.byProfile[profileId]));
  const romanizationMode = useRomanizationMode();
  const readToMe = effectiveReadToMe(settings?.readToMe, profile?.ageGroup ?? '');
  // No PromptPanel here: the only fallback this screen draws is the "Say it yourself" chip, reported below.
  const audio = useReaderAudio(STORY_CHECK_AUDIO_SOURCE, { reportFallback: false });
  // The hook's functions are stable; the object around them is new on every render.
  const { play: playAudio, stop: stopAudio, resetForScene } = audio;
  const pictureSize = useMediaSize(touchTarget.hero);

  const finish = useCallback((): void => {
    if (finished.current) return;
    finished.current = true;
    void track({
      name: 'story.check.finished',
      profileId: profileId ?? undefined,
      payload: checkFinishedPayload(idsRef.current, playerView.items.length, tally.current),
    });
    stopAudio();
    markStepComplete();
    onFinish();
  }, [profileId, playerView, stopAudio, markStepComplete, onFinish]);

  const dispatch = useCallback(
    (action: CheckAction): void => {
      const previous = stateRef.current;
      const out = reduceCheck(previous, action, playerView);
      stateRef.current = out.state;
      setState(out.state);
      for (const effect of out.effects) {
        if (effect.type === 'answer') {
          if (effect.correct) {
            tapLight();
            success();
          } else {
            nudge();
          }
          answerRound(effect.roundKey, effect.correct);
          // The Hoya bubble is a polite live region on the web. Native hears the outcome and Hoya's line
          // in one announcement: a miss at once, a resolve after focus moves to Next (effect below).
          const answered = playerView.items[previous.index];
          if (Platform.OS !== 'web' && !effect.correct && answered) {
            announce(checkOutcomeLine(answered, out.state, false, copy), false);
          }
        } else if (effect.type === 'resolved') {
          tally.current = tallyResolved(tally.current, effect);
          const item = playerView.items[previous.index];
          if (item) {
            void track({
              name: 'story.check.answered',
              profileId: profileId ?? undefined,
              payload: checkAnsweredPayload(idsRef.current, item, effect),
            });
          }
        } else if (effect.type === 'finish') {
          finish();
        }
      }
      if (out.state.index !== previous.index) {
        resetForScene();
        setRevealed(false);
      } else if (out.state.phase === 'recap' && previous.phase !== 'recap') {
        // The recap keeps the index: cut the last item's voice (explanation, a speaker play) so it does
        // not run under the recap heading. The prompt slot stays, so its "Say it yourself" state does too.
        stopAudio();
      }
    },
    [playerView, answerRound, copy, profileId, finish, resetForScene, stopAudio],
  );

  // Close is the route's ScreenHeader (wireframe check.md A; AMENDMENTS-DISPLAY-NAV section 7.1): back to the quest step,
  // scored answers stay scored. On the recap every item is answered and nothing is scored, so a back there ends the
  // step like Done (no replay of the items): the header's Close, the browser and the phone back alike.
  useRouteBackGuard(() => {
    if (stateRef.current.phase !== 'recap') return false;
    void Promise.resolve().then(() => dispatch({ type: 'finishRecap' }));
    return true;
  });

  // Focus follows the resolved item to Next (web: the DOM focus; native: the screen reader's focus),
  // then native hears "Correct" with the explanation (iOS has no live regions).
  const resolvedKey = state.phase === 'explained' ? state.index : -1;
  const resolvedLine = useRef<string | null>(null);
  const resolvedItem = items[resolvedKey];
  resolvedLine.current = resolvedItem ? checkOutcomeLine(resolvedItem, state, true, copy) : null;
  useEffect(() => {
    if (resolvedKey < 0) return;
    focusForScreenReader(nextRef.current);
    if (Platform.OS !== 'web' && resolvedLine.current !== null) announce(resolvedLine.current, true);
  }, [resolvedKey]);

  // Read to me: the prompt (and its Korean) is read when an item opens; options only on request.
  const item = items[state.index];
  const speech = useMemo(
    () => (item ? checkSpeech(item, sourceItems[state.index], uiSpeechLang(locale)) : null),
    [item, sourceItems, state.index, locale],
  );
  const autoplay = useRef({ readToMe, speech, play: playAudio });
  autoplay.current = { readToMe, speech, play: playAudio };
  // Each item is read once: when it opens, or on the first gesture that unlocks audio (web cold open).
  const autoplayed = useRef(-1);
  useEffect(() => {
    const { readToMe: on, speech: s, play } = autoplay.current;
    if (!on || !audio.unlocked || !s || autoplayed.current === state.index) return;
    if (stateRef.current.phase !== 'answering') return;
    autoplayed.current = state.index;
    play(s.question);
  }, [state.index, audio.unlocked]);

  useEffect(() => () => stopAudio(), [stopAudio]);

  // `audio.fallback_shown` (source 'story-check') only for the fallback drawn here: the chip (spec §3.4).
  const inRecap = state.phase === 'recap' || state.phase === 'done';
  const sayItNow =
    item !== undefined &&
    sayItYourselfShown({
      canPlayKorean: audio.canPlayKorean,
      reason: audio.slot.view.reason,
      // Every recap word is Korean.
      hasKorean: inRecap ? words.length > 0 : checkHasKorean(item),
    });
  useEffect(() => {
    const reason = checkFallbackReason(sayItNow);
    if (reason !== null) noteFallbackShown(STORY_CHECK_AUDIO_SOURCE, reason);
  }, [sayItNow]);

  const total = items.length;
  if (total === 0 || !item || !speech) {
    return (
      <Screen tone="canvas" scrollable>
        <Body testID="story-check-empty">{copy.emptyLine}</Body>
        <Spacer size="lg" />
        <Button label={copy.continue.cta} tone="primary" size="lg" fullWidth onPress={finish} testID="story-check-continue" />
      </Screen>
    );
  }

  const ctx = { romanizationMode, revealed };
  const progress = checkProgress(state, total);
  const target = targetView(item, state, ctx);
  const bubble = checkBubble(item, state, copy);
  const columns = checkOptionColumns(item);
  const resolved = state.phase !== 'answering';
  const sayIt = sayItNow;
  const cell = checkOptionCell(columns);

  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget.min }}>
        {/* The bar carries no value a screen reader can say; the labelled position does (§3.10). */}
        <View style={{ flex: 1 }} {...a11yHidden}>
          <Progress
            value={progress.value}
            max={total}
            tone="primary"
            testID="story-check-progress"
          />
        </View>
        <View
          accessible
          accessibilityLabel={copy.positionLabel(progress.position, total)}
          aria-label={copy.positionLabel(progress.position, total)}
          role="group"
          testID="story-check-position-group"
        >
          <View {...a11yHidden}>
            <Pill label={copy.position.pill(progress.position, total)} size="sm" testID="story-check-position" />
          </View>
        </View>
      </View>

      {inRecap ? (
        <>
          <Spacer size="lg" />
          <StoryWordRecap
            words={words}
            storyId={scope.story?.storyId ?? ''}
            profileId={profileId ?? undefined}
            sayIt={sayIt}
            play={playAudio}
            onDone={() => dispatch({ type: 'finishRecap' })}
          />
        </>
      ) : (
        <>
          <Spacer size="lg" />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Heading level="prompt" testID="story-check-prompt">
                {item.promptParts.map((part, i) =>
                  'target' in part ? (
                    <Text {...KOREAN_LINE_BREAK} key={i} {...koreanSpeech} style={{ fontWeight: typography.weight.bold }}>
                      {part.target.ko}
                    </Text>
                  ) : (
                    part.text
                  ),
                )}
              </Heading>
            </View>
            <SpeakerButton
              label={copy.speakerPrompt}
              onPress={() => playAudio([...speech.question, ...speech.options])}
              testID="story-check-speaker"
            />
          </View>

          {target ? (
            <>
              <Spacer size="md" />
              <View style={{ alignSelf: 'flex-start' }}>
                <KoreanText
                  ko={target.ko}
                  romanization={target.romanization}
                  gloss={target.gloss}
                  size="md"
                  // Without a Korean voice the speaker gives way to the "Say it yourself" chip (F-AUDIO-004 §3.8).
                  onPress={!sayIt && speech.target ? () => playAudio(speech.target ? [speech.target] : []) : undefined}
                  // As the speaker it says that a tap plays the word; as plain text, "ko, romanization" (the default).
                  accessibilityLabel={!sayIt && speech.target ? targetAccessibilityLabel(target, copy) : undefined}
                  testID="story-check-target"
                />
              </View>
            </>
          ) : null}

          {sayIt || revealNeeded(item, state, ctx) ? (
            <>
              <Spacer size="sm" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
                {sayIt ? <Pill label={m.learner.story.reader.sayItYourself.pill} tone="info" testID="story-check-say-it" /> : null}
                {revealNeeded(item, state, ctx) ? (
                  <Button
                    label={copy.showRomanization.cta}
                    tone="ghost"
                    size="md"
                    onPress={() => setRevealed(true)}
                    testID="story-check-reveal"
                  />
                ) : null}
              </View>
            </>
          ) : null}

          <Spacer size="lg" />
          <View testID="story-check-options" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {item.options.map((option) => {
              const card = optionCardView(item, option, state, { ...ctx, copy });
              const art =
                card.art !== undefined && supportedCardIds.includes(card.art) ? (
                  <PictureArt pictureRef={card.art} gloss={card.label ?? ''} size={pictureSize} />
                ) : undefined;
              return (
                <View
                  key={option.id}
                  style={{ ...cell, minWidth: touchTarget.hero, gap: spacing.xs }}
                >
                  <ChoiceCard
                    testID={`story-check-option-${option.id}`}
                    state={card.state}
                    label={card.label}
                    ko={card.ko}
                    romanization={card.romanization}
                    gloss={card.gloss}
                    art={art}
                    accessibilityLabel={card.accessibilityLabel}
                    onPress={() => dispatch({ type: 'choose', optionId: option.id })}
                  />
                  {card.status ? (
                    // The visible non-colour cue; the card's accessible name already ends with these words.
                    <View {...a11yHidden}>
                      <Body size="sm" weight="semibold" testID={`story-check-status-${option.id}`}>
                        {card.status === 'correct' ? copy.correct : copy.tryAnother}
                      </Body>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>

          {/* A live region on the web only: native announces the outcome line itself (one announcement, no overlap). */}
          <View accessibilityLiveRegion={Platform.OS === 'web' ? 'polite' : 'none'}>
            {bubble ? (
              <>
                <Spacer size="lg" />
                <HoyaBubble tone={bubble.tone} message={bubble.message} />
              </>
            ) : null}
          </View>

          {resolved ? (
            <>
              <Spacer size="xl" />
              <View>
                <Button
                  pressableRef={nextRef}
                  label={copy.next.cta}
                  tone="primary"
                  size="hero"
                  fullWidth
                  onPress={() => dispatch({ type: 'next' })}
                  testID="story-check-next"
                />
              </View>
            </>
          ) : null}
        </>
      )}
      <Spacer size="xl" />
    </Screen>
  );
}
