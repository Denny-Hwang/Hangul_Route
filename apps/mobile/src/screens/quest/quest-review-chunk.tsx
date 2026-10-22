import type { UiLocale } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  ChoiceCard,
  Heading,
  Hoya,
  HoyaBubble,
  Icon,
  KoreanText,
  Pill,
  Progress,
  Screen,
  Spacer,
  StarRow,
  borderWidth,
  colors,
  motion,
  radii,
  spacing,
  touchTarget,
  useMediaSize,
  type ChoiceCardState,
} from '@hangul-route/design-system';
import type { Messages } from '@hangul-route/i18n';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { koSpeech, promptKindOf } from '../../logic/audio/ko-speech';
import type { RoundAsked } from '../../logic/memory/asked';
import { questReviewPlanner, recordAnswers } from '../../logic/memory/boot';
import type { MemoryAnswer } from '../../logic/memory/memory-runtime';
import {
  firstTryAnswer,
  reviewCompleteEvent,
  reviewStartEvent,
  sessionEntry,
  tryAgainStars,
  type PickOption,
  type PickRound,
  type QuestReviewKind,
  type QuestReviewPlan,
} from '../../logic/reviews/quest-review-session';
import { resultHeadline } from '../../logic/stage1/review-flow';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { track } from '../../platform/telemetry';
import { useAudioStore } from '../../store/audio-store';
import { useProgressStore } from '../../store/progress-store';
import { PictureArt } from '../minigames/PictureArt';

/**
 * The quest warm-up and Try these again (F-CURR-002 section 4.5, row CM-15): a chunk of its own, loaded by
 * `./quest-reviews.ts` only while `questWarmup` or `missedPractice` is on for the learner, so the start
 * bundle carries none of it. It plans from the memory store and the review engine and draws the sessions.
 *
 * Both sit outside the quest's six steps: the warm-up before the first step (nothing scored, then a soft
 * "Warmed up"), Try these again after the reward step (stars only). Every round is a pick round of a shipped
 * look (the Daily Review round of `design/wireframes/reviews/daily-review.md` B and B2): a first-try miss is
 * the amber nudge with Hoya thinking and the right option shown, and the round stays open until it is tapped.
 * Never on these screens: a percentage, a count, a per-question timer or red.
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const QUEST_REVIEW_CHUNK = 'quest-review-chunk:session';

/** Telemetry surface id of the rounds' sound (F-AUDIO-004 `audio.fallback_shown`). */
const AUDIO_SOURCE = 'quest-review';

// ---- planning (in the memory store's chunk, with the review engine) -------------------------------------------

/** The warm-up of a quest, or null when there is nothing to warm up with (the quest then starts as always). */
export async function planQuestWarmup(input: { profileId: string; episodeId: string; locale: UiLocale }): Promise<QuestReviewPlan | null> {
  const planner = await questReviewPlanner(input.profileId);
  return planner ? planner.warmup(input) : null;
}

/** Try these again for the play just finished, or null when none of its misses can be asked. */
export async function planQuestTryAgain(input: { profileId: string; episodeId: string; missed: readonly RoundAsked[]; locale: UiLocale }): Promise<QuestReviewPlan | null> {
  const planner = await questReviewPlanner(input.profileId);
  return planner ? planner.again(input) : null;
}

// ---- the session --------------------------------------------------------------------------------------------

type QuestMessages = Messages['learner']['quest'];

export interface QuestReviewSessionProps {
  plan: QuestReviewPlan;
  profileId: string;
  /** The warm-up's Continue (the quest's first step), or Try these again's See results. */
  onDone: () => void;
}

/** What the learner did in the session so far: the first tap of each round, and the taps after it. */
interface Played {
  answers: MemoryAnswer[];
  retries: number;
}

/**
 * One session: its rounds, then the warm-up's "Warmed up" or Try these again's stars. The answers are recorded
 * when it ends, finished or left early (each counts, section 4.3); the `reviews[]` entry and `review.complete`
 * only when every round was answered.
 */
