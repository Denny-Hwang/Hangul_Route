import { composeTyped } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  ChoiceCard,
  HangulKeyboard,
  Heading,
  HoyaBubble,
  Icon,
  KoreanText,
  Spacer,
  borderWidth,
  colors,
  keyboardWidth,
  motion,
  radii,
  spacing,
  touchTarget,
  useLayoutClass,
  useMediaSize,
  type ChoiceCardState,
} from '@hangul-route/design-system';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Pressable, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import type { RoundAnswer } from '../../logic/reviews/daily-review';
import type { TypedGrade } from '../../logic/reviews/engine';
import type { BuildRound, ClozeRound, OrderRound, PickOption, PickRound, ReviewRound, ShapeRound, TypeRound } from '../../logic/reviews/review-rounds';
import { keySound } from '../../logic/type-hangul/sounds';
import { playPrompt, stop } from '../../platform/audio';
import { nudge, success } from '../../platform/haptics';
import { PictureArt } from '../minigames/PictureArt';
import type { HearRound } from '../minigames/dictation-chunk';
import { useDictationKit, type DictationKit } from '../minigames/dictation-entry';
import { useSyllableBuildChunk } from '../minigames/syllable-build-entry';
import { useMatchShapeChunk } from '../minigames/match-shape-entry';

/**
 * The rounds of the Daily Review and Keep going (F-CURR-002 sections 4.3 and 4.5, row CM-14; design
 * design/wireframes/reviews/daily-review.md panels B and B2, design/screens/daily-review/). Each round is one of the
 * shipped ways of asking, drawn from the review item: Listen and pick, a read pick, Type Hangul and Sentence Builder,
 * with their own instructions, sound lines and Hoya lines, and Cloze Pick while `game.cloze-pick` is on (row CM-30).
 * Reading, listening and writing only.
 *
 * - The first answer of a round is the scored one (`onFirst`); later taps are retries and never counted.
 * - A miss is never red: the tapped option takes the amber nudge with its mark, Hoya shows the right answer with its
 *   romanization and meaning, the right option is outlined, and the round stays open until it is tapped.
 * - No timer anywhere; the next round follows the right answer after `motion.duration.slow` (no Next button), or at
 *   once with reduced motion.
 */

export interface RoundProps<R extends ReviewRound> {
  round: R;
  /** The first answer of the round. */
  onFirst: (answer: RoundAnswer) => void;
  /** The round is over: on to the next. */
  onSolved: () => void;
  reducedMotion: boolean;
  /**
   * The engine's typing tolerance (`gradeTyped`), handed in from the memory chunk: this chunk imports no scheduler
   * module, so none is shared by two chunks.
   */
  grade: (target: string, typed: string) => TypedGrade;
}

/** The pause on the check mark before the next round. */
const pauseMs = (reduced: boolean): number => (reduced ? 0 : motion.duration.slow);

/** Two options to a row at every width up to 4 across on a wide window (the design's 2 x 2). */
const OPTION_MIN = 2 * touchTarget.min + spacing.xl;

function useAdvance(onSolved: () => void, reduced: boolean): () => void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(() => {
    if (timer.current !== null) return;
    timer.current = setTimeout(onSolved, pauseMs(reduced));
  }, [onSolved, reduced]);
}

/** The sound of a round, through the shared prompt slot (F-AUDIO-004 §3.8): text with why and one action when it cannot play. */
function useRoundSound(text: string | null, heard: boolean) {
  const slot = usePromptSlot({ source: 'daily-review', textOnScreen: !heard });
  const { play, reset } = slot;
  const hear = useCallback(() => {
    if (text === null) return;
    void play(() => playPrompt({ text, kind: text.includes(' ') ? 'sentence' : 'word', source: 'daily-review' }));
  }, [play, text]);
  useEffect(() => {
    reset();
    if (heard) hear();
    return () => stop();
  }, [heard, hear, reset]);
  return { slot, hear };
}

// ---- pick ------------------------------------------------------------------------------------------------

function optionLabel(o: PickOption, showRomanization: boolean): string {
  if (o.ko) return showRomanization ? `${o.ko.ko}, ${o.ko.romanization}` : o.ko.ko;
  return o.label ?? '';
}

