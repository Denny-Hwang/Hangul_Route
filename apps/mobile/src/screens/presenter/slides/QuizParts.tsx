import type { RomanizationMode } from '@hangul-route/content-schema';
import { Hoya, Icon, borderWidth, colors, presenter, radii, spacing, touchTarget, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Text, View, type ViewStyle } from 'react-native';
import type { QuizOption } from '../../../logic/lecture/build-steps';
import { markerFor } from '../../../logic/lecture/slide-view';
import { MARKER_BODY_FACTOR, PIC_OPT, units } from '../../../logic/lecture/stage-constants';
import { optionTarget } from '../../../logic/lecture/stage-gesture';
import { optionContent, optionRomShown } from '../../../logic/lecture/tools';
import { PictureArt } from '../../../components/PictureArt';
import { ShapeMarker } from '../ShapeMarker';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';

/**
 * The parts of a projected quiz (design/screens/presenter/slide-quiz.md, README D6), shared by the
 * quiz slide (PR 9) and the story check slide (PR 11): the 2 x 2 option grid with its
 * shape-and-number markers and the teacher's reveal, and the story check's "Hoya's answer" line.
 *
 * The options' romanization follows one rule for both slides (`optionRomShown`, D2): visible by
 * default, at the answer build with the teacher's `tap` setting.
 *
 * The reveal (D3, section 3.10): the correct option gets a `spacing.sm`-unit `feedback.success`
 * border, the `feedback.successLight` ground and the check mark; the others drop to
 * `presenter.dimOpacity` with every line in `text.primary`. No red, no cross, nothing tallied.
 * The options never move between builds.
 *
 * A pointed option (AMENDMENTS-PRESENTER-NAV section 7.3, owner choice O2; slide-quiz.md and
 * slide-listen-reply.md "Pointed option"): `data-pointed="true"`, a dashed `text.primary` outline
 * `STAGE_BORDER` units wide (never under `STAGE_BORDER_MIN`) drawn `spacing.sm` units outside the
 * card's own border (on one-column rows, in the middle of the row gap), and the `pin` glyph on a
 * paper disc at the marker's top right. No fill change, no `feedback` colour, no motion; an outline
 * takes no room and no taps, so nothing on the slide moves and the target boxes stay as they are.
 */