export function QuestReviewSession({ plan, profileId, onDone }: QuestReviewSessionProps): React.ReactElement {
  const m = useMessages();
  const q = m.learner.quest;
  const [roundIdx, setRoundIdx] = useState(0);
  const [finished, setFinished] = useState(false);
  const played = useRef<Played>({ answers: [], retries: 0 });
  const recorded = useRef(false);

  useEffect(() => {
    void track(reviewStartEvent(profileId, plan.kind, plan.rounds.length));
  }, [profileId, plan]);

  /** The answers go to the memory store once (credit inside sentences included); a finished session also leaves its entry. */
  const record = useCallback(
    (complete: boolean): void => {
      if (recorded.current) return;
      recorded.current = true;
      const { answers, retries } = played.current;
      const at = new Date();
      // The credit inside sentences is the engine's, in the memory store's chunk (loaded already: it planned this session).
      void questReviewPlanner(profileId).then((planner) => recordAnswers(profileId, planner ? planner.credited(plan, answers) : answers, at));
      if (!complete) return;
      const entry = sessionEntry(plan.kind, plan.ctx.today, answers, at);
      if (entry) useProgressStore.getState().recordReview(profileId, entry);
      void track(reviewCompleteEvent(profileId, plan.kind, answers, retries));
    },
    [plan, profileId],
  );
  // Leaving the screen any other way (a back to the quest's leave sheet, a profile switch) keeps what was answered.
  useEffect(() => () => record(false), [record]);

  const round = plan.rounds[roundIdx];
  const next = useCallback((): void => {
    if (roundIdx + 1 < plan.rounds.length) {
      setRoundIdx(roundIdx + 1);
      return;
    }
    record(true);
    setFinished(true);
  }, [roundIdx, plan.rounds.length, record]);

  const leave = (): void => {
    stop();
    record(false);
    onDone();
  };

  if (finished || !round) return <SessionEnd kind={plan.kind} copy={q} m={m} stars={tryAgainStars(played.current.answers)} onDone={onDone} />;

  const title = plan.kind === 'warmup' ? m.learner.warmUp.pill : m.learner.tryAgain.cta;
  return (
    <Screen tone="canvas" scrollable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          {/* Fill-only dots: how far, never right or wrong; no count, no clock. */}
          <Progress variant="dots" value={roundIdx} max={plan.rounds.length} tone="primary" testID="quest-review-dots" />
        </View>
        <Pill label={title} tone="primary" size="sm" />
      </View>
      <Spacer size="md" />
      {roundIdx === 0 ? <Body tone="secondary">{plan.kind === 'warmup' ? m.learner.warmUp.intro : m.learner.tryAgain.intro}</Body> : null}
      {plan.soundNotice ? (
        <>
          <Spacer size="sm" />
          <Caption tone="secondary" testID="quest-review-sound-notice">
            {m.learner.placement.options.limited}
          </Caption>
        </>
      ) : null}
      <Spacer size="lg" />
      <PickRoundView
        key={round.key}
        round={round}
        onFirstTap={(optionId) => played.current.answers.push(firstTryAnswer(round, optionId))}
        onRetry={() => {
          played.current.retries += 1;
        }}
        onDone={next}
      />
      <Spacer size="xl" />
      <Button
        label={plan.kind === 'warmup' ? m.learner.warmUp.skip.cta : q.seeResults.cta}
        tone="ghost"
        size="md"
        onPress={leave}
        testID="quest-review-leave"
      />
      <Spacer size="lg" />
    </Screen>
  );
}

function SessionEnd({ kind, copy, m, stars, onDone }: { kind: QuestReviewKind; copy: QuestMessages; m: Messages; stars: 1 | 2 | 3; onDone: () => void }): React.ReactElement {
  const warm = kind === 'warmup';
  return (
    <Screen tone="canvas" scrollable>
      <View style={{ alignItems: 'center', paddingTop: spacing.xl }} testID={warm ? 'quest-warmup-done' : 'quest-try-again-done'}>
        <Hoya pose="cheering" size={120} accessibilityLabel={m.a11y.hoya('cheering')} />
        <Spacer size="lg" />
        <Heading level="title" align="center">
          {warm ? m.learner.warmUp.done : resultHeadline(stars, m.learner.stageReview.result.headline)}
        </Heading>
        {warm ? null : (
          <>
            <Spacer size="sm" />
            <StarRow stars={stars} size={48} accessibilityLabel={m.a11y.stars(stars)} />
          </>
        )}
      </View>
      <Spacer size="xl" />
      <Button label={warm ? copy.continue.cta : copy.seeResults.cta} tone="primary" size="hero" fullWidth onPress={onDone} testID="quest-review-done" />
      <Spacer size="lg" />
    </Screen>
  );
}