export function PickRoundView({ round, onFirst, onSolved, reducedMotion }: RoundProps<PickRound>): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const [wrong, setWrong] = useState<readonly string[]>([]);
  const [solved, setSolved] = useState(false);
  const answered = useRef(false);
  const advance = useAdvance(onSolved, reducedMotion);
  const pictureSize = useMediaSize(touchTarget.hero);
  const lc = useLayoutClass();
  const { slot, hear } = useRoundSound(round.heard ? round.prompt.ko : null, round.heard);
  const showOptionRomanization = round.ask !== 'sound';
  const tiles = round.options.every((o) => o.picture !== undefined);

  const heading =
    round.ask === 'spelling' ? copy.listenPick.heading : round.ask === 'reply' ? copy.tapRespond.heading : round.ask === 'sound' ? m.learner.audio.heading.text : copy.cultureQuiz.heading;

  const tap = (option: PickOption): void => {
    if (solved) return;
    const right = option.id === round.answerId;
    if (!answered.current) {
      answered.current = true;
      onFirst({ correct: right });
    }
    if (right) {
      success();
      setSolved(true);
      advance();
    } else if (!wrong.includes(option.id)) {
      nudge();
      setWrong([...wrong, option.id]);
    }
  };

  const stateOf = (option: PickOption): ChoiceCardState => {
    if (option.id === round.answerId) return solved ? 'correct' : wrong.length > 0 ? 'hint' : 'idle';
    return wrong.includes(option.id) ? 'wrong' : solved ? 'disabled' : 'idle';
  };

  return (
    <View testID="daily-review-round" style={{ gap: spacing.md }}>
      <Heading level="prompt">{heading}</Heading>
      {round.heard ? (
        <View style={{ alignItems: 'flex-start', gap: spacing.sm }}>
          <Button
            label={copy.listenPick.hearAgain.cta}
            tone="secondary"
            size="md"
            leading={<Icon name="speaker" size={spacing.lg} color={colors.brand.secondaryDark} />}
            accessibilityLabel={slot.view.reason === 'muted' || slot.view.reason === 'blocked' ? slot.view.speakerLabel : m.a11y.minigame.hearAgain}
            onPress={hear}
            testID="daily-review-hear-again"
          />
          <PromptPanel view={slot.view} onAction={(action) => slot.act(action, hear)} ko={round.prompt.ko} romanization={round.prompt.romanization} testID="daily-review-prompt-panel" />
          {round.cue?.picture ? <PictureArt pictureRef={round.cue.picture} gloss={round.answer.gloss ?? ''} size={pictureSize} /> : null}
          {round.cue?.gloss ? <Body weight="semibold">{round.cue.gloss}</Body> : null}
        </View>
      ) : round.ask === 'sound' ? (
        <View style={{ alignItems: 'center' }}>
          <Heading level="display" align="center" testID="daily-review-sound">
            {round.prompt.romanization}
          </Heading>
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <KoreanText ko={round.prompt.ko} romanization={round.prompt.romanization} size="lg" testID="daily-review-prompt" />
        </View>
      )}
      {round.question.voiceFallback ? <PromptPanel view={slot.view} onAction={(action) => slot.act(action, hear)} testID="daily-review-sound-notice" /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {round.options.map((option) => (
          <View key={option.id} style={{ flexGrow: 1, flexBasis: lc.width === 'compact' ? '45%' : OPTION_MIN, minWidth: 0 }}>
            <ChoiceCard
              layout={tiles ? 'tile' : 'row'}
              state={stateOf(option)}
              {...(option.ko ? { ko: option.ko.ko, romanization: showOptionRomanization ? option.ko.romanization : '' } : { label: option.label })}
              art={option.picture ? <PictureArt pictureRef={option.picture} gloss={option.label ?? ''} size={pictureSize} decorative /> : null}
              onPress={() => tap(option)}
              accessibilityLabel={optionLabel(option, showOptionRomanization)}
              testID={`daily-review-option-${option.id}`}
            />
          </View>
        ))}
      </View>
      {wrong.length > 0 && !solved ? <MissLine round={round} heard={round.heard} /> : null}
    </View>
  );
}

/** Hoya after a miss: the round's own line, then the right answer as taught content (Korean and romanization; its option is outlined). */
function MissLine({ round, heard }: { round: ReviewRound; heard: boolean }): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const line = heard ? copy.listenPick.missHoya : round.type === 'order' ? copy.sentenceBuilder.miss : copy.realia.missHoya;
  return (
    <View accessibilityLiveRegion="polite" testID="daily-review-miss">
      <HoyaBubble tone="thinking" message={line} korean={round.answer.ko.ko} romanization={round.answer.ko.romanization} />
    </View>
  );
}

