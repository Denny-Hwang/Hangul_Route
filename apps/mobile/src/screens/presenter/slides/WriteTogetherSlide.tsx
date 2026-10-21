import { Icon, colors, presenter, radii, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import type { RomanizationMode } from '@hangul-route/content-schema';
import React from 'react';
import { Platform, Text, View, type TextStyle } from 'react-native';
import { PictureArt } from '../../../components/PictureArt';
import type { FrameText, SheetText } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { soundTablePage, writeView, type WriteView } from '../../../logic/lecture/slide-view';
import { PIC_MD, SOUND_CELL_BORDER, SOUND_CELL_EM, SOUND_CELL_W, TRACE_SIDE_MIN, TRACE_STROKE, WRITE_ICON, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { GapBox, KindLabel, useChipStyle, useFitLevel } from './ReadingParts';
import { revealProps } from './reveal';

export type WriteTogetherBody = Extract<Slide, { kind: 'write-together' }>;

/**
 * Compact levels (`useFitLevel`), for a long frame, two word banks or the name round's sound table on
 * a small stage: 1 draws the Korean of a frame, a target and an example one size down (`title` to
 * `prompt`, `prompt` to `body`), the trace ghost at `presenter.size.display`, and lets each block of the
 * sound table take only its own width; 2 draws the table's blocks (no side padding, the rows on one shared
 * outline) and every part's gaps tight. Never
 * below the stage text floor (18 px).
 */
const MAX_LEVEL = 2;

/**
 * Write together slide (design/screens/presenter/slide-write-together.md, V10-V12; AMENDMENTS-LECTURE-V2
 * sections 5.1 to 5.3, LV-D8, LV-S4). One row at the top: the kind label and, with the pencil, "Write on
 * paper or on your own device. Nothing is typed here." Then the variant's own line and its parts:
 * - type: the prompt in the slide language, the target's meaning under it (the cue) and its picture; at
 *   the answer build the target in Korean and its romanization.
 * - trace: the word as a large outline ghost (V11), the line beside it; at the answer build its
 *   romanization and meaning.
 * - frame: the frame with its gap box ("gap"), its romanization and meaning; the word banks as chips;
 *   "For example" with the frame filled by each bank's first word.
 * - own name: the frame, then each page of the sound table in its place, every block with its
 *   romanization (V12). No name is ever typed, shown or stored.
 * With `romanization: 'tap'` the romanization waits for the answer build. A part not reached keeps
 * its space and is not read; every swap is instant. Nothing here takes input, and no timer starts.
 */
export function WriteTogetherSlide({ slide, reveal, romanization }: { slide: WriteTogetherBody; reveal: number; romanization: RomanizationMode }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const fit = useFitLevel(MAX_LEVEL, unit);
  const view = writeView(slide, reveal, romanization);
  const m = messages.learner.presenter.slide.write;
  const gap = units(unit, fit.level >= 2 ? spacing.xs : spacing.md);
  return (
    <View testID="presenter-write" {...{ dataSet: { variant: slide.variant } }} style={{ flex: 1, gap }}>
      <WriteHead title={m.title} where={m.where} />
      <View onLayout={fit.onRoom} style={{ flex: 1, minHeight: 0 }}>
        <View ref={fit.contentRef} onLayout={fit.onContent} testID="presenter-write-content" {...{ dataSet: { fit: String(fit.level) } }} style={{ gap }}>
          {slide.variant === 'type' ? (
            <TypeParts slide={slide} view={view} line={m.type} level={fit.level} />
          ) : slide.variant === 'trace' ? (
            <TraceParts slide={slide} view={view} line={m.trace} level={fit.level} />
          ) : slide.variant === 'frame' ? (
            <FrameParts slide={slide} view={view} line={m.frame} example={m.example} level={fit.level} />
          ) : (
            <OwnNameParts slide={slide} view={view} line={m.ownName} level={fit.level} />
          )}
        </View>
      </View>
    </View>
  );
}

type Variant<V extends WriteTogetherBody['variant']> = Extract<WriteTogetherBody, { variant: V }>;

const lineOf = (size: number, leading: number = typography.leading.tight): number => Math.round(size * leading);

/** The row every write slide starts with (V10): the kind label, then the pencil and the "nothing is typed here" line, wrapping as one row. */
function WriteHead({ title, where }: { title: string; where: string }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const caption = size(presenter.size.caption);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: units(unit, spacing.xl), rowGap: units(unit, spacing.xs) }}>
      <KindLabel text={title} testID="presenter-kind-label" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, spacing.sm), flexShrink: 1 }}>
        <Icon name="pencil" size={Math.max(caption, units(unit, WRITE_ICON))} color={colors.text.primary} />
        <Text {...KOREAN_LINE_BREAK} testID="presenter-write-where" style={{ flexShrink: 1, fontSize: caption, lineHeight: lineOf(caption), color: colors.text.primary }}>
          {where}
        </Text>
      </View>
    </View>
  );
}

