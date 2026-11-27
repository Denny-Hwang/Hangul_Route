import {
  Body,
  Button,
  Caption,
  Heading,
  Hoya,
  Icon,
  KOREAN_LINE_BREAK,
  Progress,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
  useLayoutClass,
  useTypeScale,
} from '@hangul-route/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { Svg, Path } from 'react-native-svg';
import { PromptPanel } from '../../components/PromptPanel';
import { StrokeHint } from '../../components/StrokeHint';
import { tracePanGesture } from '../../components/trace-pan';
import { usePromptSlot, type PromptSlot } from '../../components/use-prompt-slot';
import { strokeFormsForJamo, strokesForJamo, type JamoStrokePoint } from '../../content/jamo-strokes';
import { useMessages } from '../../i18n/use-messages';
import { traceCanvasA11yLabel, traceHeadingText, traceTargetA11yText } from '../../logic/korean-labels';
import {
  DISCOVER_AUDIO_SOURCE,
  actionSpecs,
  type DiscoverEvent,
  type DiscoverPageRender,
  type DiscoverWriteLetter,
  type DiscoverWriteRender,
} from '../../logic/stage1/discover-flow';
import { WRITE_ADVANCE_MS, writeStripLine, type WriteStripLine } from '../../logic/stage1/discover-write';
import type { TracePadPlan } from '../../logic/stage1/trace-pad-layout';
import { strokeOrderTaught } from '../../logic/stroke-order-taught';
import { inkPathD, pointsToPathD } from '../../logic/stroke-diagram';
import { TRACE_IDLE_MS, createTraceEvaluator, idleOnTouch, type TraceEvaluator } from '../../logic/trace-evaluator';
import { traceCanvasMax, traceCanvasSize } from '../../logic/trace-layout';
import { NO_TRACE_POINTERS, type CanvasPoint, type TracePointers, type TraceTouchEffect } from '../../logic/trace-pointers';
import { TRACE_KEEP_GOING_MS, isLetterFinishedInForms } from '../../logic/trace-ready';
import { hasClipFor } from '../../platform/audio';
import { success } from '../../platform/haptics';
import { announceForScreenReader, focusForScreenReader } from '../../platform/screen-reader';
import { TraceControls } from '../minigames/TraceControls';

/**
 * [TC] The trace page of Discover (AMENDMENTS-STAGE1-TRACE-COVERAGE §3.3 to §3.5, row TC-1b): "Trace the new letters". Each
 * new letter of the step is traced once on a canvas, unscored: no Done, no miss, no stars, nothing stored. A letter that is
 * finished (`isLetterFinishedInForms`, the TRACE-IDLE rule) is praised after `TRACE_IDLE_MS` and the next one comes up after
 * `WRITE_ADVANCE_MS`; Next letter passes over a letter; Continue is always there. The canvas is never inside a scroll view
 * (it owns vertical drags): this page is a fixed column above the pinned buttons, laid out by one of eight arrangements
 * (`logic/stage1/trace-pad-layout.ts`, chosen once per page).
 * Design: design/screens/discover-trace/trace-new-letters.md (mock `mock/`), wireframe quest/discover.md "[TC] Trace the new
 * letters". The canvas code is written here from the shared modules (`trace-pan`, `trace-evaluator`, `trace-ready`,
 * `stroke-diagram`, `StrokeHint`); `TraceStrokeGame.tsx` is not refactored.
 */

const VIEWBOX = 200; // jamo skeletons authored against 200x200
/** The letter chips are `spacing.xxl` squares at least. */
const CHIP = spacing.xxl;
/** A card's prompt slot, as the step reaches it to play one of the card's buttons. */
export interface PadSlot {
  play: PromptSlot['play'];
}
/** What the pad needs of the step's audio: its one prompt slot (key `write`), replay and the voice help. */
export interface PadAudio {
  register: (key: string, slot: PadSlot) => () => void;
  replay: (card: string, fallbackId: string) => void;
  onHelp: () => void;
}

