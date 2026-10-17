import { a11yRomanization, keysFor, romanize, type KoText, type SoundTable, type WriteFrameRound } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  HangulKeyboard,
  Heading,
  Hoya,
  HoyaBubble,
  Icon,
  Pill,
  Progress,
  Screen,
  SectionTabs,
  Spacer,
  borderWidth,
  colors,
  keyboardLayout,
  keyboardWidth,
  layout,
  radii,
  shadows,
  spacing,
  touchTarget,
  typography,
  useLayoutClass,
  KOREAN_LINE_BREAK,
  useTypeScale,
} from '@hangul-route/design-system';
import { romanizationShown } from '@hangul-route/i18n';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import type { MinigameScope } from '../../logic/minigame-config';
import { fieldView } from '../../logic/type-hangul/flow';
import { keySound } from '../../logic/type-hangul/sounds';
import {
  nameReady,
  pickedWords,
  startFlow,
  stepFlow,
  type FrameInput,
  type WriteFrameEffect,
  type WriteFrameEvent,
  type WriteFrameState,
} from '../../logic/write-frame/flow';
import { fillGloss, fittedEnding, frameParts, frameReading, nameGloss, sentenceKo, sentenceRomanization, type FramePart } from '../../logic/write-frame/view';
import { nudge, success } from '../../platform/haptics';
import { announceForScreenReader, focusForScreenReader } from '../../platform/screen-reader';
import type { MinigameHost } from './host';
import { ResultPanel, focusPanel, koreanSpeech, srOnly, type Focusable } from './TypeHangulGame';

/**
 * Write Frame (F-CURR-001 §3.7, row G-5; design/wireframes/minigame/write-frame.md,
 * design/screens/minigame-writing/write-frame.md): pick a word for the blank from a bank of
 * taught words (any pick is right), type it on the in-app keyboard (checked against the word
 * picked), and read the finished sentence; "My page" closes the step with every sentence and is
 * not kept (OD-6). The name round (Write Your Name q3) builds the learner's own name with sound
 * tiles or the keyboard, unscored.
 *
 * The free-entry data rule (spec §3.7, test P-1): picks, typed keys, the name and the sentences
 * live only in this component's React state. Nothing here writes a store, storage, navigation
 * params, telemetry, crash reports or a log line, and all of it goes when the component unmounts.
 * The host hears only a frame's index and whether it was right, with the round id.
 *
 * A round whose `entry` is `trace` is written on the keyboard here: the Trace a Word canvas
 * (row G-4) joins the frame in a follow-up, and until then no ready lesson cell may use one
 * (`upper-stage-curriculum.test.ts`).
 */

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** Leave an empty scope (never a dead end). */
  onBack?: () => void;
  /**
   * The grown-up preview (All lessons, F-BROWSE-001) plays in the quest's own host mode; it sets this
   * so the name round opens on the cast name and a grown-up never needs to type a real name there.
   */
  inPreview?: boolean;
}

/** The grown-up preview's name (F-BROWSE-001): the cast name, never a learner's entry. */
export const PREVIEW_NAME = '호야';

type NameTab = 'blocks' | 'keyboard';

/** Moves assistive-tech focus to a node (web `focus()`, native screen-reader focus). */
function focusNode(node: Focusable | null): void {
  if (node === null) return;
  if (Platform.OS === 'web') node.focus?.();
  else focusForScreenReader(node);
}