// ---- type ------------------------------------------------------------------------------------------------

/**
 * A type round. Dictation (`hear`, F-CURR-002 row CM-31) plays from the dictation chunk, loaded through its entry so
 * this chunk shares no module with it; while it loads the round waits, and if it cannot load the word is typed as a
 * `see` round. The review was opened with a tap, so a heard word plays when its round opens.
 */
export function TypeRoundView(props: RoundProps<TypeRound>): ReactElement {
  if (props.round.mode === 'hear') return <HearTypeRoundView {...props} />;
  return <TypeRoundBody {...props} kit={null} heard={null} />;
}

function HearTypeRoundView(props: RoundProps<TypeRound>): ReactElement {
  const kit = useDictationKit(true);
  if (kit === null) return <RoundWaiting />;
  if (kit === 'failed') return <TypeRoundBody {...props} round={{ ...props.round, mode: 'see' }} kit={null} heard={null} />;
  return <HeardTypeRound key={props.round.question.itemId} {...props} kit={kit} />;
}

/** Shown after this long while the dictation chunk loads, so a load from the precache never flashes a line. */
export const ROUND_WAITING_LINE_MS = 500;

/** A Dictation round while its chunk loads: the quest steps' calm status line (LessonWaiting), late and polite. */
export function RoundWaiting(): ReactElement {
  const m = useMessages();
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), ROUND_WAITING_LINE_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <View testID="daily-review-round" accessibilityLiveRegion="polite">
      {late ? (
        <Body tone="secondary" align="center" testID="daily-review-round-waiting">
          {m.learner.presenter.state.loading}
        </Body>
      ) : null}
    </View>
  );
}

function HeardTypeRound({ kit, ...props }: RoundProps<TypeRound> & { kit: DictationKit }): ReactElement {
  const { round } = props;
  const heard = kit.useHearRound({ mode: 'hear', target: { ko: round.target, romanization: round.answer.ko.romanization, en: round.answer.gloss ?? '' } }, 1);
  return <TypeRoundBody {...props} kit={kit} heard={heard} />;
}