/** The 2 x 2 option grid (2 or 3 options fill it in order). */
export function QuizOptions({
  options,
  revealed,
  romanization,
  pointed = null,
  onCrowded,
}: {
  options: readonly QuizOption[];
  revealed: boolean;
  romanization: RomanizationMode;
  /** The option the presenter points at (from 1), or none (section 7.3). */
  pointed?: number | null;
  /**
   * A gloss spills out of its card even at body size, or a row of picture cards is shorter than its
   * shape marker: the slide gives the grid more room.
   */
  onCrowded?: () => void;
}): ReactElement {
  const { unit } = usePresenterView();
  const romOn = optionRomShown(romanization, revealed);
  const rows = [options.slice(0, 2), options.slice(2, 4)].filter((row) => row.length > 0);
  // A two-line question (a longer language, or the Say it box beside it) leaves the options less
  // height: the letters then shrink to fit their cards instead of spilling out (never below body).
  const [gridHeight, setGridHeight] = useState(0);
  const rowHeight = gridHeight > 0 ? (gridHeight - units(unit, STAGE_GAP_INNER) * (rows.length - 1)) / rows.length : Infinity;
  // A gloss that does not fit its card at prompt size (a long meaning on a phone's small stage)
  // steps every gloss of the grid down to body size together, so the options stay one size.
  const [glossSmall, setGlossSmall] = useState(false);
  useEffect(() => setGlossSmall(false), [unit]);
  const shrinkGloss = useCallback(() => setGlossSmall(true), []);
  return (
    <View
      role="list"
      testID="presenter-quiz-options"
      onLayout={(e) => setGridHeight(e.nativeEvent.layout.height)}
      style={{ flex: 1, minHeight: 0, gap: units(unit, STAGE_GAP_INNER) }}
    >
      {rows.map((row, r) => (
        <View key={r} style={{ flex: 1, flexDirection: 'row', gap: units(unit, STAGE_GAP) }}>
          {row.map((option, c) => (
            <OptionCard
              key={c}
              option={option}
              index={r * 2 + c}
              revealed={revealed}
              pointed={pointed === r * 2 + c + 1}
              romOn={romOn}
              rowHeight={rowHeight}
              glossSmall={glossSmall}
              onGlossOverflow={shrinkGloss}
              {...(onCrowded ? { onCrowded } : {})}
            />
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * Whether a picture card's row is too short for it (design/screens/presenter/slide-quiz.md "Notes"): a picture card
 * never draws below its marker, so a row shorter than the marker and the card's padding and border on both sides (a
 * key row that wraps above the grid, a wider fallback font) asks the slide for room, as a crowded gloss does. A pixel
 * of rounding is allowed. A row not measured yet (`Infinity` before the grid lays out) and a card with no picture are
 * never crowded by it. Lengths in pixels, as the card draws them.
 */
export function pictureCrowded({ picture, rowHeight, marker, padV, line }: { picture: boolean; rowHeight: number; marker: number; padV: number; line: number }): boolean {
  return picture && Number.isFinite(rowHeight) && rowHeight + 1 < marker + 2 * (padV + line);
}

/**
 * One option card: marker, content (`optionContent`: a letter or word at `presenter.size.display`
 * with its romanization, a gloss at `presenter.size.prompt`, or a story check's word with its gloss
 * under it) and, at the reveal, the check mark.
 */
function OptionCard({
  option,
  index,
  revealed,
  pointed,
  romOn,
  rowHeight,
  glossSmall,
  onGlossOverflow,
  onCrowded,
}: {
  option: QuizOption;
  index: number;
  revealed: boolean;
  pointed: boolean;
  romOn: boolean;
  rowHeight: number;
  glossSmall: boolean;
  onGlossOverflow: () => void;
  onCrowded?: () => void;
}): ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const correct = revealed && option.correct;
  const line = Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
  const rule = Math.max(STAGE_BORDER_MIN, units(unit, spacing.sm));
  const border = correct ? rule : line;
  const marker = markerFor(index, presenter.marker.shapes);
  const content = optionContent(option);
  const picture = option.picture;
  const padV = units(unit, spacing.md);
  const bodySize = size(presenter.size.body);
  // A lone letter fills its card up to display size; a word with its gloss under it stays at prompt size.
  const koSize =
    content.ko?.size === 'display' ? Math.max(bodySize, Math.min(size(presenter.size.display), Math.floor(rowHeight - 2 * (padV + line)))) : size(presenter.size.prompt);
  const glossSize = content.gloss?.size === 'body' || glossSmall ? bodySize : size(presenter.size.prompt);
  // The room a gloss has inside its card: the row less the padding and the border, less the Korean above it.
  const [koHeight, setKoHeight] = useState(0);
  const [glossHeight, setGlossHeight] = useState(0);
  const glossRoom = rowHeight - 2 * (padV + line) - (content.ko !== null ? koHeight + units(unit, spacing.xs) : 0);
  // Checked whenever either side changes: the grid's row height arrives after the gloss is laid out.
  const overflows = !glossSmall && glossSize > bodySize && glossHeight > glossRoom;
  const crowded =
    (glossSize === bodySize && glossHeight > glossRoom) ||
    pictureCrowded({ picture: picture !== undefined, rowHeight, marker: units(unit, MARKER_BODY_FACTOR * presenter.size.body), padV, line });
  useEffect(() => {
    if (overflows) onGlossOverflow();
  }, [overflows, onGlossOverflow]);
  useEffect(() => {
    if (crowded) onCrowded?.();
  }, [crowded, onCrowded]);
  const padH = units(unit, spacing.xl) + line - border;
  return (
    <View
      role="listitem"
      testID={`presenter-quiz-option-${index + 1}`}
      {...{ dataSet: optionData(index, pointed) }}
      style={{
        ...(pointed ? pointedOutline(unit, units(unit, spacing.sm)) : {}),
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: units(unit, STAGE_GAP_INNER),
        // The thicker border keeps the outer size: the padding gives back what the border takes.
        paddingVertical: padV + line - border,
        paddingHorizontal: padH,
        borderWidth: border,
        borderColor: correct ? colors.feedback.success : colors.border.strong,
        borderRadius: units(unit, STAGE_RADIUS),
        backgroundColor: correct ? colors.feedback.successLight : colors.surface.paper,
        opacity: revealed && !option.correct ? presenter.dimOpacity : 1,
      }}
    >
      <ShapeMarker shape={marker.shape} n={marker.n} />
      {picture !== undefined ? (
        // A listen or realia question's picture (LV-S2): `PIC_OPT` units in the neutral tile, smaller when its row is; named by its label.
        <View testID="presenter-quiz-picture" style={{ flex: 1, minWidth: 0 }}>
          <PictureArt
            pictureRef={picture}
            gloss={option.gloss ?? messages.a11y.minigame.picture}
            size={Math.max(bodySize, Math.min(units(unit, PIC_OPT), Math.floor(rowHeight - 2 * (padV + line))))}
            tile={pictureTile(unit)}
          />
        </View>
      ) : (
      <View style={{ flex: 1, minWidth: 0, gap: units(unit, spacing.xs) }}>
        {content.ko !== null ? (
          <View
            onLayout={(e) => setKoHeight(e.nativeEvent.layout.height)}
            style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: units(unit, content.ko.size === 'display' ? spacing.lg : spacing.md) }}
          >
            <TaughtKo size={koSize} style={content.ko.size === 'display' ? { lineHeight: koSize } : undefined}>
              {content.ko.text}
            </TaughtKo>
            {content.ko.romanization !== undefined ? (
              <Text {...KOREAN_LINE_BREAK}
                accessibilityElementsHidden={!romOn}
                aria-hidden={!romOn}
                style={{
                  fontSize: bodySize,
                  fontWeight: typography.weight.semibold,
                  // A dimmed or revealed option sets every line in text.primary (presenter.v1.md).
                  color: revealed ? colors.text.primary : colors.text.secondary,
                  opacity: romOn ? 1 : 0,
                }}
              >
                {content.ko.romanization}
              </Text>
            ) : null}
          </View>
        ) : null}
        {content.gloss !== null ? (
          <Text
            {...KOREAN_LINE_BREAK}
            onLayout={(e) => setGlossHeight(e.nativeEvent.layout.height)}
            style={{ fontSize: glossSize, fontWeight: typography.weight.semibold, color: colors.text.primary, lineHeight: Math.round(glossSize * typography.leading.tight) }}
          >
            {content.gloss.text}
          </Text>
        ) : null}
      </View>
      )}
      {correct ? (
        <View role="img" accessibilityLabel={messages.a11y.presenter.answerMark} testID="presenter-quiz-mark">
          <Icon name="check-circle" size={units(unit, spacing.jumbo)} color={colors.feedback.success} />
        </View>
      ) : null}
      {pointed ? <PointPin left={padH} marker={units(unit, MARKER_BODY_FACTOR * presenter.size.body)} /> : null}
    </View>
  );
}

/** An option's `dataSet`: its content-target marker (`option:n`) and, while pointed at, `data-pointed="true"`. */
function optionData(index: number, pointed: boolean): Record<string, string> {
  return pointed ? { stageTarget: optionTarget(index), pointed: 'true' } : { stageTarget: optionTarget(index) };
}

/** The pointed outline's width: `STAGE_BORDER` units, never under `STAGE_BORDER_MIN` (it would vanish on a phone or a projector). */
function pointLine(unit: number): number {
  return Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
}

/**
 * The pointed option's dashed outline, `offset` px outside the card's border (web: an outline takes
 * no layout room and no taps, follows the card's radius, and draws at once).
 */
function pointedOutline(unit: number, offset: number): ViewStyle {
  return { outlineStyle: 'dashed', outlineWidth: pointLine(unit), outlineColor: colors.text.primary, outlineOffset: offset } as unknown as ViewStyle;
}

/**
 * The pin on a pointed option (slide-quiz.md "Pointed option"): the `pin` glyph on a `surface.paper`
 * disc over the marker's top-right corner, `max(spacing.xl, presenter.size.body units)` square, so
 * the marker's numeral stays readable and the letter, word or picture beside it is never covered.
 * `left`: where the marker starts in the card (its padding); `marker`: the marker's side. Decorative:
 * the live region says which option is pointed at.
 */
function PointPin({ left, marker }: { left: number; marker: number }): ReactElement {
  const { unit } = usePresenterView();
  const side = Math.max(spacing.xl, units(unit, presenter.size.body));
  return (
    <View
      testID="presenter-quiz-pin"
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: left + marker - side * PIN_INSET,
        top: '50%',
        marginTop: -marker / 2 - side * PIN_RISE,
        width: side,
        height: side,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.circle,
        backgroundColor: colors.surface.paper,
      }}
    >
      <Icon name="pin" size={side} color={colors.text.primary} />
    </View>
  );
}

/** How far the pin's disc sits inside the marker's right edge, and above its top, as parts of the pin's side (the mock's 0.6 and 0.25). */
const PIN_INSET = 0.6;
const PIN_RISE = 0.25;

/**
 * "Hoya's answer" with a cheering Hoya; it joins the story check's question row at the reveal. `compact`
 * (a realia question's key row, narrower than a question row): Hoya at `touchTarget.min` units and the
 * words at `presenter.size.caption`, taking the width of the slot it sits in.
 */
export function AnswerLine({ shown, compact = false }: { shown: boolean; compact?: boolean }): ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  return (
    <View
      testID="presenter-quiz-answer"
      accessibilityElementsHidden={!shown}
      aria-hidden={!shown}
      style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, compact ? spacing.md : STAGE_GAP_INNER), flexShrink: compact ? 1 : 0, minWidth: 0, maxWidth: compact ? '100%' : '40%', opacity: shown ? 1 : 0 }}
    >
      <Hoya pose="cheering" size={units(unit, compact ? touchTarget.min : touchTarget.hero)} accessibilityLabel={messages.a11y.hoya('cheering')} />
      <Text {...KOREAN_LINE_BREAK} style={{ flexShrink: 1, minWidth: 0, fontSize: size(compact ? presenter.size.caption : presenter.size.body), fontWeight: typography.weight.semibold, color: colors.text.primary }}>
        {messages.learner.presenter.quiz.answer}
      </Text>
    </View>
  );
}