/** A variant's own line at `presenter.size.body`, semibold. */
function VariantLine({ text }: { text: string }): React.ReactElement {
  const size = useStageText();
  const body = size(presenter.size.body);
  return (
    <Text {...KOREAN_LINE_BREAK} testID="presenter-write-variant" style={{ fontSize: body, lineHeight: lineOf(body), fontWeight: typography.weight.semibold, color: colors.text.primary }}>
      {text}
    </Text>
  );
}

/** A romanization line (`text.secondary`, semibold) and a meaning line, as the reading slides draw them. */
function RomLine({ text, size, shown, testID }: { text: string; size: number; shown: boolean; testID?: string }): React.ReactElement {
  return (
    <View {...revealProps(shown)}>
      <Text {...KOREAN_LINE_BREAK} testID={testID} style={{ fontSize: size, lineHeight: lineOf(size), fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
        {text}
      </Text>
    </View>
  );
}

function GlossLine({ text, size, testID }: { text: string; size: number; testID?: string }): React.ReactElement {
  return (
    <Text {...KOREAN_LINE_BREAK} testID={testID} style={{ fontSize: size, lineHeight: lineOf(size), color: colors.text.primary }}>
      {text}
    </Text>
  );
}

/** Type Hangul: the line, the prompt, the target's meaning (the cue) and its picture; the target in Korean and its romanization at the answer build. */
function TypeParts({ slide, view, line, level }: { slide: Variant<'type'>; view: WriteView; line: string; level: number }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const prompt = size(level >= 1 ? presenter.size.body : presenter.size.prompt);
  const answer = revealProps(view.answer);
  return (
    <>
      <VariantLine text={line} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP) }}>
        <View style={{ flex: 1, minWidth: 0, gap: units(unit, STAGE_GAP_INNER) }}>
          <Text {...KOREAN_LINE_BREAK} testID="presenter-write-prompt" style={{ fontSize: prompt, lineHeight: lineOf(prompt), fontWeight: typography.weight.bold, color: colors.text.primary }}>
            {slide.prompt}
          </Text>
          {/* The cue the room writes from, from the first build (the learner's Type Hangul always shows one). */}
          <GlossLine text={slide.answer.gloss} size={prompt} testID="presenter-write-gloss" />
          <View testID="presenter-write-answer" aria-hidden={answer['aria-hidden']} style={[answer.style, { gap: units(unit, spacing.xs) }]}>
            <TaughtKo size={size(level >= 1 ? presenter.size.prompt : presenter.size.title)} testID="presenter-write-answer-ko">
              {slide.answer.ko}
            </TaughtKo>
            <RomLine text={slide.answer.romanization} size={size(presenter.size.body)} shown={view.rom} testID="presenter-write-rom" />
          </View>
        </View>
        {slide.picture !== undefined ? (
          // The prompt names the picture, so it is not read again; it never names the answer.
          <PictureArt
            pictureRef={slide.picture}
            gloss={slide.prompt}
            decorative
            size={units(unit, PIC_MD)}
            tile={{ padding: units(unit, spacing.md), border: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)), radius: units(unit, STAGE_RADIUS) }}
            testID="presenter-write-art"
          />
        ) : null}
      </View>
    </>
  );
}