/**
 * The reward step's buttons when the play had first-try misses (F-QUEST-002 L13 as amended): Try these again is
 * the default suggestion, and See results (with Play again on the episode) stays right under it, never required.
 */
export function TryAgainOffer({ onTry, onSeeResults }: { onTry: () => void; onSeeResults: () => void }): React.ReactElement {
  const l = useMessages().learner;
  const q = l.quest;
  return (
    <>
      <Body tone="secondary" align="center">
        {l.tryAgain.intro}
      </Body>
      <Spacer size="md" />
      <Button label={l.tryAgain.cta} tone="primary" size="hero" fullWidth onPress={onTry} testID="quest-try-again" />
      <Spacer size="md" />
      <Button label={q.seeResults.cta} tone="secondary" size="md" fullWidth onPress={onSeeResults} testID="quest-try-again-see-results" />
    </>
  );
}

// ---- one pick round -------------------------------------------------------------------------------------------

interface PickRoundViewProps {
  round: PickRound;
  /** The round's first tap: its answer. */
  onFirstTap: (optionId: string) => void;
  onRetry: () => void;
  /** The right option was tapped and the beat is over. */
  onDone: () => void;
}

/** The instruction line of a round, from the shipped strings of the level check, the games and the lecture quiz. */
function instructionOf(round: PickRound, m: Messages): string {
  const lines = m.learner.placement.instruction;
  switch (round.instruction) {
    case 'hearPick':
      return lines.hearPickWritten;
    case 'hearReply':
      return lines.replyPick;
    case 'seeSound':
      return lines.seePickSound;
    case 'seePicture':
      return lines.readPickPicture;
    case 'seeMeaning':
      return m.learner.minigame.cultureQuiz.heading;
    case 'seeReply':
      return m.learner.presenter.quiz.reply;
  }
}

