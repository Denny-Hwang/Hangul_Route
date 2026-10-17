import { a11yRomanization, romanize, type TypeHangulRound } from '@hangul-route/content-schema';
import {
  Body,
  Button,
  Caption,
  HangulKeyboard,
  Heading,
  Hoya,
  Icon,
  KOREAN_LANGUAGE,
  KoreanText,
  Pill,
  Progress,
  Screen,
  Spacer,
  borderWidth,
  colors,
  keyboardLayout,
  keyboardWidth,
  layout,
  radii,
  spacing,
  touchTarget,
  typography,
  useLayoutClass,
  useMediaSize,
  KOREAN_LINE_BREAK,
  useTypeScale,
} from '@hangul-route/design-system';
import { romanizationShown } from '@hangul-route/i18n';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { useRomanizationMode } from '../../i18n/use-romanization-mode';
import type { MinigameScope } from '../../logic/minigame-config';
import { chunkRows, compareGrid } from '../../logic/type-hangul/compare-grid';
import { fieldView, startFlow, stepFlow, type TypeHangulEffect, type TypeHangulEvent, type TypeHangulState } from '../../logic/type-hangul/flow';
import type { BlockCompare } from '../../logic/type-hangul/score';
import { keySound } from '../../logic/type-hangul/sounds';
import { nudge, success } from '../../platform/haptics';
import { announceForScreenReader, focusForScreenReader } from '../../platform/screen-reader';
import type { MinigameHost } from './host';
import { PictureArt } from './PictureArt';

/**
 * Type Hangul (F-CURR-001 §3.7 item 2, row G-3; design/wireframes/minigame/type-hangul.md,
 * design/screens/minigame-writing/type-hangul.md): type the word on the in-app two-set
 * keyboard (OD-10: never the system keyboard), then Done. The round logic is
 * `logic/type-hangul/flow.ts`; this file renders it and runs its effects. What the
 * learner types stays in this component's state: it is never written to a store, a log
 * line or telemetry, and it goes when the component unmounts (test P-1).
 */

interface Props {
  scope: MinigameScope;
  host: MinigameHost;
  /** Leave an empty scope (never a dead end). */
  onBack?: () => void;
}

/** Typed Korean is read with the Korean voice; react-native-web forwards `lang` (spread: native Text props lack it). */
export const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

/** Visually hidden, still read (the field's polite live line). */
export const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;

/** Focus target for assistive tech when the result panel opens: `focus()` on the web, the native view elsewhere. */
export interface Focusable {
  focus?: () => void;
}

/**
 * Moves assistive-tech focus to the result panel's first line. On the web the element's own
 * `focus()` does it; on iOS and Android it does not move VoiceOver or TalkBack focus, so the
 * screen-reader helper does (platform/screen-reader.ts).
 */
export function focusPanel(node: Focusable | null): void {
  if (node === null) return;
  if (Platform.OS === 'web') node.focus?.();
  else focusForScreenReader(node);
}

