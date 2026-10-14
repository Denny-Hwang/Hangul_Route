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
} from '@hangul-route/design-system';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import type { MinigameScope } from '../../logic/minigame-config';
import { fieldView, startFlow, stepFlow, type TypeHangulEffect, type TypeHangulEvent, type TypeHangulState } from '../../logic/type-hangul/flow';
import type { BlockCompare } from '../../logic/type-hangul/score';
import { keySound } from '../../logic/type-hangul/sounds';
import { nudge, success } from '../../platform/haptics';
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
const koreanSpeech = { accessibilityLanguage: KOREAN_LANGUAGE, lang: KOREAN_LANGUAGE };

/** Visually hidden, still read (the field's polite live line). */
const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;

/** Focus target for assistive tech when the result panel opens (web; a no-op where the node has no `focus`). */
interface Focusable {
  focus?: () => void;
}

export function TypeHangulGame({ scope, host, onBack }: Props): React.ReactElement {
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
  const kb = keyboardLayout(kbWidth, lc);
  const compactRow = lc.windowHeight > 0 && lc.windowHeight < layout.compactHeight;
  const phone = lc.width === 'compact' || lc.short;
  const pictureSize = useMediaSize(compactRow ? spacing.xxxl : touchTarget.hero);
  const fieldFont = lc.mediaScale > 1 ? typography.size.display : typography.size.title;

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

  // Nothing typed outlives the round's screen: the timer goes, and the state with the component.
  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  // The result panel takes focus when it opens, on Hoya's line (then the compare, the word and Fix it).
  useEffect(() => {
    if (state.phase !== 'typing') panelRef.current?.focus?.();
  }, [state.phase, state.retries]);

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
  const skip = (): void => hostRef.current.complete();
  const done = (): void => dispatch({ type: 'done' });
  const readTyped = (text: string): string => k.field(text, a11yRomanization(romanize(text).text));

  // The word to type, with its romanization and gloss (taught Korean always carries both). A compact
  // window (under 640 tall) draws it inline in the top row, as the mock does; a picture round hides the Korean.
  const prompt = compactRow ? (
    <View style={{ flexShrink: 1, gap: spacing.xxs }}>
      <Caption tone="secondary">{round.promptEn}</Caption>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {mode === 'picture' ? <PictureArt pictureRef={round.pictureRef} gloss={round.target.en} size={pictureSize} /> : null}
        {mode === 'see' ? (
          <WordLine round={round} testID="type-hangul-prompt" />
        ) : (
          <View style={{ flexShrink: 1 }} testID="type-hangul-prompt">
            <Body weight="bold">{round.target.romanization}</Body>
            <Caption tone="secondary">{round.target.en}</Caption>
          </View>
        )}
      </View>
    </View>
  ) : mode === 'see' ? (
    <KoreanText ko={round.target.ko} romanization={round.target.romanization} gloss={round.target.en} size="md" testID="type-hangul-prompt" />
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
      {lc.short ? null : <Button label={copy.skip.cta} tone="ghost" size="sm" onPress={skip} testID="type-hangul-skip" />}
    </View>
  ) : (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Progress value={state.roundIdx + 1} max={state.total} tone="primary" />
        </View>
        <Pill label={copy.progress.pill(state.roundIdx + 1, state.total)} size="sm" />
        {phone ? <Button label={copy.skip.cta} tone="ghost" size="sm" onPress={skip} testID="type-hangul-skip" /> : null}
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
        <Text style={{ flex: 1, fontSize: typography.size.bodySm, color: colors.text.muted }}>{instruction}</Text>
      ) : (
        <Text {...koreanSpeech} style={{ flexShrink: 1, fontSize: fieldFont, color: colors.text.primary }}>
          {state.phase === 'typing' ? field.settled : field.text}
          {field.open && state.phase === 'typing' ? (
            <Text
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
      <Text style={srOnly} accessibilityLiveRegion="polite">
        {field.live === '' ? '' : readTyped(field.live)}
      </Text>
    </View>
  );

  const doneButton = (
    <Button
      label={copy.trace.done.cta}
      tone="primary"
      size="md"
      fullWidth={!phone}
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
          {phone ? doneButton : null}
          {/* A short window (a phone on its side) has no room for Skip in the top row: it sits beside Done. */}
          {lc.short ? <Button label={copy.skip.cta} tone="ghost" size="sm" onPress={skip} testID="type-hangul-skip" /> : null}
        </View>
      </View>
      {state.phase === 'typing' ? (
        <HangulKeyboard
          testID="hangul-key"
          width={kbWidth}
          layoutClass={lc}
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
      {!phone ? (
        <View style={{ width: kbWidth, alignSelf: 'center', paddingTop: spacing.md, gap: spacing.sm }}>
          {state.phase === 'typing' ? doneButton : null}
          <Button label={copy.skip.cta} tone="ghost" size="md" fullWidth onPress={skip} testID="type-hangul-skip" />
        </View>
      ) : null}
    </View>
  );

  // A phone (and any short window) gets the keyboard edge to edge, so the screen has no width cap there.
  return (
    <Screen tone="canvas" padded={false} width={phone ? 'bleed' : 'reading'} footer={footer} testID="type-hangul">
      <View style={{ paddingHorizontal: lc.gutter, paddingTop: compactRow ? spacing.sm : spacing.md, paddingBottom: spacing.sm }}>
        {header}
      </View>
    </Screen>
  );
}

interface ResultPanelProps {
  state: TypeHangulState;
  round: TypeHangulRound;
  width: number;
  /** The keyboard's height: the panel takes its place, so nothing jumps. */
  height: number;
  gutter: number;
  /** Hoya's line, focused when the panel opens. */
  panelRef: React.MutableRefObject<Focusable | null>;
  onFix: () => void;
}

/** After Done: Hoya's line, and on a miss the block compare, the word and Fix it (type-hangul.md "After Done"). */
function ResultPanel({ state, round, width, height, gutter, panelRef, onFix }: ResultPanelProps): React.ReactElement {
  const m = useMessages();
  const t = m.learner.minigame.typeHangul;
  const k = m.a11y.minigame.keyboard;
  const score = state.score;
  const passed = state.phase === 'pass';
  const line = passed ? t.pass : score?.verdict === 'near' ? t.near : t.far;
  const blocks = score?.blocks ?? [];
  const inner = width - 2 * gutter;
  const cell = Math.max(spacing.xxl, Math.min(touchTarget.min, Math.floor((inner - (blocks.length - 1) * spacing.xs) / Math.max(blocks.length, 1))));
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
              <Caption tone="secondary">{t.typedLabel}</Caption>
              <BlockRow blocks={blocks} side="typed" cell={cell} />
              <Caption tone="secondary">{t.targetLabel}</Caption>
              <BlockRow blocks={blocks} side="target" cell={cell} />
            </View>
            <WordLine round={round} />
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
    <View style={{ flexDirection: 'row', gap: spacing.xs }} {...{ 'aria-hidden': true }} importantForAccessibility="no-hide-descendants">
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
              <Text {...koreanSpeech} style={{ fontSize: Math.round(cell * 0.5), color: colors.text.primary }}>
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

/** A word on one line, as the mock draws it: the Korean, its romanization and `· gloss`, read as one item. */
function WordLine({ round, testID }: { round: TypeHangulRound; testID?: string }): React.ReactElement {
  const m = useMessages();
  const { ko, romanization, en } = round.target;
  return (
    <View
      accessible
      accessibilityLabel={m.a11y.koreanItem({ ko, romanization, gloss: en })}
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.sm, flexShrink: 1 }}
      testID={testID}
    >
      <Text {...koreanSpeech} style={{ fontSize: typography.size.prompt, fontWeight: typography.weight.bold, color: colors.text.primary }}>
        {ko}
      </Text>
      <Text style={{ fontSize: typography.size.bodySm, fontStyle: 'italic', color: colors.text.secondary }}>{romanization}</Text>
      <Text style={{ fontSize: typography.size.bodySm, color: colors.text.secondary }}>{`· ${en}`}</Text>
    </View>
  );
}