function PickRoundView({ round, onFirstTap, onRetry, onDone }: PickRoundViewProps): React.ReactElement {
  const m = useMessages();
  const a11y = m.a11y.minigame;
  const romanizationMode = useRomanizationMode();
  const speakerSize = useMediaSize(touchTarget.hero);
  const speakerIcon = useMediaSize(spacing.xxxl);
  const pictureSize = useMediaSize(touchTarget.hero);
  const [wrong, setWrong] = useState<readonly string[]>([]);
  const [right, setRight] = useState(false);
  const answered = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlocked = useAudioStore((s) => s.unlocked);

  const heard = round.mode === 'hear';
  const slot = usePromptSlot({ source: AUDIO_SOURCE });
  const { play: slotPlay } = slot;
  const speech = useMemo(() => koSpeech({ ko: round.ko }, round.instruction === 'hearPick' && round.itemId.startsWith('syl:') ? 'sound' : promptKindOf(round.ko), AUDIO_SOURCE), [round]);
  const hear = useCallback((): void => {
    void slotPlay(() => playPrompt(speech));
  }, [slotPlay, speech]);

  // A heard round plays once by itself when the page may play sound (the first gesture unlocks it on the web).
  const autoplayed = useRef(false);
  useEffect(() => {
    if (!heard || autoplayed.current || !unlocked) return;
    autoplayed.current = true;
    hear();
  }, [heard, unlocked, hear]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const tap = (optionId: string): void => {
    if (right) return;
    if (!answered.current) {
      answered.current = true;
      onFirstTap(optionId);
    } else {
      onRetry();
    }
    if (optionId === round.answerId) {
      tapLight();
      success();
      setRight(true);
      timer.current = setTimeout(onDone, motion.duration.slow);
      return;
    }
    nudge();
    if (!wrong.includes(optionId)) setWrong([...wrong, optionId]);
  };

  const missed = wrong.length > 0;
  const stateOf = (option: PickOption): ChoiceCardState => {
    if (option.id === round.answerId) return right ? 'correct' : missed ? 'hint' : 'idle';
    if (wrong.includes(option.id)) return 'wrong';
    return right ? 'disabled' : 'idle';
  };
  const showRomanization = romanizationMode === 'always' || right || missed;
  const nameOf = (option: PickOption): string => {
    if (option.ko !== undefined) return showRomanization && option.romanization ? `${option.ko}, ${option.romanization}` : option.ko;
    return option.label ?? a11y.picture;
  };
  const announce = (option: PickOption, state: ChoiceCardState): string => {
    const name = nameOf(option);
    return state === 'correct' || state === 'wrong' || state === 'hint' ? a11y.option[state](name) : name;
  };
  const speakerLabel = slot.view.reason === 'muted' || slot.view.reason === 'blocked' ? slot.view.speakerLabel : a11y.hearAgain;

  return (
    <View testID="quest-review-round">
      <Heading level="prompt">{instructionOf(round, m)}</Heading>
      <Spacer size="md" />
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        {heard ? (
          <>
            <Pressable
              testID="quest-review-speaker"
              onPress={hear}
              accessibilityRole="button"
              accessibilityLabel={speakerLabel}
              hitSlop={spacing.md}
              style={{
                width: speakerSize,
                height: speakerSize,
                borderRadius: radii.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.brand.secondaryLight,
                borderColor: colors.brand.secondary,
                borderWidth: borderWidth.base,
              }}
            >
              <Icon name="speaker" size={speakerIcon} color={colors.brand.secondaryDark} />
            </Pressable>
            <Button label={m.learner.minigame.listenPick.hearAgain.cta} tone="secondary" size="md" onPress={hear} testID="quest-review-hear-again" />
            {round.cue?.pictureRef !== undefined ? <PictureArt pictureRef={round.cue.pictureRef} gloss={round.cue.gloss} size={pictureSize} /> : round.cue ? <Body weight="semibold">{round.cue.gloss}</Body> : null}
            {/* The fallback text when the sound is off, missing or failed (F-AUDIO-004 W2-W4), and the answer once it is over. */}
            <View accessibilityLiveRegion="polite" style={{ alignItems: 'center' }}>
              {right || slot.view.textShown ? <KoreanText ko={round.ko} romanization={round.romanization} size="md" testID="quest-review-prompt-text" /> : null}
            </View>
            <View style={{ alignSelf: 'stretch' }}>
              <PromptPanel view={slot.view} onAction={(action) => slot.act(action, hear)} testID="quest-review-prompt" />
            </View>
          </>
        ) : (
          <KoreanText ko={round.ko} romanization={round.showRomanization && showRomanization ? round.romanization : ''} size="lg" testID="quest-review-prompt-text" />
        )}
      </View>
      <Spacer size="lg" />
      <View testID="quest-review-options" style={{ gap: spacing.md }}>
        {round.options.map((option) => {
          const state = stateOf(option);
          return (
            <ChoiceCard
              key={option.id}
              testID={`quest-review-option-${option.id}`}
              state={state}
              ko={option.ko}
              romanization={option.ko !== undefined && showRomanization ? (option.romanization ?? '') : ''}
              label={option.pictureRef === undefined ? option.label : undefined}
              art={option.pictureRef !== undefined ? <PictureArt pictureRef={option.pictureRef} gloss={option.label ?? ''} size={pictureSize} decorative /> : undefined}
              accessibilityLabel={announce(option, state)}
              onPress={() => tap(option.id)}
            />
          );
        })}
      </View>
      <View accessibilityLiveRegion="polite">
        {missed && !right ? (
          <>
            <Spacer size="lg" />
            <HoyaBubble tone="thinking" message={heard ? m.learner.minigame.listenPick.missHoya : m.learner.minigame.picWord.missHoya} />
          </>
        ) : null}
      </View>
    </View>
  );
}