/**
 * A question's options one row each (lecture-v2.md V8, LV-S2: the words and sentences of a listen,
 * reply or realia question, a realia figure, and a realia question's pictures in a column too narrow
 * for the grid, each as tall as its marker): the shape-and-number marker, the Korean at
 * `presenter.size.prompt` with its romanization (D2: visible by default, at the answer build with
 * `tap`) and, at the answer build, its meaning on the same row; a figure at `presenter.size.prompt`.
 * The reveal is the grid's (D3): the correct row gets the `spacing.sm`-unit `feedback.success`
 * border, the `feedback.successLight` ground and the check mark, the others drop to
 * `presenter.dimOpacity`; no red, no cross. The thicker border grows outward into the row gap, so
 * nothing below moves. `compact` (a slide that fits itself, V8's measured fallback): the Korean at
 * `presenter.size.body` beside a marker of `presenter.size.prompt`; `small` also draws the
 * romanization and the meaning at `presenter.size.caption`.
 */
export function OptionRows({
  options,
  revealed,
  romanization,
  pointed = null,
  compact = false,
  small = false,
}: {
  options: readonly QuizOption[];
  revealed: boolean;
  romanization: RomanizationMode;
  /** The option the presenter points at (from 1), or none (section 7.3). */
  pointed?: number | null;
  compact?: boolean;
  small?: boolean;
}): ReactElement {
  const { unit } = usePresenterView();
  const romOn = optionRomShown(romanization, revealed);
  // The answer's row draws its thicker border outward (a negative margin, so no row moves); the list keeps that
  // room at its top and bottom from the first build, so the answer in the first or last row stays inside the fit.
  const grow = Math.max(STAGE_BORDER_MIN, units(unit, spacing.sm)) - Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
  return (
    <View role="list" testID="presenter-quiz-options" style={{ gap: units(unit, rowGap(compact)), paddingVertical: Math.max(0, grow) }}>
      {options.map((option, i) => (
        <OptionRow key={i} option={option} index={i} revealed={revealed} pointed={pointed === i + 1} romOn={romOn} compact={compact} small={small} />
      ))}
    </View>
  );
}