export function TypeHangulGame({ scope, host, onBack }: Props): React.ReactElement {
  const textScale = useTypeScale();
  const m = useMessages();
  const copy = m.learner.minigame;
  const t = copy.typeHangul;
  const k = m.a11y.minigame.keyboard;
  const rounds = useMemo<readonly TypeHangulRound[]>(() => scope.typeHangul?.rounds ?? [], [scope]);
  const [state, setState] = useState<TypeHangulState>(() => startFlow(rounds.map((r) => r.target.ko)));
  const stateRef = useRef(state);
  const hostRef = useRef(host);
  hostRef.current = host;
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<Focusable | null>(null);

  const lc = useLayoutClass();
  const [available, setAvailable] = useState(lc.windowWidth);
  const kbWidth = keyboardWidth(lc, available || lc.windowWidth);
  const compactRow = lc.windowHeight > 0 && lc.windowHeight < layout.compactHeight;
  const phone = lc.width === 'compact' || lc.short;
  // Done sits beside the field on a phone and in any window under 640 tall; elsewhere it is full
  // width under the keyboard. Skip is drawn once: in the top row (a compact-height window that is
  // not short, or a phone), beside Done (a short window), else under Done (type-hangul.md).
  const inlineDone = phone || compactRow;
  const skipIn: 'top' | 'answer' | 'bottom' = lc.short ? 'answer' : compactRow || phone ? 'top' : 'bottom';
  // A window under 640 tall keeps keys at the touch floor (no media scale): a 1024 x 600 window
  // would otherwise draw 4 x 90 and push Done off the screen.
  const keyboardClass = compactRow && lc.mediaScale !== 1 ? { ...lc, mediaScale: 1 } : lc;
  const kb = keyboardLayout(kbWidth, keyboardClass);
  const romanizationMode = useRomanizationMode();
  const [revealed, setRevealed] = useState(false);
  const pictureSize = useMediaSize(compactRow ? spacing.xxxl : touchTarget.hero);
  const fieldFont = lc.mediaScale > 1 ? textScale.size.display : textScale.size.title;

  const runEffect = useCallback((effect: TypeHangulEffect): void => {
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
        // Skip during the pass pause: the scheduled advance must not complete the game a second time.
        if (advanceTimer.current) clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
        hostRef.current.complete();
    }
  }, [rounds]);

  const dispatch = useCallback(
    (event: TypeHangulEvent): void => {
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
  const readTyped = (text: string): string => k.field(text, a11yRomanization(romanize(text).text));
  const readTypedRef = useRef(readTyped);
  readTypedRef.current = readTyped;

  // Nothing typed outlives the round's screen: the timer goes, and the state with the component.
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  // The result panel takes focus when it opens, on Hoya's line (then the compare, the word and Fix it).
  useEffect(() => {
    if (state.phase !== 'typing') focusPanel(panelRef.current);
  }, [state.phase, state.retries]);

  // Each round starts with the romanization hidden again when the setting is "tap to show".
  useEffect(() => setRevealed(false), [state.roundIdx]);

  // The field's polite live line (finished blocks, the whole text after Del). Web and Android read
  // the live region; iOS has none, so VoiceOver is told here (a no-op on the other platforms).
  const live = fieldView(state).live;
  useEffect(() => {
    if (live !== '' && stateRef.current.phase === 'typing') announceForScreenReader(readTypedRef.current(live));
  }, [live]);

  const round = rounds[state.roundIdx];
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

  const field = fieldView(state);
  const mode = round.pictureRef ? 'picture' : 'see';
  const instruction = t.heading[mode];
  const skip = (): void => dispatch({ type: 'skip' });
  const done = (): void => dispatch({ type: 'done' });
  // In "see" mode the learner's romanization setting applies ("tap to show"); a picture round always
  // shows it, because with the Korean hidden the romanization and gloss are the cue.
  const romanizationVisible = mode === 'picture' || romanizationShown(romanizationMode, revealed);
  const reveal = (): void => setRevealed(true);

  // The word to type, with its romanization and gloss (taught Korean always carries both). A compact
  // window (under 640 tall) draws it inline in the top row, as the mock does; a picture round hides the Korean.
  const prompt = compactRow ? (
    <View style={{ flexShrink: 1, gap: spacing.xxs }}>
      <Caption tone="secondary">{round.promptEn}</Caption>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {mode === 'picture' ? <PictureArt pictureRef={round.pictureRef} gloss={round.target.en} size={pictureSize} /> : null}
        {mode === 'see' ? (
          <WordLine round={round} romanizationVisible={romanizationVisible} onReveal={reveal} testID="type-hangul-prompt" />
        ) : (
          <View style={{ flexShrink: 1 }} testID="type-hangul-prompt">
            <Body weight="bold">{round.target.romanization}</Body>
            <Caption tone="secondary">{round.target.en}</Caption>
          </View>
        )}
      </View>
    </View>
  ) : mode === 'see' ? (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <KoreanText
        ko={round.target.ko}
        romanization={round.target.romanization}
        gloss={round.target.en}
        size="md"
        romanizationShown={romanizationVisible}
        accessibilityLabel={romanizationVisible ? undefined : m.a11y.vocab.cards.word(round.target.ko)}
        testID="type-hangul-prompt"
      />
      {romanizationVisible ? null : (
        <Button label={t.showRomanization.cta} tone="ghost" size="sm" onPress={reveal} testID="type-hangul-reveal" />
      )}
    </View>
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 }} testID="type-hangul-prompt">
      <PictureArt pictureRef={round.pictureRef} gloss={round.target.en} size={pictureSize} />
      <View style={{ flexShrink: 1 }}>
        <Body weight="bold">{round.target.romanization}</Body>
        <Caption tone="secondary">{round.target.en}</Caption>
      </View>
    </View>
  );

  const header = compactRow ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Pill label={copy.progress.pill(state.roundIdx + 1, state.total)} size="sm" />
      <View style={{ flex: 1, minWidth: 0 }}>{prompt}</View>
      {skipIn === 'top' ? <Button label={copy.skip.cta} tone="ghost" size="sm" onPress={skip} testID="type-hangul-skip" /> : null}
    </View>
  ) : (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={state.roundIdx + 1} max={state.total} tone="primary" />
        </View>
        <Pill label={copy.progress.pill(state.roundIdx + 1, state.total)} size="sm" />
        {skipIn === 'top' ? <Button label={copy.skip.cta} tone="ghost" size="sm" onPress={skip} testID="type-hangul-skip" /> : null}
      </View>
      <Spacer size="md" />
      <Heading level="prompt">{round.promptEn}</Heading>
      <Spacer size="sm" />
      {prompt}
    </>
  );

  const passed = state.phase === 'pass';
  const answerField = (
    <View
      testID="type-hangul-field"
      accessible
      accessibilityLabel={field.empty ? instruction : readTyped(field.text)}
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
        <Text {...KOREAN_LINE_BREAK} style={{ flex: 1, fontSize: textScale.size.bodySm, color: colors.text.muted }}>{instruction}</Text>
      ) : (
        <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ flexShrink: 1, fontSize: fieldFont, color: colors.text.primary }}>
          {state.phase === 'typing' ? field.settled : field.text}
          {field.open && state.phase === 'typing' ? (
            <Text {...KOREAN_LINE_BREAK}
              testID="type-hangul-open-block"
              style={{ textDecorationLine: 'underline', textDecorationColor: colors.brand.secondary, textDecorationStyle: 'solid' }}
            >
              {field.open}
            </Text>
          ) : null}
        </Text>
      )}
      {state.phase === 'typing' ? (
        <View style={{ width: borderWidth.base, height: Math.round(fieldFont * 1.1), backgroundColor: colors.text.primary, marginLeft: spacing.xxs }} />
      ) : null}
      {passed ? (
        <View style={{ marginLeft: 'auto' }}>
          <Icon name="check-circle" size={spacing.xl} color={colors.feedback.success} />
        </View>
      ) : null}
      <Text {...KOREAN_LINE_BREAK} style={srOnly} accessibilityLiveRegion="polite">
        {field.live === '' ? '' : readTyped(field.live)}
      </Text>
    </View>
  );

  const doneButton = (
    <Button
      label={copy.trace.done.cta}
      tone="primary"
      size="md"
      fullWidth={!inlineDone}
      disabled={field.empty || state.phase !== 'typing'}
      onPress={done}
      testID="type-hangul-done"
    />
  );

  const footer = (
    <View onLayout={(e: LayoutChangeEvent) => setAvailable(e.nativeEvent.layout.width)} style={{ alignSelf: 'stretch' }}>
      <View style={{ width: phone ? undefined : kbWidth, alignSelf: phone ? 'stretch' : 'center', paddingHorizontal: phone ? lc.gutter : 0, paddingBottom: lc.short ? spacing.xs : spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {answerField}
          {inlineDone ? doneButton : null}
          {/* A short window (a phone on its side) has no room for Skip in the top row: it sits beside Done. */}
          {skipIn === 'answer' ? <Button label={copy.skip.cta} tone="ghost" size="sm" onPress={skip} testID="type-hangul-skip" /> : null}
        </View>
      </View>
      {state.phase === 'typing' ? (
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
      ) : (
        <ResultPanel
          state={state}
          round={round}
          width={kbWidth}
          height={kb.height}
          gutter={phone ? lc.gutter : 0}
          panelRef={panelRef}
          onFix={() => dispatch({ type: 'fix' })}
        />
      )}
      {skipIn === 'bottom' ? (
        <View style={{ width: kbWidth, alignSelf: 'center', paddingTop: spacing.md, gap: spacing.sm }}>
          {state.phase === 'typing' && !inlineDone ? doneButton : null}
          <Button label={copy.skip.cta} tone="ghost" size="md" fullWidth onPress={skip} testID="type-hangul-skip" />
        </View>
      ) : null}
    </View>
  );

  // The answer row and the keyboard are pinned to the bottom when the window holds them and still
  // leaves the prompt a row of its own (320 x 568: 72 + 392 + 64; 844 x 390: 68 + 256 + 64). A window
  // too short for that (a small phone on its side, 568 x 320) scrolls them with the prompt instead,
  // so no key is ever cut off and the touch floor is kept (keyboard.md, short windows).
  const answerRow = touchTarget.min + (lc.short ? spacing.xs : spacing.sm);
  const underKeyboard = skipIn === 'bottom' ? spacing.md + (inlineDone ? 0 : touchTarget.min + spacing.sm) + touchTarget.min : 0;
  const pinned = lc.windowHeight <= 0 || lc.windowHeight >= answerRow + kb.height + underKeyboard + touchTarget.min;

  // A phone (and any short window) gets the keyboard edge to edge, so the screen has no width cap there.
  return (
    <Screen tone="canvas" padded={false} width={phone ? 'bleed' : 'reading'} footer={pinned ? footer : undefined} testID="type-hangul">
      <View style={{ paddingHorizontal: lc.gutter, paddingTop: compactRow ? spacing.sm : spacing.md, paddingBottom: spacing.sm }}>
        {header}
      </View>
      {pinned ? null : footer}
    </Screen>
  );
}

export interface ResultPanelProps {
  /** The check and the phase only (Write Frame passes its own, G-5). */
  state: Pick<TypeHangulState, 'score' | 'phase'>;
  /** The word checked against (Write Frame: the picked word). */
  round: Pick<TypeHangulRound, 'target'>;
  width: number;
  /** The keyboard's height: the panel takes its place, so nothing jumps. */
  height: number;
  gutter: number;
  /** Hoya's line, focused when the panel opens. */
  panelRef: React.MutableRefObject<Focusable | null>;
  onFix: () => void;
}

/** After Done: Hoya's line, and on a miss the block compare, the word and Fix it (type-hangul.md "After Done"). */
export function ResultPanel({ state, round, width, height, gutter, panelRef, onFix }: ResultPanelProps): React.ReactElement {
  const m = useMessages();
  const t = m.learner.minigame.typeHangul;
  const k = m.a11y.minigame.keyboard;
  const score = state.score;
  const passed = state.phase === 'pass';
  const line = passed ? t.pass : score?.verdict === 'near' ? t.near : t.far;
  const blocks = score?.blocks ?? [];
  const inner = width - 2 * gutter;
  // A long guess on a narrow phone wraps: typed and word rows per chunk, so each pair stays in one column.
  const { cell, perRow } = compareGrid(blocks.length, inner, spacing.xs, spacing.xxl, touchTarget.min);
  const chunks = chunkRows(blocks, perRow);
  const readout = [
    k.typedBlocks(blocks.flatMap((b) => (b.typed === null ? [] : [b.typed]))),
    k.wordBlocks(blocks.flatMap((b) => (b.target === null ? [] : [b.target]))),
    ...(score?.differing ?? []).map((n) => k.different(n)),
  ].join(' ');

  return (
    <View style={{ height, width, alignSelf: 'center' }} testID="type-hangul-result">
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.md, gap: spacing.md }}>
        <View
          ref={panelRef as React.Ref<View>}
          accessible
          focusable
          accessibilityLabel={line}
          accessibilityLiveRegion="polite"
          testID="type-hangul-line"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: radii.lg,
            borderWidth: borderWidth.base,
            backgroundColor: passed ? colors.feedback.successLight : colors.feedback.nudgeLight,
            borderColor: passed ? colors.feedback.success : colors.feedback.nudge,
          }}
        >
          <Hoya pose={passed ? 'cheering' : 'thinking'} size={spacing.xxxl - spacing.sm} />
          <View style={{ flex: 1 }}>
            <Body weight="bold">{line}</Body>
          </View>
        </View>
        {passed ? null : (
          <>
            <View accessible accessibilityLabel={readout} style={{ gap: spacing.xs }} testID="type-hangul-compare">
              {chunks.map((chunk, c) => (
                // Every chunk carries both captions, so a lower pair is never two unlabelled rows of boxes.
                <View key={c} style={{ gap: spacing.xs, paddingTop: c === 0 ? 0 : spacing.md }} testID="type-hangul-compare-chunk">
                  <Caption tone="secondary">{t.typedLabel}</Caption>
                  <BlockRow blocks={chunk} side="typed" cell={cell} />
                  <Caption tone="secondary">{t.targetLabel}</Caption>
                  <BlockRow blocks={chunk} side="target" cell={cell} />
                </View>
              ))}
            </View>
            {/* After Done the word is the answer: it shows with its romanization whatever the setting (as Story Check does once resolved). */}
            <WordLine round={round} romanizationVisible />
            <Button label={t.fixIt.cta} tone="primary" size="md" fullWidth onPress={onFix} testID="type-hangul-fix" />
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** One row of the compare grid: a block per column; a differing block marked by its border and a dot, never colour alone. */
function BlockRow({ blocks, side, cell }: { blocks: readonly BlockCompare[]; side: 'typed' | 'target'; cell: number }): React.ReactElement {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs }} testID={`type-hangul-${side}-row`} {...{ 'aria-hidden': true }} importantForAccessibility="no-hide-descendants">
      {blocks.map((block, i) => {
        const text = side === 'typed' ? block.typed : block.target;
        const marked = block.status !== 'same';
        const empty = text === null;
        return (
          <View
            key={i}
            testID={marked ? `type-hangul-${side}-marked` : undefined}
            style={{
              width: cell,
              height: cell,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.md,
              borderWidth: marked && !empty ? borderWidth.thick : borderWidth.base,
              borderStyle: empty ? 'dashed' : 'solid',
              borderColor: empty ? colors.border.shape : marked ? colors.feedback.nudge : colors.border.subtle,
              backgroundColor: empty ? undefined : marked ? colors.feedback.nudgeLight : colors.surface.paper,
            }}
          >
            {empty ? null : (
              <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: Math.round(cell * 0.5), color: colors.text.primary }}>
                {text}
              </Text>
            )}
            {marked && !empty ? (
              <View
                style={{
                  position: 'absolute',
                  top: spacing.xxs,
                  right: spacing.xxs,
                  width: spacing.md,
                  height: spacing.md,
                  borderRadius: radii.circle,
                  backgroundColor: colors.feedback.nudge,
                  borderWidth: borderWidth.thin,
                  borderColor: colors.text.primary,
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

interface WordLineProps {
  round: Pick<TypeHangulRound, 'target'>;
  /** The learner's setting (`romanizationShown`); the result panel always passes true. */
  romanizationVisible: boolean;
  /** Shows the romanization when the setting hides it until a tap. */
  onReveal?: () => void;
  testID?: string;
}

/** A word on one line, as the mock draws it: the Korean, its romanization and `· gloss`, read as one item. */
function WordLine({ round, romanizationVisible, onReveal, testID }: WordLineProps): React.ReactElement {
  const textScale = useTypeScale();
  const m = useMessages();
  const { ko, romanization, en } = round.target;
  const hidden = !romanizationVisible;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, flexShrink: 1 }}>
      {/* One item with its romanization; while the setting hides it, the Korean (Korean voice) and the gloss are read in turn. */}
      <View
        accessible={!hidden}
        accessibilityLabel={hidden ? undefined : m.a11y.koreanItem({ ko, romanization, gloss: en })}
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.sm, flexShrink: 1 }}
        testID={testID}
      >
        {/* `lang="ko"` (koreanSpeech) also gives the web its keep-all wrapping: the PWA shell's `:lang(ko)`
            rule breaks a sentence at its spaces, never inside a word (F-I18N-001 PR 16). */}
        <Text {...KOREAN_LINE_BREAK} {...koreanSpeech} style={{ fontSize: textScale.size.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {ko}
        </Text>
        {hidden ? null : <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodySm, fontStyle: 'italic', color: colors.text.secondary }}>{romanization}</Text>}
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodySm, color: colors.text.secondary }}>{`· ${en}`}</Text>
      </View>
      {hidden && onReveal ? (
        <Button label={m.learner.minigame.typeHangul.showRomanization.cta} tone="ghost" size="sm" onPress={onReveal} testID="type-hangul-reveal" />
      ) : null}
    </View>
  );
}