function TypeRoundBody({
  round,
  onFirst,
  onSolved,
  reducedMotion,
  grade: gradeOf,
  kit,
  heard,
}: RoundProps<TypeRound> & { kit: DictationKit | null; heard: HearRound | null }): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const t = copy.typeHangul;
  const k = m.a11y.minigame.keyboard;
  const lc = useLayoutClass();
  const [available, setAvailable] = useState(lc.windowWidth);
  const kbWidth = keyboardWidth(lc, available || lc.windowWidth);
  const pictureSize = useMediaSize(touchTarget.hero);
  const [keys, setKeys] = useState<readonly string[]>([]);
  const [verdict, setVerdict] = useState<'typing' | 'right' | 'near' | 'far'>('typing');
  const answered = useRef(false);
  const advance = useAdvance(onSolved, reducedMotion);
  const typed = useMemo(() => composeTyped(keys), [keys]);

  // Dictation: heard while the chunk says so (holding, then hear); a `see` round of the word once it is not.
  const hearing = kit !== null && heard !== null && heard.mode !== 'see';
  const holding = hearing && heard.mode === 'hold';
  const done = (): void => {
    if (typed.trim() === '' || verdict === 'right' || verdict === 'near' || holding) return;
    const grade = gradeOf(round.target, typed);
    if (!answered.current) {
      answered.current = true;
      // A right answer after "Show how it sounds" is a hinted one too (section 4.3).
      const hinted = grade === 'hinted' || (grade === 'right' && heard !== null && heard.revealed);
      onFirst({ correct: grade !== 'miss', ...(hinted ? { hinted: true } : {}) });
    }
    if (grade === 'right') {
      success();
      setVerdict('right');
      advance();
    } else if (grade === 'hinted') {
      // A one-letter slip: amber "almost", the right form shown; it counts as hinted and the round moves on with Next.
      nudge();
      setVerdict('near');
    } else {
      nudge();
      setVerdict('far');
      setKeys([]);
    }
  };

  return (
    <View testID="daily-review-round" style={{ gap: spacing.md }} onLayout={(e) => setAvailable(e.nativeEvent.layout.width)}>
      <Heading level="prompt">{hearing ? t.heading.hear : round.mode === 'picture' ? t.heading.picture : t.heading.see}</Heading>
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        {hearing && kit !== null && heard !== null ? (
          verdict === 'right' ? (
            // The word is drawn only after the answer, with its romanization and meaning.
            <KoreanText ko={round.target} romanization={round.answer.ko.romanization} gloss={round.answer.gloss} size="lg" testID="daily-review-type-target" />
          ) : (
            <kit.HearPrompt hear={heard} round={{ target: { ko: round.target, romanization: round.answer.ko.romanization, en: round.answer.gloss ?? '' } }} compact={false} first={false} testID="daily-review-dictation" />
          )
        ) : round.mode === 'picture' && round.picture ? (
          <PictureArt pictureRef={round.picture} gloss={round.answer.gloss ?? ''} size={pictureSize} />
        ) : (
          <KoreanText ko={round.target} romanization={round.answer.ko.romanization} gloss={round.answer.gloss} size="lg" testID="daily-review-type-target" />
        )}
        {kit !== null && heard !== null && heard.mode === 'see' ? <kit.SeeNotice hear={heard} testID="daily-review-dictation-notice" /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          accessibilityLabel={typed === '' ? (hearing ? t.heading.hear : t.heading.see) : `${t.typedLabel}: ${typed}`}
          style={{
            flex: 1,
            minHeight: touchTarget.min,
            justifyContent: 'center',
            paddingHorizontal: spacing.md,
            borderRadius: radii.md,
            borderWidth: verdict === 'near' || verdict === 'far' ? borderWidth.thick : borderWidth.base,
            borderColor: verdict === 'near' || verdict === 'far' ? colors.feedback.nudge : verdict === 'right' ? colors.feedback.success : colors.border.strong,
            backgroundColor: verdict === 'near' || verdict === 'far' ? colors.feedback.nudgeLight : colors.surface.paper,
          }}
          testID="daily-review-typed"
        >
          <Body size="lg">{typed}</Body>
        </View>
        {verdict === 'near' ? (
          <Button label={m.common.buttons.next} tone="primary" size="md" onPress={onSolved} testID="daily-review-type-next" />
        ) : (
          <Button label={copy.trace.done.cta} tone="primary" size="md" disabled={typed.trim() === '' || verdict === 'right' || holding} onPress={done} testID="daily-review-type-done" />
        )}
      </View>
      {verdict === 'near' || verdict === 'far' ? (
        <View accessibilityLiveRegion="polite" testID="daily-review-miss">
          <HoyaBubble tone="thinking" message={verdict === 'near' ? t.near : t.far} korean={round.answer.ko.ko} romanization={round.answer.ko.romanization} />
        </View>
      ) : null}
      {verdict === 'typing' || verdict === 'far' ? (
        <HangulKeyboard
          testID="hangul-key"
          width={kbWidth}
          layoutClass={lc}
          soundOf={keySound}
          labels={{ key: k.key, shift: k.shift, delete: k.delete, space: k.space }}
          // After a far miss the field starts empty (`done` clears it) and every key builds on the ones before, as in
          // a first try: the round stays open until the right answer, with Hoya's bubble keeping it in view.
          onKey={(jamo) => (holding ? undefined : setKeys((prev) => [...prev, jamo]))}
          onDelete={() => (holding ? undefined : setKeys((prev) => prev.slice(0, -1)))}
          onSpace={() => (holding ? undefined : setKeys((prev) => [...prev, ' ']))}
        />
      ) : null}
      {verdict === 'far' ? <Caption tone="muted">{t.targetLabel}</Caption> : null}
    </View>
  );
}

// ---- order -----------------------------------------------------------------------------------------------