/** A picture option's neutral tile in stage units (`PictureArt`), its art never below 48 units (not 48 dp: a phone's stage is small). */
function pictureTile(unit: number): { padding: number; border: number; radius: number; minArt: number } {
  return { padding: units(unit, spacing.xs), border: Math.max(STAGE_BORDER_MIN, units(unit, borderWidth.base)), radius: units(unit, radii.md), minArt: units(unit, spacing.xxxl) };
}

/** The gap between option rows, in units. */
function rowGap(compact: boolean): number {
  return compact ? spacing.sm : spacing.md;
}

function OptionRow({
  option,
  index,
  revealed,
  pointed,
  romOn,
  compact,
  small,
}: {
  option: QuizOption;
  index: number;
  revealed: boolean;
  pointed: boolean;
  romOn: boolean;
  compact: boolean;
  small: boolean;
}): ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const correct = revealed && option.correct;
  const line = Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
  const rule = Math.max(STAGE_BORDER_MIN, units(unit, spacing.sm));
  const grow = correct ? rule - line : 0;
  const marker = markerFor(index, presenter.marker.shapes);
  const koSize = size(compact ? presenter.size.body : presenter.size.prompt);
  const bodySize = size(small ? presenter.size.caption : presenter.size.body);
  // A dimmed or revealed row sets every line in text.primary (presenter.v1.md).
  const romColor = revealed ? colors.text.primary : colors.text.secondary;
  // A picture's gloss is its name (PictureArt's), never drawn as text.
  const glossShown = revealed && option.gloss !== undefined;
  const markSide = units(unit, compact ? spacing.xxxl : spacing.jumbo);
  const padH = units(unit, spacing.xl) + line - (correct ? rule : line);
  // On one-column rows the outline sits in the middle of the gap to the next row (less what an answer's thicker border takes of it), so it never reaches that row at a phone's unit.
  const pointOffset = Math.max(0, (units(unit, rowGap(compact)) - grow - pointLine(unit)) / 2);
  return (
    <View
      role="listitem"
      testID={`presenter-quiz-option-${index + 1}`}
      {...{ dataSet: optionData(index, pointed) }}
      style={{
        ...(pointed ? pointedOutline(unit, pointOffset) : {}),
        flexDirection: 'row',
        alignItems: 'center',
        gap: units(unit, STAGE_GAP_INNER),
        paddingHorizontal: padH,
        borderWidth: correct ? rule : line,
        marginVertical: -grow,
        borderColor: correct ? colors.feedback.success : colors.border.strong,
        borderRadius: units(unit, STAGE_RADIUS),
        backgroundColor: correct ? colors.feedback.successLight : colors.surface.paper,
        opacity: revealed && !option.correct ? presenter.dimOpacity : 1,
      }}
    >
      <ShapeMarker shape={marker.shape} n={marker.n} {...(compact ? { side: presenter.size.prompt } : {})} />
      {option.picture !== undefined ? (
        // A picture option in a column too narrow for the grid (a realia question beside a wide sheet): the picture as tall as the marker.
        <View testID="presenter-quiz-picture" style={{ flex: 1, minWidth: 0, paddingVertical: units(unit, spacing.xs) }}>
          <PictureArt
            pictureRef={option.picture}
            gloss={option.gloss ?? messages.a11y.minigame.picture}
            size={units(unit, compact ? presenter.size.prompt : MARKER_BODY_FACTOR * presenter.size.body)}
            tile={pictureTile(unit)}
          />
        </View>
      ) : null}
      <View style={{ flex: option.picture !== undefined ? 0 : 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.lg), paddingVertical: units(unit, spacing.xs) }}>
        {option.ko !== undefined ? (
          <TaughtKo size={koSize} testID="presenter-quiz-option-ko">
            {option.ko}
          </TaughtKo>
        ) : null}
        {option.ko !== undefined && option.romanization !== undefined ? (
          <Text {...KOREAN_LINE_BREAK} testID="presenter-quiz-option-rom" aria-hidden={!romOn} style={{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: romColor, opacity: romOn ? 1 : 0 }}>
            {option.romanization}
          </Text>
        ) : null}
        {option.figure !== undefined ? (
          <Text {...KOREAN_LINE_BREAK} testID="presenter-quiz-option-figure" style={{ fontSize: koSize, fontWeight: typography.weight.bold, color: colors.text.primary }}>
            {option.figure}
          </Text>
        ) : null}
        {option.gloss !== undefined && option.picture === undefined ? (
          <Text {...KOREAN_LINE_BREAK} testID="presenter-quiz-option-gloss" aria-hidden={!glossShown} style={{ fontSize: bodySize, color: colors.text.primary, opacity: glossShown ? 1 : 0 }}>
            {option.gloss}
          </Text>
        ) : null}
      </View>
      {/* Every row keeps the mark's room from the first build, so the answer's mark never narrows its row and wraps its meaning (the rows would grow past the stage). */}
      {correct ? (
        <View role="img" accessibilityLabel={messages.a11y.presenter.answerMark} testID="presenter-quiz-mark">
          <Icon name="check-circle" size={markSide} color={colors.feedback.success} />
        </View>
      ) : (
        <View aria-hidden testID="presenter-quiz-mark-room" style={{ width: markSide, height: markSide }} />
      )}
      {pointed ? <PointPin left={padH} marker={units(unit, compact ? presenter.size.prompt : MARKER_BODY_FACTOR * presenter.size.body)} /> : null}
    </View>
  );
}