/**
 * The trace ghost (V11): the word in the presenter font drawn as an outline, a `TRACE_STROKE`-unit
 * `text.secondary` stroke with no fill (the browser's text stroke; the presenter is a web page). Off the
 * web, where no text stroke exists, the word is drawn in `text.secondary`.
 */
function ghostStyle(unit: number): TextStyle {
  const stroke = Math.max(1, units(unit, TRACE_STROKE));
  if (Platform.OS !== 'web') return { color: colors.text.secondary };
  return { color: 'transparent', WebkitTextStroke: `${stroke}px ${colors.text.secondary}`, paintOrder: 'stroke' } as unknown as TextStyle;
}

/** Trace a Word: the ghost word, and beside it the line and, at the answer build, its romanization and meaning. */
function TraceParts({ slide, view, line, level }: { slide: Variant<'trace'>; view: WriteView; line: string; level: number }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const answer = revealProps(view.answer);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: units(unit, STAGE_GAP) }}>
      <View testID="presenter-write-ghost">
        <TaughtKo size={size(level >= 1 ? presenter.size.display : presenter.size.glyph)} style={{ ...ghostStyle(unit), lineHeight: size(level >= 1 ? presenter.size.display : presenter.size.glyph) }}>
          {slide.word.ko}
        </TaughtKo>
      </View>
      <View style={{ flex: 1, minWidth: units(unit, TRACE_SIDE_MIN), gap: units(unit, STAGE_GAP_INNER) }}>
        <VariantLine text={line} />
        <View testID="presenter-write-answer" aria-hidden={answer['aria-hidden']} style={[answer.style, { gap: units(unit, spacing.xs) }]}>
          <RomLine text={slide.word.romanization} size={size(presenter.size.body)} shown testID="presenter-write-rom" />
          <GlossLine text={slide.word.gloss} size={size(presenter.size.prompt)} testID="presenter-write-gloss" />
        </View>
      </View>
    </View>
  );
}

/** A frame on the stage: its Korean with each slot as a gap box, then its romanization and meaning on one line. */
function FrameLine({ frame, rom, koSize, testID }: { frame: FrameText; rom: boolean; koSize: number; testID: string }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const body = size(presenter.size.body);
  return (
    <View testID={testID} style={{ gap: units(unit, spacing.xs) }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
        {frame.pieces.map((piece, i) => (
          <React.Fragment key={i}>
            {i > 0 ? <GapBox textSize={koSize} testID="presenter-write-gap" /> : null}
            {piece !== '' ? <TaughtKo size={koSize}>{piece}</TaughtKo> : null}
          </React.Fragment>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.lg) }}>
        <RomLine text={frame.romanization} size={body} shown={rom} testID={`${testID}-rom`} />
        <GlossLine text={frame.gloss} size={body} testID={`${testID}-gloss`} />
      </View>
    </View>
  );
}

/** A bank word as a chip: its Korean and, when shown, its romanization (no meaning: any pick is right). */
function BankChip({ word, rom, small }: { word: SheetText; rom: boolean; small: boolean }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const chip = useChipStyle();
  const caption = size(presenter.size.caption);
  return (
    <View
      testID="presenter-write-chip"
      style={{ ...chip, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.md), paddingVertical: units(unit, spacing.xs), paddingHorizontal: units(unit, spacing.lg) }}
    >
      <TaughtKo size={size(small ? presenter.size.body : presenter.size.prompt)}>{word.ko}</TaughtKo>
      <View {...revealProps(rom)}>
        {/* text.secondary misses 7:1 on brand.secondaryLight (presenter.v1.md), so the romanization is text.primary here. */}
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: caption, fontWeight: typography.weight.semibold, color: colors.text.primary }}>
          {word.romanization}
        </Text>
      </View>
    </View>
  );
}