export function OrderRoundView({ round, onFirst, onSolved, reducedMotion }: RoundProps<OrderRound>): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame.sentenceBuilder;
  const [placed, setPlaced] = useState<readonly string[]>([]);
  const [missKey, setMissKey] = useState<string | null>(null);
  const missed = useRef(false);
  const advance = useAdvance(onSolved, reducedMotion);
  const done = placed.length === round.words.length;

  const tap = (key: string, ko: string): void => {
    if (done || placed.includes(key)) return;
    if (ko === round.words[placed.length]) {
      const next = [...placed, key];
      setPlaced(next);
      setMissKey(null);
      if (next.length === round.words.length) {
        if (!missed.current) onFirst({ correct: true });
        success();
        advance();
      }
    } else {
      if (!missed.current) {
        missed.current = true;
        onFirst({ correct: false });
      }
      nudge();
      setMissKey(key);
    }
  };

  const built = placed.map((key) => round.tiles.find((t) => t.key === key)?.ko ?? '').join(' ');
  return (
    <View testID="daily-review-round" style={{ gap: spacing.md }}>
      <Heading level="prompt">{copy.heading}</Heading>
      <Body tone="secondary">{copy.instruction}</Body>
      {round.line ? <KoreanText ko={round.line.ko} romanization={round.line.romanization} size="md" testID="daily-review-line" /> : null}
      {round.meaning ? (
        <View>
          <Caption tone="muted">{copy.meaning}</Caption>
          <Body weight="semibold">{round.meaning}</Body>
        </View>
      ) : null}
      <View
        style={{ minHeight: touchTarget.min, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radii.md, borderWidth: borderWidth.base, borderColor: done ? colors.feedback.success : colors.border.strong, backgroundColor: colors.surface.paper }}
        testID="daily-review-built"
      >
        {done ? <KoreanText ko={round.answer.ko.ko} romanization={round.answer.ko.romanization} size="md" /> : <Body size="lg">{built}</Body>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {round.tiles.map((tile) => {
          const used = placed.includes(tile.key);
          const miss = missKey === tile.key;
          return (
            <Pressable
              key={tile.key}
              disabled={used || done}
              onPress={() => tap(tile.key, tile.ko)}
              accessibilityRole="button"
              accessibilityLabel={tile.ko}
              accessibilityState={{ disabled: used || done }}
              testID={`daily-review-tile-${tile.key}`}
              style={{
                minWidth: touchTarget.min,
                minHeight: touchTarget.min,
                paddingHorizontal: spacing.md,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: radii.md,
                borderWidth: miss ? borderWidth.thick : borderWidth.base,
                borderColor: miss ? colors.feedback.nudge : colors.border.strong,
                backgroundColor: used ? colors.surface.sunken : miss ? colors.feedback.nudgeLight : colors.surface.paper,
              }}
            >
              <Body size="lg" weight="semibold" tone={used ? 'muted' : 'primary'}>
                {tile.ko}
              </Body>
            </Pressable>
          );
        })}
      </View>
      {missKey !== null && !done ? (
        <View accessibilityLiveRegion="polite" testID="daily-review-miss">
          <HoyaBubble tone="thinking" message={copy.miss} />
        </View>
      ) : null}
      <Spacer size="xs" />
    </View>
  );
}

// ---- cloze -----------------------------------------------------------------------------------------------

/**
 * Cloze Pick in a review (row CM-30): the sentence with its gap, its romanization and its meaning; word tiles in
 * Korean and romanization only. Nothing is said before the answer (it would answer the round); the right tile
 * completes the sentence, which is said once. A miss nudges in amber, rings the tile that fits and shows Hoya's line.
 */
/** The sentence in the card's label: its gap read as a word, no closing mark (the label adds its own). */
const clozeLabel = (text: string, blank: string): string => text.split('___').join(blank).replace(/[.?!]+$/, '');

export function ClozeRoundView({ round, onFirst, onSolved, reducedMotion }: RoundProps<ClozeRound>): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const a11y = m.a11y.minigame.clozePick;
  const [wrong, setWrong] = useState<readonly string[]>([]);
  const [solved, setSolved] = useState(false);
  const answered = useRef(false);
  const advance = useAdvance(onSolved, reducedMotion);
  const lc = useLayoutClass();
  const { slot, hear } = useRoundSound(solved ? round.answer.ko.ko : null, solved);

  const tap = (option: PickOption): void => {
    if (solved) return;
    const right = option.id === round.answerId;
    if (!answered.current) {
      answered.current = true;
      onFirst({ correct: right });
    }
    if (right) {
      success();
      setSolved(true);
      advance();
    } else if (!wrong.includes(option.id)) {
      nudge();
      setWrong([...wrong, option.id]);
    }
  };
  const stateOf = (option: PickOption): ChoiceCardState => {
    if (option.id === round.answerId) return solved ? 'correct' : wrong.length > 0 ? 'hint' : 'idle';
    return wrong.includes(option.id) ? 'wrong' : solved ? 'disabled' : 'idle';
  };
  const shown = solved ? round.answer.ko : round.gapped;
  const meaning = round.meaning ?? '';
  const label = solved ? a11y.sentenceDone(clozeLabel(round.answer.ko.romanization, a11y.blank), meaning) : a11y.sentence(clozeLabel(round.gapped.romanization, a11y.blank), meaning);

  return (
    <View testID="daily-review-round" style={{ gap: spacing.md }}>
      <Heading level="prompt">{copy.clozePick.heading}</Heading>
      <View accessible accessibilityLabel={label} style={{ alignItems: 'center' }} testID="daily-review-cloze-sentence">
        <KoreanText ko={shown.ko} romanization={shown.romanization} gloss={round.meaning} size="lg" testID="daily-review-prompt" />
      </View>
      {solved ? <PromptPanel variant="status" view={slot.view} onAction={(action) => slot.act(action, hear)} testID="daily-review-sound-notice" /> : null}
      <Body tone="secondary">{copy.clozePick.instruction.word}</Body>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {round.tiles.map((option) => (
          <View key={option.id} style={{ flexGrow: 1, flexBasis: lc.width === 'compact' ? '100%' : OPTION_MIN, minWidth: 0 }}>
            <ChoiceCard
              layout="row"
              state={stateOf(option)}
              ko={option.ko?.ko ?? ''}
              romanization={option.ko?.romanization ?? ''}
              onPress={() => tap(option)}
              accessibilityLabel={optionLabel(option, true)}
              testID={`daily-review-option-${option.id}`}
            />
          </View>
        ))}
      </View>
      {wrong.length > 0 && !solved ? (
        <View accessibilityLiveRegion="polite" testID="daily-review-miss">
          <HoyaBubble tone="thinking" message={copy.clozePick.miss} />
        </View>
      ) : null}
    </View>
  );
}

