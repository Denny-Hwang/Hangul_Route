import {
  Body,
  Button,
  ChoiceCard,
  Heading,
  HoyaBubble,
  KoreanText,
  layout,
  Pill,
  Progress,
  Screen,
  Spacer,
  spacing,
  touchTarget,
  useLayoutClass,
  useMediaSize,
  TapBoard,
} from '@hangul-route/design-system';
import { a11yRomanization } from '@hangul-route/content-schema';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Platform, View } from 'react-native';
import { PromptPanel } from '../../components/PromptPanel';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import { usePromptSlot } from '../../components/use-prompt-slot';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import { afterMiss, afterRightAnswer, lookHereLine } from '../../logic/answer-feedback';
import { screenScrollsWithColumns } from '../../logic/layout/game-layout';
import type { MinigameScope } from '../../logic/minigame-config';
import {
  lineHintName,
  lineSpeech,
  keyView,
  lineViews,
  playableRealia,
  realiaArrangement,
  realiaHeaderView,
  realiaHeld,
  realiaKeyLabel,
  realiaOptionColumns,
  realiaOptionItem,
  realiaOptionView,
  realiaStatus,
  sheetKind,
  sheetSummary,
  shuffleRealiaOptions,
  startRealiaRead,
  stepRealiaRead,
  titleView,
  type RealiaReadEffect,
  type RealiaReadEvent,
  type RealiaReadState,
} from '../../logic/realia-read-flow';
import { koSpeech } from '../../logic/audio/ko-speech';
import { holdsRomanization, hostSurface } from '../../logic/locale/check-hold';
import { playPrompt, stop, type PlaySpec } from '../../platform/audio';
import { nudge, success, tapLight } from '../../platform/haptics';
import { AnswerAnnouncer } from './answer-announcer';
import { GameColumns } from './GameColumns';
import type { MinigameHost } from './host';
import { PictureArt } from './PictureArt';
import { RealiaSheetView } from './realia-kinds-entry';
import { useAnswerAnnouncement } from './use-answer-announcement';
import { useRoundNext } from './use-round-next';

/**
 * Realia Read (F-CURR-001 §3.6, row G-2): read a drawn menu, ticket, trail sign or price cards
 * and pick the answer to each question. The behaviour lives in `logic/realia-read-flow.ts`
 * (reducer, effects, view-models); this file renders it and runs the effects. Reading is the
 * skill: nothing here asks the learner to speak. Design: design/wireframes/minigame/realia-read.md,
 * design/screens/minigame-realia-read/.
 *
 * Answer feedback (F-A11Y-001 row AF-4b): each result is said once by the answer announcer (a right option by its
 * romanization and meaning, a miss by what was tapped; the miss that rings the answer's line carries the look-here line,
 * named by romanization), Hoya's line and the look-here line under the options are not live, the advance waits the 1000 ms
 * result floor with a screen reader off, and with one on a right option shows Next (OD-AF9 (b)), the last question
 * included, and the option's sound starts after the line. A reader hears nothing play by itself after a miss.
 */

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** Leave an empty scope (never a dead end). */
  onBack?: () => void;
}

/** D-2 D7: the realia stays in view beside the options. One flag for the Screen and GameColumns. */
const STICKY_PROMPT = true;