export function WriteFrameGame({ scope, host, onBack, inPreview = false }: Props): React.ReactElement {
  const textScale = useTypeScale();
  const m = useMessages();
  const copy = m.learner.minigame;
  const w = copy.writeFrame;
  const k = m.a11y.minigame.keyboard;
  const a = m.a11y.minigame.writeFrame;
  const rounds = useMemo<readonly WriteFrameRound[]>(() => scope.writeFrame?.rounds ?? [], [scope]);
  const frames = useMemo<FrameInput[]>(
    () => rounds.map((r) => ({ banks: r.slots.map((s) => s.bank.map((word) => word.ko)), entry: r.entry, freeEntry: r.freeEntry })),
    [rounds],
  );
  const [state, setState] = useState<WriteFrameState>(() => startFlow(frames, inPreview || host.mode === 'preview' ? keysFor(PREVIEW_NAME) : []));
  const stateRef = useRef(state);
  const hostRef = useRef(host);
  hostRef.current = host;
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<Focusable | null>(null);
  const myPageRef = useRef<Focusable | null>(null);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<NameTab>('blocks');
  const [revealed, setRevealed] = useState(false);
  const romanizationMode = useRomanizationMode();

  const lc = useLayoutClass();
  const [available, setAvailable] = useState(lc.windowWidth);
  const kbWidth = keyboardWidth(lc, available || lc.windowWidth);
  const compactRow = lc.windowHeight > 0 && lc.windowHeight < layout.compactHeight;
  const phone = lc.width === 'compact' || lc.short;
  const keyboardClass = compactRow && lc.mediaScale !== 1 ? { ...lc, mediaScale: 1 } : lc;
  const kb = keyboardLayout(kbWidth, keyboardClass);
  const fieldFont = lc.mediaScale > 1 ? textScale.size.display : textScale.size.title;

  const runEffect = useCallback(
    (effect: WriteFrameEffect): void => {
      switch (effect.type) {
        case 'answer': {
          const round = rounds[effect.roundIdx];
          hostRef.current.answer(effect.roundIdx, effect.correct, round ? { itemId: round.id } : undefined);
          return;
        }
        case 'haptic':
          if (effect.kind === 'success') success();
          else nudge();
          return;
        case 'schedule-advance':
          advanceTimer.current = setTimeout(() => dispatchRef.current({ type: 'advance' }), effect.ms);
          return;
        case 'complete':
          if (advanceTimer.current) clearTimeout(advanceTimer.current);
          advanceTimer.current = null;
          hostRef.current.complete();
      }
    },
    [rounds],
  );

  const dispatch = useCallback(
    (event: WriteFrameEvent): void => {
      const { state: next, effects } = stepFlow(stateRef.current, event);
      if (next === stateRef.current) return;
      stateRef.current = next;
      setState(next);
      for (const effect of effects) runEffect(effect);
    },
    [runEffect],
  );
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // Nothing written outlives the step's screen: the timer goes, and the state with the component.
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  // The result panel takes focus when it opens (as in Type Hangul); My page takes focus on its title.
  useEffect(() => {
    if (state.phase === 'miss' || state.phase === 'pass') focusPanel(panelRef.current);
    if (state.phase === 'myPage') focusNode(myPageRef.current);
  }, [state.phase, state.retries]);

  // Each frame starts with the romanization hidden again when the setting is "tap to show".
  useEffect(() => setRevealed(false), [state.roundIdx]);

  const round = rounds[state.roundIdx];
  const words = pickedWords(state);
  const field = fieldView(state);
  const readTyped = (text: string): string => k.field(text, a11yRomanization(romanize(text).text));
  const readTypedRef = useRef(readTyped);
  readTypedRef.current = readTyped;
  const live = state.phase === 'typing' ? field.live : '';
  useEffect(() => {
    if (live !== '') announceForScreenReader(readTypedRef.current(live));
  }, [live]);

  if (!round) {
    return (
      <Screen tone="canvas">
        <Body>{copy.noRounds}</Body>
        {onBack ? (
          <>
            <Spacer size="lg" />
            <Button label={copy.backToQuest.cta} tone="secondary" size="md" onPress={onBack} />
          </>
        ) : null}
      </Screen>
    );
  }

  const skip = (): void => dispatch({ type: 'skip' });
  const skipButton = (size: 'sm' | 'md', fullWidth = false): React.ReactElement => (
    <Button label={copy.skip.cta} tone="ghost" size={size} fullWidth={fullWidth} onPress={skip} testID="write-frame-skip" />
  );
  const romanizationVisible = romanizationShown(romanizationMode, revealed);
  const reveal = (): void => setRevealed(true);
  const bankOf = (slot: number): readonly KoText[] => round.slots[slot]?.bank ?? [];
  const glossOf = (slot: number, ko: string): string => bankOf(slot).find((word) => word.ko === ko)?.en ?? ko;
  const free = round.freeEntry;

  // The word in each slot as the card draws it: the name being built, or the picks.
  const slotWords: (string | null)[] = free ? [field.text.trim() === '' ? null : field.text.trim()] : words;
  const parts = frameParts(round.frame.ko, slotWords);

  const progressRow = (withSkip: boolean): React.ReactElement => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <Progress value={state.roundIdx + 1} max={state.total} tone="primary" />
      </View>
      <Pill label={copy.progress.pill(state.roundIdx + 1, state.total)} size="sm" />
      {withSkip ? skipButton('sm') : null}
    </View>
  );

  // ---- My page: the step's closing panel, in the reward look; not kept (OD-6). ----
  if (state.phase === 'myPage') {
    return (
      <Screen tone="canvas" testID="write-frame-my-page">
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Hoya pose="cheering" size={spacing.xxxl + spacing.md} />
          <View ref={myPageRef as React.Ref<View>} accessible focusable accessibilityRole="header">
            <Heading level="title">{w.myPage.title}</Heading>
          </View>
        </View>
        <Spacer size="md" />
        <View
          testID="write-frame-my-page-sheet"
          style={{
            backgroundColor: colors.surface.paper,
            borderRadius: radii.lg,
            borderWidth: borderWidth.thin,
            borderColor: colors.border.subtle,
            padding: spacing.lg,
            gap: spacing.lg,
            ...shadows.card,
          }}
        >
          {state.written.map((entry) => {
            const written = rounds[entry.roundIdx] as WriteFrameRound;
            return (
              <Sentence
                key={entry.roundIdx}
                ko={sentenceKo(written.frame.ko, entry.words)}
                romanization={sentenceRomanization(written.frame.ko, entry.words)}
                gloss={fillGloss(
                  written.frame.en,
                  entry.words.map((word, slot) => (written.freeEntry ? nameGloss(word) : (written.slots[slot]?.bank.find((b) => b.ko === word)?.en ?? word))),
                )}
              />
            );
          })}
        </View>
        <Spacer size="md" />
        <Caption tone="secondary" align="center">
          {w.myPage.notKept}
        </Caption>
        <Spacer size="lg" />
        <Button label={m.common.buttons.continue} tone="primary" size="lg" fullWidth onPress={() => dispatch({ type: 'continue' })} testID="write-frame-continue" />
      </Screen>
    );
  }

  // ---- The finished sentence, then the next frame (or My page) after the pause. ----
  if (state.phase === 'sentence') {
    const entry = state.written[state.written.length - 1] as { words: readonly string[] };
    const gloss = fillGloss(
      round.frame.en,
      entry.words.map((word, slot) => (free ? nameGloss(word) : glossOf(slot, word))),
    );
    return (
      <Screen tone="canvas" testID="write-frame-sentence">
        {progressRow(true)}
        <Spacer size="md" />
        <FrameCard>
          <Sentence ko={sentenceKo(round.frame.ko, entry.words)} romanization={sentenceRomanization(round.frame.ko, entry.words)} gloss={gloss} />
        </FrameCard>
        <Spacer size="md" />
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={w.sentenceDone}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.lg,
            borderWidth: borderWidth.base,
            backgroundColor: colors.feedback.successLight,
            borderColor: colors.feedback.success,
          }}
          testID="write-frame-sentence-done"
        >
          <Hoya pose="cheering" size={spacing.xxxl - spacing.sm} />
          <View style={{ flex: 1 }}>
            <Body weight="bold">{w.sentenceDone}</Body>
          </View>
        </View>
      </Screen>
    );
  }

  const cardLabel = frameReading(
    parts,
    free
      ? nameReady(field.text)
        ? fillGloss(round.frame.en, [nameGloss(field.text)])
        : round.frame.en
      : fillGloss(round.frame.en, words.map((word, slot) => (word === null ? '___' : glossOf(slot, word)))),
    { blank: a.blank, either: a.either },
  );
  const frameCard = (
    <FrameCard label={cardLabel} testID="write-frame-card">
      <FrameLine parts={parts} current={free || round.slots.length < 2 ? null : state.slotIdx} writing={state.phase !== 'pick'} />
      {romanizationVisible ? (
        <Caption tone="secondary">{free && nameReady(field.text) ? sentenceRomanization(round.frame.ko, [field.text.trim()]) : round.frame.romanization}</Caption>
      ) : null}
      {free ? null : <Caption tone="secondary">{round.frame.en}</Caption>}
    </FrameCard>
  );
  // Writing in a window under 640 tall: the frame is one bare line under the top row, so the answer row
  // and the keyboard keep their place (wireframe: 64 + 30 + 72 + 393 at 320 x 568).
  const frameLineOnly = (
    <View accessible accessibilityLabel={cardLabel} testID="write-frame-card">
      <FrameLine parts={parts} current={free || round.slots.length < 2 ? null : state.slotIdx} writing />
    </View>
  );
  const revealButton = romanizationVisible ? null : (
    <Button label={copy.typeHangul.showRomanization.cta} tone="ghost" size="sm" onPress={reveal} testID="write-frame-reveal" />
  );
  const politeLine = (
    <Text {...KOREAN_LINE_BREAK} style={srOnly} accessibilityLiveRegion="polite" testID="write-frame-notice">
      {notice}
    </Text>
  );

  // ---- Phase 1: pick a word for the slot. ----
  if (state.phase === 'pick') {
    const pickWord = (index: number): void => {
      const slot = state.slotIdx;
      dispatch({ type: 'pick', index });
      const fitted = fittedEnding(frameParts(round.frame.ko, words.map((word, i) => (i === slot ? (bankOf(slot)[index]?.ko ?? null) : word))), slot);
      const said = fitted === null ? '' : a.particleFits(fitted.particle, fitted.word);
      setNotice(said);
      if (said !== '') announceForScreenReader(said);
    };
    const columns = lc.width === 'compact' ? 2 : lc.width === 'regular' ? 3 : 4;
    return (
      <Screen tone="canvas" testID="write-frame">
        {progressRow(false)}
        <Spacer size="md" />
        <Heading level="prompt">{w.heading}</Heading>
        <Spacer size="sm" />
        {frameCard}
        {revealButton}
        <Spacer size="md" />
        <Body>{w.pick}</Body>
        <Spacer size="sm" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} testID="write-frame-bank">
          {bankOf(state.slotIdx).map((word, index) => (
            <WordCard
              key={word.ko}
              word={word}
              selected={state.picks[state.slotIdx] === index}
              romanizationVisible={romanizationVisible}
              columns={columns}
              onPress={() => pickWord(index)}
              testID={`write-frame-word-${index}`}
            />
          ))}
        </View>
        <Spacer size="lg" />
        {skipButton('md', true)}
        {politeLine}
      </Screen>
    );
  }

  // ---- Phase 2: write the picked word (or the name) on the keyboard, or with the sound tiles. ----
  const inlineDone = phone || compactRow;
  const skipIn: 'top' | 'answer' | 'bottom' = lc.short ? 'answer' : compactRow || phone ? 'top' : 'bottom';
  const typing = state.phase === 'typing';
  const doneEnabled = typing && (free ? nameReady(field.text) : !field.empty);
  const done = (): void => dispatch({ type: 'done' });
  const changeWord =
    !free && !state.firstDone ? (
      <Button label={w.changeWord.cta} tone="ghost" size="sm" onPress={() => dispatch({ type: 'change-word' })} testID="write-frame-change-word" />
    ) : null;
  const target = free ? null : (bankOf(state.slotIdx)[state.picks[state.slotIdx] as number] as KoText);
  const placeholder = free ? w.name.heading : copy.typeHangul.heading.see;
  const helper = free && state.atLongest ? w.name.longest : free && !field.empty && !nameReady(field.text) ? w.name.finishBlock : null;

  const header = (
    <>
      {compactRow ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pill label={copy.progress.pill(state.roundIdx + 1, state.total)} size="sm" />
          <View style={{ flex: 1 }}>{changeWord}</View>
          {skipIn === 'top' ? skipButton('sm') : null}
        </View>
      ) : (
        progressRow(skipIn === 'top')
      )}
      {compactRow && !free ? null : <Spacer size="sm" />}
      {free ? (
        <>
          <Heading level="prompt">{w.name.heading}</Heading>
          <Spacer size="xs" />
        </>
      ) : null}
      {compactRow && !free ? frameLineOnly : frameCard}
      {compactRow && !free ? null : revealButton}
      {!compactRow && changeWord ? <View style={{ alignItems: 'flex-start' }}>{changeWord}</View> : null}
      {free ? (
        <>
          <Spacer size="sm" />
          <HoyaBubble tone="idle" message={w.name.noWrong} testID="write-frame-no-wrong" />
        </>
      ) : null}
      {politeLine}
    </>
  );

  const passed = state.phase === 'pass';
  const answerField = (
    <View
      testID="write-frame-field"
      accessible
      accessibilityLabel={field.empty ? placeholder : readTyped(field.text)}
      style={{
        flex: 1,
        minHeight: touchTarget.min,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        backgroundColor: passed ? colors.feedback.successLight : colors.surface.paper,
        borderWidth: borderWidth.base,
        borderColor: passed ? colors.feedback.success : colors.border.strong,
        borderRadius: radii.md,
      }}
    >
      {field.empty ? (
        <Text {...KOREAN_LINE_BREAK} style={{ flex: 1, fontSize: textScale.size.bodySm, color: colors.text.muted }}>{placeholder}</Text>
      ) : (
        <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ flexShrink: 1, fontSize: fieldFont, color: colors.text.primary }}>
          {typing ? field.settled : field.text}
          {field.open && typing ? (
            <Text {...KOREAN_LINE_BREAK} style={{ textDecorationLine: 'underline', textDecorationColor: colors.brand.secondary, textDecorationStyle: 'solid' }}>{field.open}</Text>
          ) : null}
        </Text>
      )}
      {typing ? (
        <View style={{ width: borderWidth.base, height: Math.round(fieldFont * 1.1), backgroundColor: colors.text.primary, marginLeft: spacing.xxs }} />
      ) : null}
      {passed ? (
        <View style={{ marginLeft: 'auto' }}>
          <Icon name="check-circle" size={spacing.xl} color={colors.feedback.success} />
        </View>
      ) : null}
      <Text {...KOREAN_LINE_BREAK} style={srOnly} accessibilityLiveRegion="polite">
        {live === '' ? '' : readTyped(live)}
      </Text>
    </View>
  );

  const doneButton = (
    <Button label={copy.trace.done.cta} tone="primary" size="md" fullWidth={!inlineDone} disabled={!doneEnabled} onPress={done} testID="write-frame-done" />
  );

  const keyboard = (
    <HangulKeyboard
      testID="hangul-key"
      width={kbWidth}
      layoutClass={keyboardClass}
      soundOf={keySound}
      speakSound={a11yRomanization}
      labels={{ key: k.key, shift: k.shift, delete: k.delete, space: k.space }}
      onKey={(jamo) => dispatch({ type: 'key', jamo })}
      onDelete={() => dispatch({ type: 'delete' })}
      onSpace={() => dispatch({ type: 'space' })}
    />
  );
  const table = free ? round.soundTable : undefined;
  const nameTabs = table ? (
    <View style={{ width: phone ? undefined : kbWidth, alignSelf: phone ? 'stretch' : 'center', paddingHorizontal: phone ? lc.gutter : 0, paddingBottom: spacing.sm }}>
      <SectionTabs
        items={[
          { id: 'blocks', label: w.name.tabs.blocks },
          { id: 'keyboard', label: w.name.tabs.keyboard },
        ]}
        value={tab}
        onChange={setTab}
        accessibilityLabel={w.name.heading}
        testID="write-frame-tab"
      />
    </View>
  ) : null;

  let panel: React.ReactElement;
  if (!typing && !free && target) {
    panel = (
      <ResultPanel
        state={{ score: state.score, phase: state.phase === 'pass' ? 'pass' : 'miss' }}
        round={{ target }}
        width={kbWidth}
        height={kb.height}
        gutter={phone ? lc.gutter : 0}
        panelRef={panelRef}
        onFix={() => dispatch({ type: 'fix' })}
      />
    );
  } else if (table && tab === 'blocks') {
    panel = (
      <SoundPanel
        table={table}
        width={kbWidth}
        height={kb.height}
        gutter={phone ? lc.gutter : 0}
        onTile={(keys) => dispatch({ type: 'tile', keys })}
        onDelete={() => dispatch({ type: 'delete' })}
      />
    );
  } else {
    panel = keyboard;
  }

  const footer = (
    <View onLayout={(e: LayoutChangeEvent) => setAvailable(e.nativeEvent.layout.width)} style={{ alignSelf: 'stretch' }}>
      <View style={{ width: phone ? undefined : kbWidth, alignSelf: phone ? 'stretch' : 'center', paddingHorizontal: phone ? lc.gutter : 0, paddingBottom: lc.short ? spacing.xs : spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {answerField}
          {inlineDone ? doneButton : null}
          {skipIn === 'answer' ? skipButton('sm') : null}
        </View>
        {helper ? (
          <Caption tone="secondary" testID="write-frame-helper">
            {helper}
          </Caption>
        ) : null}
      </View>
      {nameTabs}
      {panel}
      {skipIn === 'bottom' ? (
        <View style={{ width: kbWidth, alignSelf: 'center', paddingTop: spacing.md, gap: spacing.sm }}>
          {typing && !inlineDone ? doneButton : null}
          {skipButton('md', true)}
        </View>
      ) : null}
    </View>
  );

  // The answer row and the keyboard are pinned to the bottom when the window holds them with a row
  // left for the frame (as Type Hangul); a shorter window scrolls them with the frame instead.
  const answerRow = touchTarget.min + (lc.short ? spacing.xs : spacing.sm) + (helper ? textScale.size.bodySm * 2 : 0);
  const tabsRow = nameTabs ? touchTarget.min + spacing.sm : 0;
  const underKeyboard = skipIn === 'bottom' ? spacing.md + (inlineDone ? 0 : touchTarget.min + spacing.sm) + touchTarget.min : 0;
  const pinned = lc.windowHeight <= 0 || lc.windowHeight >= answerRow + tabsRow + kb.height + underKeyboard + touchTarget.min;

  return (
    <Screen tone="canvas" padded={false} width={phone ? 'bleed' : 'reading'} footer={pinned ? footer : undefined} testID="write-frame">
      <View style={{ paddingHorizontal: lc.gutter, paddingTop: compactRow ? spacing.xs : spacing.md, paddingBottom: compactRow ? spacing.xxs : spacing.sm }}>{header}</View>
      {pinned ? null : footer}
    </Screen>
  );
}

/** The frame card: paper, hairline, large radius, card shadow; one accessibility element when labelled. */
function FrameCard({ children, label, testID }: { children: React.ReactNode; label?: string; testID?: string }): React.ReactElement {
  return (
    <View
      accessible={label !== undefined}
      accessibilityLabel={label}
      testID={testID}
      style={{
        backgroundColor: colors.surface.paper,
        borderRadius: radii.lg,
        borderWidth: borderWidth.thin,
        borderColor: colors.border.subtle,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        gap: spacing.xxs,
        ...shadows.card,
      }}
    >
      {children}
    </View>
  );
}

interface FrameLineProps {
  parts: readonly FramePart[];
  /** The slot being picked or written in a two-slot frame (light fill); null in a one-slot frame and the name round. */
  current: number | null;
  /** After the pick: the current slot's word is a ghost to write over. */
  writing: boolean;
}

/** The Korean frame on one line (it wraps at 200 %): text, the slots and the fitted endings. */
function FrameLine({ parts, current, writing }: FrameLineProps): React.ReactElement {
  const textScale = useTypeScale();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }} {...{ 'aria-hidden': true }} importantForAccessibility="no-hide-descendants">
      {parts.map((part, i) => {
        if (part.kind === 'text') {
          return (
            <Text {...KOREAN_LINE_BREAK} key={i} {...koreanSpeech} style={{ fontSize: textScale.size.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>
              {part.text}
            </Text>
          );
        }
        if (part.kind === 'ending') {
          return (
            <Text {...KOREAN_LINE_BREAK} key={i} {...koreanSpeech} testID="write-frame-ending" style={{ fontSize: textScale.size.prompt, fontWeight: typography.weight.bold, color: colors.brand.secondaryDark }}>
              {part.text}
            </Text>
          );
        }
        const isCurrent = current === part.slot;
        const ghost = isCurrent && writing;
        return (
          <View
            key={i}
            testID={`write-frame-slot-${part.slot}`}
            style={{
              minWidth: touchTarget.min,
              paddingHorizontal: spacing.xs,
              marginHorizontal: spacing.xxs,
              borderBottomWidth: borderWidth.thick,
              borderBottomColor: colors.brand.secondaryDark,
              backgroundColor: isCurrent ? colors.brand.secondaryLight : undefined,
              borderTopLeftRadius: radii.sm,
              borderTopRightRadius: radii.sm,
              alignItems: 'center',
            }}
          >
            <Text {...KOREAN_LINE_BREAK}
              {...koreanSpeech}
              style={{ fontSize: textScale.size.prompt, fontWeight: typography.weight.bold, color: ghost ? colors.text.muted : colors.brand.secondaryDark }}
            >
              {part.word ?? ' '}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** A finished sentence: the Korean, its romanization (converter) and the gloss with the picks. */
function Sentence({ ko, romanization, gloss }: { ko: string; romanization: string; gloss: string }): React.ReactElement {
  const textScale = useTypeScale();
  const m = useMessages();
  return (
    <View accessible accessibilityLabel={m.a11y.koreanItem({ ko, romanization, gloss })} style={{ gap: spacing.xxs }} testID="write-frame-sentence-text">
      <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: textScale.size.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>
        {ko}
      </Text>
      <Caption tone="secondary">{romanization}</Caption>
      <Caption tone="secondary">{gloss}</Caption>
    </View>
  );
}

interface WordCardProps {
  word: KoText;
  selected: boolean;
  romanizationVisible: boolean;
  columns: number;
  onPress: () => void;
  testID: string;
}

/** A word-bank card: the Korean, romanization and gloss. Any pick is right: no card has a wrong look. */
function WordCard({ word, selected, romanizationVisible, columns, onPress, testID }: WordCardProps): React.ReactElement {
  const textScale = useTypeScale();
  const m = useMessages();
  const label = m.a11y.koreanItem({ ko: word.ko, romanization: word.romanization, gloss: word.en });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      aria-selected={selected}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        flexBasis: `${Math.floor(100 / columns) - 4}%`,
        flexGrow: 1,
        minHeight: touchTarget.child,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.sm,
        gap: spacing.xxs,
        borderRadius: radii.lg,
        borderWidth: selected ? borderWidth.thick : borderWidth.base,
        borderColor: pressed ? colors.border.focus : selected ? colors.brand.secondaryDark : colors.border.subtle,
        backgroundColor: selected ? colors.brand.secondaryLight : colors.surface.paper,
      })}
    >
      <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: textScale.size.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>
        {word.ko}
      </Text>
      {romanizationVisible ? <Caption tone="secondary">{word.romanization}</Caption> : null}
      <Caption tone="secondary" align="center">
        {word.en}
      </Caption>
    </Pressable>
  );
}

interface SoundPanelProps {
  table: SoundTable;
  width: number;
  /** The keyboard's height, so switching tabs does not move the field. */
  height: number;
  gutter: number;
  onTile: (keys: readonly string[]) => void;
  onDelete: () => void;
}

/** The name round's Blocks tab: the sound table as tiles, its own Del; scrolls inside the keyboard's height. */
function SoundPanel({ table, width, height, gutter, onTile, onDelete }: SoundPanelProps): React.ReactElement {
  const textScale = useTypeScale();
  const m = useMessages();
  const w = m.learner.minigame.writeFrame.name;
  const a = m.a11y.minigame;
  const tile = (ko: string, romanization: string, final: boolean): React.ReactElement => (
    <Pressable
      key={ko}
      accessibilityRole="button"
      accessibilityLabel={a.writeFrame.tile(ko, a11yRomanization(romanization))}
      onPress={() => onTile(final ? [ko] : keysFor(ko))}
      testID={`write-frame-tile-${ko}`}
      style={({ pressed }) => ({
        minWidth: touchTarget.min,
        minHeight: touchTarget.min,
        paddingHorizontal: spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.lg,
        borderWidth: borderWidth.base,
        borderColor: pressed ? colors.border.focus : colors.border.subtle,
        backgroundColor: final ? colors.surface.sunken : colors.surface.paper,
      })}
    >
      <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: textScale.size.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>
        {ko}
      </Text>
      <Caption tone="secondary">{romanization}</Caption>
    </Pressable>
  );
  return (
    <View style={{ height, width, alignSelf: 'center', backgroundColor: colors.surface.paper }} testID="write-frame-sounds">
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter || spacing.sm, paddingVertical: spacing.sm, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Body weight="bold">{w.sounds}</Body>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={a.keyboard.delete}
            onPress={onDelete}
            testID="write-frame-tile-delete"
            style={({ pressed }) => ({
              width: touchTarget.min,
              height: touchTarget.min,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.lg,
              borderWidth: borderWidth.base,
              borderColor: pressed ? colors.border.focus : colors.border.strong,
              backgroundColor: colors.surface.paper,
            })}
          >
            <Icon name="backspace" size={spacing.xl} color={colors.text.primary} />
          </Pressable>
        </View>
        {table.groups.map((group, g) => (
          <View key={g} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {group.map((t) => tile(t.ko, t.romanization, false))}
          </View>
        ))}
        {table.finals.length > 0 ? (
          <>
            <Body weight="bold">{w.atTheEnd}</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{table.finals.map((t) => tile(t.ko, t.romanization, true))}</View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