// ---- build (row CM-32) -------------------------------------------------------------------------------------

/**
 * Syllable Build at the produce rung: its board is the Syllable Build chunk's, loaded here at run time through the
 * entry's `syllableBuildChunk()` (a chunk never imports a module of another chunk). The engine asks it only while
 * `game.syllable-build` is on. While the chunk loads (it is precached, so a frame or two) the round shows its heading.
 * The session has already chosen this round, so a chunk that fails to load (a stale cache, a dropped asset) shows
 * Hoya's oops line and Try again rather than leaving the round on its heading.
 */
export function BuildRoundLoader({ round, onFirst, onSolved }: RoundProps<BuildRound>): ReactElement {
  const m = useMessages();
  const { chunk, failed, retry } = useSyllableBuildChunk();
  if (chunk === null) {
    const heading = <Heading level="prompt">{m.learner.minigame.syllableBuild.heading}</Heading>;
    if (!failed) return heading;
    return (
      <View>
        {heading}
        <Spacer size="sm" />
        <HoyaBubble tone="thinking" message={m.learner.oops.bubble} />
        <Spacer size="sm" />
        <Button label={m.common.buttons.tryAgain} tone="primary" size="md" onPress={retry} testID="daily-review-build-retry" />
      </View>
    );
  }
  return <chunk.BuildRoundView round={round} onFirst={onFirst} onSolved={onSolved} />;
}
// ---- shape (row CM-33) -------------------------------------------------------------------------------------

/**
 * Match Shape at the produce rung: its board is the Match Shape chunk's, loaded here at run time through the entry's
 * `matchShapeChunk()`. The engine asks it only while `game.match-shape` is on. If the chunk cannot load, the round keeps
 * a way on: Try again loads it again (the session's close button stays in the top row), never a bare heading.
 */
export function ShapeRoundLoader({ round, onFirst, onSolved }: RoundProps<ShapeRound>): ReactElement {
  const m = useMessages();
  const { chunk, failed, retry } = useMatchShapeChunk();
  if (chunk === null) {
    return (
      <View>
        <Heading level="prompt">{m.learner.minigame.matchShape.heading.pair}</Heading>
        {failed ? (
          <>
            <Spacer size="lg" />
            <Button label={m.common.buttons.tryAgain} tone="primary" size="lg" fullWidth onPress={retry} testID="daily-review-shape-retry" />
          </>
        ) : null}
      </View>
    );
  }
  return <chunk.ShapeRoundView round={round} onFirst={onFirst} onSolved={onSolved} />;
}

/** The round for its type. */
export function RoundView(props: RoundProps<ReviewRound>): ReactElement {
  const { round } = props;
  if (round.type === 'pick') return <PickRoundView {...props} round={round} />;
  if (round.type === 'type') return <TypeRoundView {...props} round={round} />;
  if (round.type === 'cloze') return <ClozeRoundView {...props} round={round} />;
  if (round.type === 'build') return <BuildRoundLoader {...props} round={round} />;
  if (round.type === 'shape') return <ShapeRoundLoader {...props} round={round} />;
  return <OrderRoundView {...props} round={round} />;
}