export function RealiaReadGame({ scope, host, onBack }: Props): ReactElement {
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const play = useMemo(() => {
    const p = playableRealia(scope);
    return p ? { realia: p.realia, rounds: p.rounds.map((r, i) => shuffleRealiaOptions(r, seed + i)) } : null;
  }, [scope, seed]);

  const m = useMessages();
  const copy = m.learner.minigame;
  const a11y = m.a11y.minigame;
  const romanizationMode = useRomanizationMode();
  const layoutClass = useLayoutClass();
  const pictureSize = useMediaSize(touchTarget.hero);

  const [state, setState] = useState<RealiaReadState>(() => startRealiaRead(play?.rounds.length ?? 0));
  const stateRef = useRef(state);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hostRef = useRef(host);
  hostRef.current = host;
  const playRef = useRef(play);
  playRef.current = play;
  const dispatchRef = useRef<(event: RealiaReadEvent) => void>(() => undefined);
  // F-A11Y-001 AF-4b: each result is said once, by the answer announcer; with a screen reader on a right option shows Next.
  const a = useAnswerAnnouncement();
  const { clear, focusPrompt } = a;
  const nextButton = useRoundNext();
  const mounted = useRef(false);
  /** The question last moved on from: a second Next (or a late wait) for the same question does nothing; its sound is not said after it. */
  const movedFrom = useRef(-1);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The lines and options are printed on screen, so a speaker that cannot sound shows only the status
  // panel (F-AUDIO-004 A-5b): why, with the one action, under the sheet for a line and under the options
  // for an option. A different line or option is a new prompt slot.
  const slot = usePromptSlot({ source: REALIA_AUDIO_SOURCE, textOnScreen: true });
  const { play: slotPlay, reset: slotReset } = slot;
  const [helpOpen, setHelpOpen] = useState(false);
  const [soundAt, setSoundAt] = useState<SoundAt | null>(null);
  const lastSaid = useRef<{ key: string; spec: PlaySpec } | null>(null);
  const say = useCallback(
    (key: string, at: SoundAt, spec: PlaySpec): void => {
      if (lastSaid.current?.key !== key) slotReset();
      lastSaid.current = { key, spec };
      setSoundAt(at);
      void slotPlay(() => playPrompt(spec), spec);
    },
    [slotPlay, slotReset],
  );

  const runEffect = useCallback((effect: RealiaReadEffect): void => {
    const current = playRef.current;
    switch (effect.type) {
      case 'answer': {
        const round = current?.rounds[effect.roundKey];
        hostRef.current.answer(effect.roundKey, effect.correct, round ? { itemId: round.id } : undefined);
        return;
      }
      case 'haptic':
        if (effect.kind === 'success') {
          tapLight();
          success();
        } else if (effect.kind === 'nudge') {
          nudge();
        } else {
          tapLight();
        }
        return;
      case 'play-line': {
        const entry = current?.realia.entries.find((e) => e.id === effect.entryId);
        // The line also shows its romanization (the reducer revealed it); a silent line says why, nothing blocks.
        if (entry) say(`line:${entry.id}`, 'sheet', { ...lineSpeech(entry), kind: 'sentence', source: REALIA_AUDIO_SOURCE });
        return;
      }
      case 'play-option': {
        const option = current?.rounds[stateRef.current.roundIdx]?.options.find((o) => o.id === effect.optionId);
        if (option?.text) say(`option:${option.id}`, 'options', koSpeech(option.text, 'sentence', REALIA_AUDIO_SOURCE));
        return;
      }
      case 'schedule-advance':
        advanceTimer.current = setTimeout(() => dispatchRef.current({ type: 'advance' }), effect.ms);
        return;
      case 'complete':
        hostRef.current.complete();
        return;
    }
  }, [say]);

  /** What a result needs from this render: read when the tap comes, so `dispatch` keeps one identity. */
  const latest = useRef({ a, next: nextButton, a11y: m.a11y, or: m.a11y.romanizationOr });
  latest.current = { a, next: nextButton, a11y: m.a11y, or: m.a11y.romanizationOr };

  /** A tap that scored: the line is said once, and the effects that follow are the answer's own (§3.4). */
  const settle = useCallback(
    (before: RealiaReadState, after: RealiaReadState, tapped: string, effects: RealiaReadEffect[]): void => {
      const current = playRef.current;
      const round = current?.rounds[before.roundIdx];
      const { a: say, next, a11y: texts, or } = latest.current;
      const option = round?.options.find((o) => o.id === tapped);
      const sound = effects.find((e) => e.type === 'play-option');
      const advanceNow = effects.find((e) => e.type === 'schedule-advance');
      const correct = effects.some((e) => e.type === 'answer' && e.correct);
      effects.filter((e) => e !== sound && e !== advanceNow).forEach(runEffect);
      if (!current || !round || !option) return;
      const asked = before.roundIdx;
      if (correct && advanceNow?.type === 'schedule-advance') {
        const speak = (): Promise<void> => say.announce({ kind: 'right', item: realiaOptionItem(option, texts, true) });
        void afterRightAnswer({
          readerOn: say.readerOn,
          gameMinMs: advanceNow.ms,
          announce: say.readerOn ? () => next.afterFocus(speak) : speak,
          ...(sound === undefined
            ? {}
            : {
                play: () => {
                  // A reader on may press Next before the line ends: the question has moved on, so its sound is not said.
                  if (movedFrom.current === asked || !mounted.current) return;
                  runEffect(sound);
                },
              }),
          showNext: next.show,
          waitThenAdvance: (minMs) => runEffect({ type: 'schedule-advance', ms: minMs }),
        });
        return;
      }
      const item = realiaOptionItem(option, texts, false);
      const entry = round.answerEntryId === undefined ? undefined : current.realia.entries.find((e) => e.id === round.answerEntryId);
      // The miss that rings the answer's line carries the look-here line, named without its Hangul.
      const ringed = after.lookHere && !before.lookHere && entry !== undefined;
      afterMiss({
        readerOn: say.readerOn,
        announce: () => say.announce(ringed ? { kind: 'missHint', item, hint: lookHereLine(texts, lineHintName(entry, texts.minigame, or)) } : { kind: 'miss', item }),
      });
    },
    [runEffect],
  );

  const dispatch = useCallback(
    (event: RealiaReadEvent): void => {
      const before = stateRef.current;
      const out = stepRealiaRead(before, event);
      stateRef.current = out.state;
      setState(out.state);
      if (event.type === 'tap' && out.effects.some((e) => e.type === 'answer')) settle(before, out.state, event.optionId, out.effects);
      else out.effects.forEach(runEffect);
    },
    [runEffect, settle],
  );
  dispatchRef.current = dispatch;

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      stop();
    },
    [],
  );

  const round = play?.rounds[state.roundIdx];
  // A new question starts a new prompt slot: the last question's "Tap to hear" does not carry over.
  const roundId = round?.id;
  const roundIdx = state.roundIdx;
  useEffect(() => {
    slotReset();
    lastSaid.current = null;
    setSoundAt(null);
  }, [roundId, slotReset]);
  // A new question empties the announcer and, with a reader on, moves focus to the question's header node (§3.4).
  useEffect(() => {
    clear();
    if (roundIdx > 0) focusPrompt();
  }, [roundIdx, clear, focusPrompt]);
  /** The slot's status panel at one place: quiet (the live region kept) unless the last tap was there. */
  const soundPanel = (at: SoundAt, testID: string): ReactElement => (
    <PromptPanel
      variant="status"
      view={soundAt === at ? slot.view : { ...slot.view, statusShown: false }}
      onAction={(action) =>
        slot.act(action, () => {
          const last = lastSaid.current;
          if (last) void slotPlay(() => playPrompt(last.spec), last.spec);
        })
      }
      onHelp={() => setHelpOpen(true)}
      testID={testID}
    />
  );
  if (!play || state.status === 'empty' || !round) {
    return (
      <Screen>
        <Body>{copy.realia.empty}</Body>
        {onBack ? (
          <>
            <Spacer size="lg" />
            <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={onBack} />
          </>
        ) : null}
      </Screen>
    );
  }

  /** Next (a reader on): the question moves on once; a second press, or one after it has moved, does nothing. */
  const advanceNow = (): void => {
    if (movedFrom.current === roundIdx) return;
    movedFrom.current = roundIdx;
    nextButton.hide();
    dispatch({ type: 'advance' });
  };
  // The question's header node (§3.4): the question and its key word by romanization, never its Hangul.
  const roundLabel = m.a11y.answer.round(roundIdx + 1, play.rounds.length, [round.questionEn, round.key ? a11yRomanization(round.key.romanization, m.a11y.romanizationOr) : undefined].filter((part): part is string => part !== undefined).join(' '));

  // A quest Check holds the sheet's, the key word's and the options' romanization while the question is open; a line tap says the
  // line and shows nothing (AMENDMENTS-STAGE1-DECODING-CHECK DC-1c).
  const context = { romanizationMode, romanizationOr: m.a11y.romanizationOr, held: realiaHeld(holdsRomanization(hostSurface(host.mode)), state) };
  const key = round.key ? keyView(round.key, context) : undefined;
  const header = realiaHeaderView(host.mode, state, copy);
  const title = titleView(play.realia, context);
  const lines = lineViews(play.realia, round, state, context, a11y);
  const status = realiaStatus(play.realia, round, state, host.mode, copy, a11y, m.a11y.romanizationOr);
  const arrangement = realiaArrangement(layoutClass.windowWidth, layout.sideBySideMin);
  const columns = arrangement === 'side' ? 1 : realiaOptionColumns(round, layoutClass.windowWidth);
  // D7 on native: the sheet stays put beside the options, so the screen does not scroll; each column does.
  const screenScrolls = screenScrollsWithColumns(arrangement, STICKY_PROMPT, Platform.OS);

  return (
    <Screen tone="canvas" scrollable={screenScrolls}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          {header.kind === 'dots' ? (
            <Progress variant="dots" value={header.value} max={header.max} tone="primary" />
          ) : (
            <Progress value={header.value} max={header.max} tone="primary" />
          )}
        </View>
        {header.title ? <Pill label={header.title} tone="primary" size="sm" /> : null}
        {header.label ? <Pill label={header.label} tone="neutral" size="sm" /> : null}
      </View>

      <Spacer size="lg" />
      <GameColumns
        arrangement={arrangement}
        stackedGap="lg"
        stickyPrompt={STICKY_PROMPT}
        resetKey={round.id}
        feedbackKey={status.hoya || status.lookHere ? `${state.wrongIds.length}|${status.hoya ?? ''}|${status.lookHere ?? ''}` : undefined}
        prompt={
          <View testID="realia-read-sheet-column" style={{ gap: spacing.sm }}>
            <RealiaSheetView
              testID="realia-read-sheet"
              kind={sheetKind(play.realia)}
              title={title ? { ko: title.ko, romanization: title.romanization, ...(title.romanizationReserved === true ? { romanizationReserved: true } : {}) } : undefined}
              titleLabel={title?.label}
              lines={lines}
              accessibilityLabel={sheetSummary(play.realia, a11y)}
              lineHint={a11y.realia.lineHint}
              onPressLine={(entryId) => dispatch({ type: 'line', entryId })}
            />
            {soundPanel('sheet', 'realia-read-line-sound')}
            <Body tone="muted">{copy.realia.lineHint}</Body>
          </View>
        }
        answers={
          <View style={{ gap: spacing.md }}>
            <View ref={a.promptRef} testID="realia-read-round" accessible accessibilityRole="header" accessibilityLabel={roundLabel}>
              <Heading level="prompt" testID="realia-read-question">
                {round.questionEn}
              </Heading>
            </View>
            {round.key ? (
              <View style={{ alignItems: 'center' }}>
                <KoreanText
                  testID="realia-read-key"
                  ko={round.key.ko}
                  romanization={round.key.romanization}
                  romanizationShown={key?.shown ?? false}
                  romanizationReserved={key?.reserved ?? false}
                  size="sm"
                  accessibilityLabel={realiaKeyLabel(round.key, m.a11y.koreanItem, m.a11y.romanizationOr)}
                />
              </View>
            ) : null}
            <TapBoard lock="board">
              {/* One board for the answers (AMENDMENTS-TOUCH section 6, row KT-3): a graze still counts, a bounce never counts twice. */}
              <View testID="realia-read-options" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                {round.options.map((option) => {
                  const view = realiaOptionView(round, option, state, context, a11y, m.a11y.koreanItem);
                  return (
                    <View key={option.id} style={{ flexGrow: 1, flexBasis: columns === 2 ? '45%' : '100%', minWidth: touchTarget.hero }}>
                      <ChoiceCard
                        testID={`realia-read-option-${option.id}`}
                        state={view.cardState}
                        ko={view.ko}
                        // A held line keeps its room, so the options do not move when the answer shows it.
                        romanization={view.heldRomanization === '' ? view.romanization : view.heldRomanization}
                        romanizationReserved={view.heldRomanization !== ''}
                        label={view.label}
                        art={view.pictureRef !== undefined ? <PictureArt pictureRef={view.pictureRef} gloss={view.label ?? ''} size={pictureSize} /> : undefined}
                        accessibilityLabel={view.accessibilityLabel}
                        onPress={() => dispatch({ type: 'tap', optionId: option.id, answerId: round.answerId, at: Date.now() })}
                      />
                    </View>
                  );
                })}
              </View>
            </TapBoard>
            {nextButton.shown ? (
              <Button
                pressableRef={nextButton.nextRef}
                label={copy.trace.next.cta}
                tone="primary"
                size="hero"
                fullWidth
                onPress={advanceNow}
                testID="realia-read-next"
              />
            ) : null}
            {soundPanel('options', 'realia-read-option-sound')}
          </View>
        }
        feedback={
          <View testID="realia-read-status">
            {status.hoya ? (
              <>
                <Spacer size="lg" />
                {/* The announcer says the result once, so this result bubble and the look-here line are not live regions too (§3.3). */}
                <HoyaBubble tone="thinking" message={status.hoya} live={false} />
              </>
            ) : null}
            {status.lookHere ? (
              <Body tone="muted" testID="realia-read-look-here">
                {status.lookHere}
              </Body>
            ) : null}
          </View>
        }
      />
      <AnswerAnnouncer line={a.line} />
      <Spacer size="xl" />
      <VoiceHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </Screen>
  );
}

/** Where the status panel shows: under the sheet (a line was tapped) or under the options (an option). */
type SoundAt = 'sheet' | 'options';

/** The surface id of Realia Read for the audio telemetry (F-AUDIO-004 §3.14). */
const REALIA_AUDIO_SOURCE = 'realia-read';