/** Write Frame: the line, the frame, its banks (one row per slot), then "For example". */
function FrameParts({ slide, view, line, example, level }: { slide: Variant<'frame'>; view: WriteView; line: string; example: string; level: number }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const bank = revealProps(view.bank);
  const answer = revealProps(view.answer);
  const caption = size(presenter.size.caption);
  return (
    <>
      <VariantLine text={line} />
      <FrameLine frame={slide.frame} rom={view.rom} koSize={size(level >= 1 ? presenter.size.prompt : presenter.size.title)} testID="presenter-write-frame" />
      <View testID="presenter-write-bank" aria-hidden={bank['aria-hidden']} style={[bank.style, { gap: units(unit, spacing.sm) }]}>
        {slide.banks.map((words, i) => (
          <View key={i} role="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: units(unit, spacing.md) }}>
            {words.map((word) => (
              <View key={word.ko} role="listitem">
                <BankChip word={word} rom={view.rom} small={level >= 1} />
              </View>
            ))}
          </View>
        ))}
      </View>
      <View
        testID="presenter-write-example"
        aria-hidden={answer['aria-hidden']}
        style={[answer.style, { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.lg) }]}
      >
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: caption, lineHeight: lineOf(caption), fontWeight: typography.weight.bold, color: colors.text.secondary }}>
          {example}
        </Text>
        <TaughtKo size={size(level >= 1 ? presenter.size.body : presenter.size.prompt)} testID="presenter-write-example-ko">
          {slide.example.ko}
        </TaughtKo>
        <RomLine text={slide.example.romanization} size={size(presenter.size.body)} shown={view.rom} testID="presenter-write-example-rom" />
      </View>
    </>
  );
}

/**
 * The name round (V12): the line, then the frame at the first build; each later build puts one page of
 * the sound table in its place, a row per group, every block with its romanization under it.
 */
function OwnNameParts({ slide, view, line, level }: { slide: Variant<'own-name'>; view: WriteView; line: string; level: number }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  return (
    <>
      <VariantLine text={line} />
      {view.page === null ? (
        <FrameLine frame={slide.frame} rom koSize={size(level >= 1 ? presenter.size.prompt : presenter.size.title)} testID="presenter-write-frame" />
      ) : (
        <SoundTable groups={soundTablePage(slide.groups, view.page)} level={level} unit={unit} />
      )}
    </>
  );
}

/**
 * One page of the sound table: a row per group, `SOUND_CELL_W` units a block (13 across the content
 * area); at a compact level each block takes only the width of its own text (at level 2 with no side
 * padding), so a phone's text floor still fits a group of 13 on a row.
 */
function SoundTable({ groups, level, unit }: { groups: ReadonlyArray<readonly SheetText[]>; level: number; unit: number }): React.ReactElement {
  const size = useStageText();
  const caption = size(presenter.size.caption);
  const border = Math.max(STAGE_BORDER_MIN, units(unit, SOUND_CELL_BORDER));
  const leading = level >= 2 ? 1 : typography.leading.tight;
  const tight = units(unit, level >= 2 ? spacing.xxs : spacing.xs);
  return (
    // Level 2 stacks the rows on one shared outline (no gap, each row over the one above by a border), so a page of
    // five rows keeps a phone's stage when the head row wraps (a Spanish or Korean line in a Linux browser's fallback font).
    <View testID="presenter-write-table" role="list" style={{ gap: level >= 2 ? 0 : tight }}>
      {groups.map((group, g) => (
        <View key={g} testID="presenter-write-table-row" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tight, marginTop: level >= 2 && g > 0 ? -border : 0 }}>
          {group.map((block) => (
            <View
              key={block.ko}
              testID="presenter-write-cell"
              role="listitem"
              style={{
                // Level 2 drops the block's side padding too: a row of 13 at a phone's text floor (`cheo`, `chae`) then fits a wider fallback font for the romanization.
                ...(level >= 1 ? { minWidth: caption + 2 * border, paddingHorizontal: level >= 2 ? 0 : units(unit, spacing.xs) } : { width: Math.max(units(unit, SOUND_CELL_W), caption * SOUND_CELL_EM) }),
                alignItems: 'center',
                paddingVertical: level >= 2 ? 0 : units(unit, spacing.xxs),
                borderWidth: border,
                borderColor: colors.border.subtle,
                borderRadius: units(unit, radii.sm),
              }}
            >
              <TaughtKo size={caption} style={{ lineHeight: lineOf(caption, leading) }}>
                {block.ko}
              </TaughtKo>
              <Text {...KOREAN_LINE_BREAK} style={{ fontSize: caption, lineHeight: lineOf(caption, leading), fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
                {block.romanization}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