export interface DiscoverTracePadProps {
  plan: TracePadPlan;
  render: DiscoverWriteRender;
  /** The step's page row: its label ("Page 3 of 3") and dots. */
  page: { label: string; dots: DiscoverPageRender['dots'] };
  dispatch: (event: DiscoverEvent) => void;
  audio: PadAudio;
  /** Previous and Continue (`StepActions`): under the page, or at the foot of the right column in `side-short`. */
  pinned: ReactNode;
  /** The page's heading texts and final flag (the longest heading holds the heading's room). */
  headings: readonly string[];
}

interface Size {
  width: number;
  height: number;
}

/** The text hidden from every reader but kept in the layout, to hold the room of a line that may come. */
const SIZER = {
  'aria-hidden': true,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants' as const,
};

/** Moves focus to a mounted view: the element's own `focus()` on the web, the screen reader's focus on iOS and Android. */
function focusNode(node: View | null): void {
  if (node === null) return;
  if (Platform.OS === 'web') (node as unknown as { focus?: () => void }).focus?.();
  else focusForScreenReader(node);
}

export function DiscoverTracePad({ plan, render, page, dispatch, audio, pinned, headings }: DiscoverTracePadProps): ReactElement {
  const m = useMessages();
  const copy = m.learner.minigame;
  const quest = m.learner.quest.discover;
  const a11y = m.a11y;
  const textScale = useTypeScale();
  const layoutClass = useLayoutClass();

  const letter = render.letters[render.at] ?? render.letters[0]!;
  const { at, last } = render;
  const jamoId = letter.jamoId;
  const target = useMemo(() => strokesForJamo(jamoId) ?? [], [jamoId]);
  const forms = useMemo(() => strokeFormsForJamo(jamoId) ?? [], [jamoId]);
  const formsRef = useRef(forms);
  formsRef.current = forms;
  // [SO] Tracing never makes a letter "taught": the gate is read here and never written (§3.7).
  const taught = strokeOrderTaught(jamoId);
  const tracePerson = { romanization: letter.romanization, kind: letter.final ? ('batchim' as const) : ('consonant' as const) };

  // ---- the sound: one prompt slot for the page, registered under the key `write` ---------------------------------------
  const specs = actionSpecs(letter.hear);
  const slot = usePromptSlot({ source: DISCOVER_AUDIO_SOURCE, hasClip: specs.every((spec) => hasClipFor(spec)), textOnScreen: true });
  const { play, reset: slotReset } = slot;
  const { register } = audio;
  useEffect(() => register('write', { play }), [register, play]);

  // ---- the drawing -------------------------------------------------------------------------------------------------
  const [strokes, setStrokesState] = useState<JamoStrokePoint[][]>([]);
  const strokesRef = useRef<JamoStrokePoint[][]>([]);
  const pointersRef = useRef<TracePointers>(NO_TRACE_POINTERS);
  const gateRef = useRef<TraceEvaluator | null>(null);
  const evaluateRef = useRef<() => void>(() => undefined);
  // The letter finished (praise shows): the canvas takes no ink until the next letter, or Clear on the last one.
  const [praised, setPraised] = useState(false);
  const praisedRef = useRef(false);
  const [keepGoing, setKeepGoing] = useState(false);
  const keepGoingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hintToken, setHintToken] = useState(0);
  const [hintPlaying, setHintPlaying] = useState(false);
  const [slotBox, setSlotBox] = useState<Size | null>(null);
  const headingRef = useRef<View | null>(null);
  const focusHeading = useRef(false);
  const padFocus = useRef(false);

  const atRef = useRef(at);
  atRef.current = at;
  const lastRef = useRef(last);
  lastRef.current = last;
  const letterRef = useRef(letter);
  letterRef.current = letter;

  const stopKeepGoing = (): void => {
    if (keepGoingTimer.current) clearTimeout(keepGoingTimer.current);
    keepGoingTimer.current = null;
  };
  const stopAdvance = (): void => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
  };

  // The gate is created once: its ready() reads the letter's forms through a ref. Strict mode is never on here (§3.3).
  useEffect(() => {
    const gate = createTraceEvaluator({
      idleMs: TRACE_IDLE_MS,
      onEvaluate: () => evaluateRef.current(),
      ready: () => isLetterFinishedInForms(formsRef.current, strokesRef.current, false),
    });
    gateRef.current = gate;
    return () => {
      gate.dispose();
      gateRef.current = null;
      stopKeepGoing();
      stopAdvance();
    };
  }, []);

  // A new letter: an empty canvas, the idle line, an open gate, no timer of the last one. Nothing plays by itself (§3.3).
  useEffect(() => {
    gateRef.current?.nextRound();
    strokesRef.current = [];
    setStrokesState([]);
    pointersRef.current = NO_TRACE_POINTERS;
    praisedRef.current = false;
    setPraised(false);
    stopKeepGoing();
    setKeepGoing(false);
    stopAdvance();
    setHintToken(0);
    setHintPlaying(false);
    slotReset();
    if (focusHeading.current) {
      focusHeading.current = false;
      focusNode(headingRef.current);
    }
  }, [at, slotReset]);

  const setStrokes = (next: JamoStrokePoint[][]): void => {
    strokesRef.current = next;
    setStrokesState(next);
  };

  // §3.3: every finger up on ink that is not a finished letter; after TRACE_KEEP_GOING_MS the line names the way on. A
  // finished letter needs no line: the idle check praises it.
  const armKeepGoing = (): void => {
    stopKeepGoing();
    if (praisedRef.current || strokesRef.current.length === 0) return;
    if (isLetterFinishedInForms(formsRef.current, strokesRef.current, false)) return;
    keepGoingTimer.current = setTimeout(() => {
      keepGoingTimer.current = null;
      setKeepGoing(true);
      // iOS has no live regions: VoiceOver is told once per pause here (a no-op elsewhere).
      announceForScreenReader(lastRef.current ? quest.write.keepGoingLast : quest.write.keepGoing);
    }, TRACE_KEEP_GOING_MS);
  };

  // The gate fired on a finished letter: praise it, mark the chip, and (not the last letter) move on after the beat.
  // Nothing is scored, answered or stored; the only record is the page's own `traced` set (the step's `written`).
  evaluateRef.current = (): void => {
    if (strokesRef.current.length === 0) {
      gateRef.current?.reopen();
      return;
    }
    stopKeepGoing();
    setKeepGoing(false);
    success();
    praisedRef.current = true;
    setPraised(true);
    announceForScreenReader(copy.trace.pass.clean);
    dispatch({ type: 'traced', jamoId: letterRef.current.jamoId });
    if (!lastRef.current) {
      const from = atRef.current;
      stopAdvance();
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        if (padFocus.current) focusHeading.current = true;
        dispatch({ type: 'writeNext', from });
      }, WRITE_ADVANCE_MS);
    }
  };

  const toViewBoxPoint = ({ x, y }: CanvasPoint, size: number): JamoStrokePoint => ({ x: (x * VIEWBOX) / size, y: (y * VIEWBOX) / size });
  const canvasSizeRef = useRef(0);
  const appendStrokePoint = (point: JamoStrokePoint): void => {
    const prev = strokesRef.current;
    setStrokes([...prev.slice(0, -1), [...(prev[prev.length - 1] ?? []), point]]);
  };
  // One finger draws; a dot or a resting palm leaves no ink (logic/trace-pointers). A letter that shows praise takes no ink.
  const onTouchEffect = (effect: TraceTouchEffect): void => {
    if (praisedRef.current) return;
    const size = canvasSizeRef.current || VIEWBOX;
    if (effect.kind === 'hold') {
      stopKeepGoing();
    } else if (effect.kind === 'start') {
      setKeepGoing(false);
      setStrokes([...strokesRef.current, [toViewBoxPoint(effect.from, size), toViewBoxPoint(effect.to, size)]]);
    } else if (effect.kind === 'point') {
      appendStrokePoint(toViewBoxPoint(effect.at, size));
    } else if (effect.kind === 'drop') {
      setStrokes(strokesRef.current.slice(0, -1));
    }
    idleOnTouch(gateRef.current, effect.kind, strokesRef.current.length > 0);
    if (effect.kind === 'end' || (effect.kind === 'release' && strokesRef.current.length > 0)) armKeepGoing();
  };
  const panGesture = tracePanGesture(pointersRef, { onEffect: onTouchEffect, onFingerDown: noop, onFingerUp: noop });

  // Clear: the ink goes, the gate is open again (TRACE-IDLE §3.3), the line is idle. It is off during the advance beat.
  const handleClear = (): void => {
    if (advanceTimer.current !== null) return;
    setStrokes([]);
    praisedRef.current = false;
    setPraised(false);
    stopKeepGoing();
    setKeepGoing(false);
    gateRef.current?.clear();
    gateRef.current?.reopen();
  };
  const handleNext = (): void => {
    if (advanceTimer.current !== null || last) return;
    focusHeading.current = true;
    dispatch({ type: 'writeNext', from: at });
  };
  // Show me and Hear it say the same thing: the card's own sound (OD-TC-10), through the page's one prompt slot.
  const hear = (): void => dispatch({ type: 'hear', id: letter.hear.id });
  const showMe = (): void => {
    setHintToken((t) => t + 1);
    setHintPlaying(true);
    hear();
  };

  const beat = praised && !last;
  const shapeHintUp = hintPlaying && !taught;
  const line = writeStripLine({ traced: praised, keepGoing, hintUp: shapeHintUp, last });
  const texts: Record<WriteStripLine, string> = {
    praise: copy.trace.pass.clean,
    keepGoing: quest.write.keepGoing,
    keepGoingLast: quest.write.keepGoingLast,
    shapeGuide: copy.trace.shapeGuide,
    idle: quest.write.idle,
  };
  const said = line === 'praise' || line === 'keepGoing' || line === 'keepGoingLast';

  // ---- sizes -------------------------------------------------------------------------------------------------------
  const canvasSize = slotBox ? traceCanvasSize(slotBox.width, slotBox.height, traceCanvasMax(layoutClass)) : 0;
  canvasSizeRef.current = canvasSize;
  const side = plan.side;
  const gap = plan.dotsInHeader && !side ? spacing.sm : spacing.md;

  // The heading keeps the room of the page's longest heading (invisible copy), and a page with a final keeps the final's line.
  const longest = headings.reduce((a, b) => (b.length > a.length ? b : a), '');
  const pageHasFinal = render.letters.some((l) => l.final);
  const summary = a11y.discoverWriteProgress(render.traced.length, render.letters.length);
  const chips = (
    <View testID="discover-write-chips" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}>
      {render.letters.map((l, i) => (
        <Chip key={l.jamoId} letter={l} now={i === at} done={render.traced.includes(l.jamoId)} size={textScale.size.bodyLg} />
      ))}
    </View>
  );
  // The letter row is decorative: hidden from screen readers behind one summary (a visually hidden line), never buttons.
  const chipsRow = plan.chips ? (
    <View>
      <View style={HIDDEN_LINE}>
        <Text {...KOREAN_LINE_BREAK} testID="discover-write-summary">{summary}</Text>
      </View>
      <View {...SIZER} testID="discover-write-chip-row">{chips}</View>
    </View>
  ) : null;

  const headingText = traceHeadingText(tracePerson, copy.trace);
  const headingA11y = traceTargetA11yText(tracePerson, a11y.minigame, a11y.romanizationOr) + (plan.chips ? '' : `. ${summary}`);
  const headingBlock = (
    <View>
      <View
        ref={headingRef}
        accessible
        accessibilityRole="header"
        accessibilityLabel={headingA11y}
        testID="discover-write-heading"
        // Web: focusable by script only, so it is not a Tab stop (focus lands here after Next letter).
        {...(Platform.OS === 'web' ? { tabIndex: -1 as const } : {})}
      >
        <View>
          <View {...SIZER} style={{ opacity: 0 }}>
            <Heading level="prompt">{longest}</Heading>
          </View>
          <View style={ABSOLUTE_FILL}>
            <Heading level="prompt">{headingText}</Heading>
          </View>
        </View>
      </View>
      {pageHasFinal ? (
        <View style={{ marginTop: spacing.xs }} testID="discover-write-final-line">
          {letter.final ? (
            <Body tone="secondary">{quest.batchimLine}</Body>
          ) : (
            <View {...SIZER} style={{ opacity: 0 }}>
              <Body tone="secondary">{quest.batchimLine}</Body>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
  const headRow = plan.chips && !plan.chipsOwnRow ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: spacing.md, rowGap: spacing.xs }}>
      {headingBlock}
      {chipsRow}
    </View>
  ) : (
    headingBlock
  );
  const pageRow = plan.pageRow ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Caption tone="secondary">{page.label}</Caption>
      <Progress
        variant="dots"
        value={page.dots.value}
        max={page.dots.max}
        tone="primary"
        testID="discover-page-dots"
        {...(page.dots.current === undefined ? {} : { current: page.dots.current, accessibilityValueText: page.label })}
      />
    </View>
  ) : (
    // Where the page row is not drawn its label stays for screen readers, before the heading.
    <View style={HIDDEN_LINE}>
      <Text {...KOREAN_LINE_BREAK} testID="discover-write-page-label">{page.label}</Text>
    </View>
  );
  const band = (
    <View style={{ gap: spacing.sm }}>
      {pageRow}
      {plan.chips && plan.chipsOwnRow ? chipsRow : null}
      {headRow}
    </View>
  );

  const canvas =
    canvasSize > 0 ? (
      <GestureDetector gesture={panGesture}>
        <View
          nativeID="trace-canvas"
          accessibilityLabel={shapeHintUp && !taught ? undefined : traceCanvasA11yLabel(letter.romanization, a11y.minigame.traceCanvas, a11y.romanizationOr)}
          style={{
            width: canvasSize,
            height: canvasSize,
            borderRadius: radii.xxl,
            backgroundColor: praised ? colors.feedback.successLight : colors.brand.primaryLight,
            borderWidth: borderWidth.thick,
            borderColor: praised ? colors.feedback.success : colors.brand.primary,
            overflow: 'hidden',
          }}
        >
          <Svg width={canvasSize} height={canvasSize} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
            {/* [SO] The ghost steps aside while the shape reveal is up, so the letter can be seen appearing. */}
            {shapeHintUp
              ? null
              : target.map((stroke, i) => (
                  <Path
                    key={`tgt-${i}`}
                    d={pointsToPathD(stroke)}
                    stroke={colors.text.primary}
                    strokeOpacity={0.12}
                    strokeWidth={18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
            {strokes.map((stroke, i) => (
              <Path
                key={`drawn-${i}`}
                d={inkPathD(stroke)}
                stroke={colors.text.primary}
                strokeWidth={8}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            ))}
          </Svg>
          {hintPlaying ? (
            <StrokeHint
              target={target}
              size={canvasSize}
              viewBox={VIEWBOX}
              playToken={hintToken}
              orderTaught={taught}
              romanization={letter.romanization}
              onComplete={() => setHintPlaying(false)}
            />
          ) : null}
        </View>
      </GestureDetector>
    ) : null;

  const hearButton = (
    <Button
      label={quest.hearIt.cta}
      accessibilityLabel={a11y.hearItLabel(letter.final ? a11y.discoverFinal(letter.romanization) : a11y.discoverLetter(letter.romanization))}
      tone="secondary"
      size="sm"
      leading={<Icon name="speaker" size={spacing.xl} />}
      onPress={hear}
      testID="discover-write-hear"
    />
  );
  const showMeButton = <Button label={copy.trace.showMe.cta} tone="secondary" size="sm" softDisabled={hintPlaying} onPress={showMe} testID="discover-write-show-me" />;
  const clearButton = <Button label={copy.trace.clear.cta} tone="ghost" size="sm" softDisabled={strokes.length === 0 || beat} onPress={handleClear} testID="discover-write-clear" />;
  // On the last letter Next letter is gone but its place stays, empty (never a transparent Button, which stays focusable).
  const nextButton = last ? (
    <View
      {...SIZER}
      pointerEvents="none"
      style={{ opacity: 0, minHeight: touchTarget.min, minWidth: touchTarget.min, paddingHorizontal: spacing.lg, justifyContent: 'center' }}
      testID="discover-write-next-place"
    >
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.bodySm, fontWeight: typography.weight.semibold }}>{quest.write.next.cta}</Text>
    </View>
  ) : (
    <Button label={quest.write.next.cta} tone="ghost" size="sm" softDisabled={beat} onPress={handleNext} testID="discover-write-next" />
  );

  // Hoya's strip (TraceFeedback's look), outside any scroll, holding the height of the tallest line it can show.
  const sizerLine = [texts.praise, texts.keepGoing, texts.keepGoingLast, texts.idle, texts.shapeGuide].reduce((a, b) => (b.length > a.length ? b : a), '');
  const stripMin = touchTarget.min + 2 * borderWidth.base;
  const bgStrip = line === 'praise' ? colors.feedback.successLight : colors.surface.paper;
  const borderStrip = line === 'praise' ? colors.feedback.success : colors.border.subtle;
  const statusShown = slot.view.statusShown;
  const strip = (
    <View style={{ minHeight: stripMin }}>
      {statusShown ? null : (
        <View style={{ minHeight: stripMin, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.lg, borderWidth: borderWidth.base, borderColor: borderStrip, backgroundColor: bgStrip, overflow: 'hidden' }}>
          {plan.roomy ? <Hoya pose={line === 'praise' ? 'cheering' : 'idle'} size={40} /> : null}
          <View style={{ flex: 1 }}>
            <Body weight="semibold" size="sm" {...SIZER} style={{ opacity: 0 }}>
              {sizerLine}
            </Body>
            <View style={ABSOLUTE_FILL_CENTER}>
              {/* One polite region, always mounted, holds only the lines that are said (praise, keep going); the idle line and
                  "Shape guide" sit beside it, unannounced. */}
              <View accessibilityLiveRegion="polite" testID="discover-write-live-line">
                {said ? (
                  <Body weight="semibold" size="sm">
                    {texts[line]}
                  </Body>
                ) : null}
              </View>
              {said ? null : (
                <Body weight="semibold" size="sm" testID="discover-write-line">
                  {texts[line]}
                </Body>
              )}
            </View>
          </View>
        </View>
      )}
      {/* A play that cannot sound: the slot's status row takes the strip's place (and at least its height). The panel's own
          polite region is mounted from the start, so the line is announced when it appears. */}
      <View style={statusShown ? { minHeight: stripMin, justifyContent: 'center', borderRadius: radii.lg, borderWidth: borderWidth.base, borderColor: colors.border.subtle, backgroundColor: colors.surface.paper, paddingHorizontal: spacing.md } : undefined}>
        <PromptPanel
          variant="status"
          compact
          view={slot.view}
          onAction={(action) => slot.act(action, () => audio.replay('write', letter.hear.id))}
          onHelp={audio.onHelp}
          testID="discover-sound-write"
        />
      </View>
    </View>
  );

  const buttonRow = (children: ReactNode): ReactElement => (
    <TraceControls scrolls testID="discover-write-controls">
      <View style={{ flexDirection: 'row', flexWrap: side && plan.dotsInHeader ? 'nowrap' : 'wrap', justifyContent: 'center', gap: spacing.sm }}>{children}</View>
    </TraceControls>
  );
  const controls = buttonRow(
    plan.helpersBeside ? (
      <>
        {clearButton}
        {nextButton}
      </>
    ) : (
      <>
        {hearButton}
        {showMeButton}
        {clearButton}
        {nextButton}
      </>
    ),
  );

  const canvasSlot = (
    <View
      testID="discover-write-canvas-slot"
      onLayout={(e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setSlotBox((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
      }}
      style={{ flex: 1, minHeight: 0, minWidth: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      {canvas}
    </View>
  );

  const focusProps =
    Platform.OS === 'web'
      ? ({
          onFocus: () => {
            padFocus.current = true;
          },
          onBlur: () => {
            padFocus.current = false;
          },
        } as object)
      : {};

  if (side) {
    const columnStyle = { width: plan.columnWidth > 0 ? plan.columnWidth : undefined, justifyContent: plan.dotsInHeader ? ('flex-end' as const) : ('center' as const), gap: plan.dotsInHeader ? spacing.xs : spacing.sm, minHeight: 0 };
    return (
      <View testID="discover-write" style={{ flex: 1, minHeight: 0 }} {...focusProps}>
        {/* The column first in reading order (heading before canvas); row-reverse draws the canvas on the left. */}
        <View style={{ flex: 1, minHeight: 0, flexDirection: 'row-reverse', gap: spacing.lg }}>
          <View style={columnStyle}>
            {band}
            {strip}
            {controls}
            {plan.dotsInHeader ? pinned : null}
          </View>
          {canvasSlot}
        </View>
        {plan.dotsInHeader ? null : pinned}
      </View>
    );
  }
  return (
    <View testID="discover-write" style={{ flex: 1, minHeight: 0 }} {...focusProps}>
      <View style={{ flex: 1, minHeight: 0, gap }}>
        {band}
        <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap }}>
          {canvasSlot}
          {plan.helpersBeside ? (
            <View style={{ justifyContent: 'center', gap: spacing.sm }}>
              {hearButton}
              {showMeButton}
            </View>
          ) : null}
        </View>
        {strip}
        {controls}
      </View>
      {pinned}
    </View>
  );
}

const noop = (): void => undefined;
/** Text a screen reader reads and the eye does not: one line, one pixel. */
const HIDDEN_LINE = { position: 'absolute' as const, width: 1, height: 1, overflow: 'hidden' as const, opacity: 0 };
const ABSOLUTE_FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
const ABSOLUTE_FILL_CENTER = { ...ABSOLUTE_FILL, justifyContent: 'center' as const };

/** One chip of the letter row: the glyph in a square; ringed for the letter shown, filled and checked once traced. It only fills. */
function Chip({ letter, now, done, size }: { letter: DiscoverWriteLetter; now: boolean; done: boolean; size: number }): ReactElement {
  return (
    <View
      testID={`discover-write-chip-${letter.jamoId}`}
      style={{
        minWidth: CHIP,
        minHeight: CHIP,
        paddingHorizontal: spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.sm,
        borderWidth: now ? borderWidth.thick : borderWidth.base,
        borderColor: now ? colors.brand.primary : done ? colors.feedback.success : colors.border.subtle,
        backgroundColor: done ? colors.feedback.successLight : colors.surface.paper,
      }}
    >
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: size, fontWeight: typography.weight.semibold, lineHeight: size * typography.leading.tight, color: colors.text.primary }}>{letter.glyph}</Text>
      {done ? (
        <View
          testID={`discover-write-done-${letter.jamoId}`}
          style={{ position: 'absolute', right: -spacing.xs, top: -spacing.xs, width: spacing.lg, height: spacing.lg, borderRadius: radii.circle, backgroundColor: colors.feedback.successDark, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="check" size={spacing.md} color={colors.surface.paper} />
        </View>
      ) : null}
    </View>
  );
}
