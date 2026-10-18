import { colors, koreanTextLabel, presenter, radii, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React, { useCallback, useRef, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import type { NarrationPiece, SpokenLine } from '../../../logic/lecture/build-steps';
import { nextFitLevel } from '../../../logic/lecture/slide-view';
import { SLOT_H_EM, SLOT_W, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { revealProps } from './reveal';

/**
 * Parts the reading slides share (AMENDMENTS-LECTURE-V2 LV-S1; design/screens/presenter/lecture-v2.md):
 * the kind label at the top left (V5), a line of UI text whose `{ko:}` tokens are Korean chips (a
 * pattern's note, a realia caption), a key word chip, and a pattern's gap box. Stage units only.
 */

const reveal = (on: boolean) => ({ opacity: on ? 1 : 0 });

/** The chip look of taught Korean on the stage: `brand.secondaryLight` with a `brand.secondary` border (presenter.v1.md). */
export function useChipStyle(): { borderRadius: number; borderWidth: number; borderColor: string; backgroundColor: string } {
  const { unit } = usePresenterView();
  return {
    borderRadius: units(unit, STAGE_RADIUS),
    borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
    borderColor: colors.brand.secondary,
    backgroundColor: colors.brand.secondaryLight,
  };
}

/**
 * A slide that fits itself (`nextFitLevel`): `onRoom` goes on the box that takes the stage's room
 * (`flex: 1`), `onContent` on the content inside it, which keeps its own height. The stage remounts
 * on every slide, so each slide starts at level 0.
 */
export function useFitLevel(max: number): { level: number; onRoom: (e: LayoutChangeEvent) => void; onContent: (e: LayoutChangeEvent) => void } {
  const [level, setLevel] = useState(0);
  const room = useRef(0);
  const content = useRef(0);
  const check = useCallback(() => setLevel((now) => nextFitLevel({ room: room.current, content: content.current, level: now, max })), [max]);
  const onRoom = useCallback(
    (e: LayoutChangeEvent) => {
      room.current = e.nativeEvent.layout.height;
      check();
    },
    [check],
  );
  const onContent = useCallback(
    (e: LayoutChangeEvent) => {
      content.current = e.nativeEvent.layout.height;
      check();
    },
    [check],
  );
  return { level, onRoom, onContent };
}

/**
 * A line's romanization and meaning as one run of text (a compact level of a reading slide): the
 * romanization semibold in `text.secondary` (`text.primary` on a lit bubble), then the meaning.
 */
export function RomGloss({ romanization, gloss, rom, size, lit = false, testID }: { romanization: string; gloss: string; rom: boolean; size: number; lit?: boolean; testID?: string }): React.ReactElement {
  return (
    <Text {...KOREAN_LINE_BREAK} testID={testID} style={{ fontSize: size, lineHeight: Math.round(size * typography.leading.tight), color: colors.text.primary }}>
      <Text {...KOREAN_LINE_BREAK} aria-hidden={!rom} style={[{ fontWeight: typography.weight.semibold, color: lit ? colors.text.primary : colors.text.secondary }, reveal(rom)]}>
        {romanization}
      </Text>
      {`  ${gloss}`}
    </Text>
  );
}

/** The slide's kind at `presenter.size.caption`, top left, where the topic label sits (V5). */
export function KindLabel({ text, testID }: { text: string; testID?: string }): React.ReactElement {
  const size = useStageText();
  return (
    <Text {...KOREAN_LINE_BREAK} testID={testID} style={{ fontSize: size(presenter.size.caption), fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
      {text}
    </Text>
  );
}

/**
 * UI-language text with Korean chips inline (a pattern's note, a realia caption): each chip is the
 * token's Korean in the presenter font and its romanization (`rom`: shown; with `romanization: 'tap'`
 * one build later), named only once it shows, so a screen reader never says it early (D2).
 */
export function ChipText({ pieces, rom, small = false, testID }: { pieces: readonly NarrationPiece[]; rom: boolean; small?: boolean; testID?: string }): React.ReactElement {
  const size = useStageText();
  const chip = useChipStyle();
  // `small`: a compact level draws the line at `presenter.size.caption`.
  const bodySize = size(small ? presenter.size.caption : presenter.size.body);
  return (
    <Text {...KOREAN_LINE_BREAK} testID={testID} style={{ fontSize: bodySize, lineHeight: Math.round(bodySize * typography.leading.normal), color: colors.text.primary }}>
      {pieces.map((piece, i) =>
        'ko' in piece ? (
          <Text {...KOREAN_LINE_BREAK} key={i} testID={testID ? `${testID}-chip` : undefined} accessibilityLabel={rom ? koreanTextLabel(piece.ko, piece.romanization) : piece.ko} style={{ ...chip, ...noWrap }}>
            {' '}
            <TaughtKo size={bodySize}>{piece.ko}</TaughtKo>
            {/* text.secondary misses 7:1 on brand.secondaryLight (presenter.v1.md), so the romanization is text.primary here. */}
            <Text {...KOREAN_LINE_BREAK} aria-hidden={!rom} style={[{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: colors.text.primary }, reveal(rom)]}>
              {` ${piece.romanization} `}
            </Text>
          </Text>
        ) : (
          <React.Fragment key={i}>{piece.text}</React.Fragment>
        ),
      )}
    </Text>
  );
}

/**
 * A key word as a chip (slide-realia.md): the Korean in the presenter font, then its romanization
 * (`rom`) and its gloss at the caption size, all `text.primary` on `brand.secondaryLight`.
 * `compact` (a compact level of the realia slide): the three run as one line of text that wraps,
 * at the tight line height, with less padding, so a long meaning takes no row of its own.
 */
export function WordChip({ word, rom, compact = false, testID }: { word: SpokenLine; rom: boolean; compact?: boolean; testID?: string }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const chip = useChipStyle();
  const captionSize = size(presenter.size.caption);
  const label = rom ? `${koreanTextLabel(word.ko, word.romanization)}, ${word.gloss}` : `${word.ko}, ${word.gloss}`;
  if (compact) {
    return (
      <View
        testID={testID}
        accessibilityLabel={label}
        style={{ ...chip, flexShrink: 1, maxWidth: '100%', paddingVertical: units(unit, spacing.xxs), paddingHorizontal: units(unit, spacing.md) }}
      >
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: captionSize, lineHeight: Math.round(captionSize * typography.leading.tight), color: colors.text.primary }}>
          <TaughtKo size={size(presenter.size.body)}>{word.ko}</TaughtKo>
          <Text {...KOREAN_LINE_BREAK} aria-hidden={!rom} style={[{ fontWeight: typography.weight.bold }, reveal(rom)]}>
            {`  ${word.romanization}`}
          </Text>
          {`  ${word.gloss}`}
        </Text>
      </View>
    );
  }
  return (
    <View
      testID={testID}
      accessibilityLabel={label}
      style={{
        ...chip,
        // A chip never runs past its column: on a narrow stage its meaning wraps under its Korean.
        flexShrink: 1,
        maxWidth: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        columnGap: units(unit, spacing.md),
        paddingVertical: units(unit, spacing.xs),
        paddingHorizontal: units(unit, spacing.lg),
      }}
    >
      <TaughtKo size={size(presenter.size.body)}>{word.ko}</TaughtKo>
      <View {...revealProps(rom)}>
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: captionSize, fontWeight: typography.weight.bold, color: colors.text.primary }}>{word.romanization}</Text>
      </View>
      <Text {...KOREAN_LINE_BREAK} style={{ fontSize: captionSize, color: colors.text.primary }}>{word.gloss}</Text>
    </View>
  );
}

/**
 * A pattern's gap box (slide-pattern.md): `SLOT_W` units wide and 0.9 em of the frame's text tall,
 * `surface.sunken` with a stage border in `text.primary`; its accessible name is "gap"
 * (`a11y.presenter.slot`, section 10), never "underscore".
 */
export function GapBox({ textSize, testID }: { textSize: number; testID?: string }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const name = messages.a11y.presenter.slot;
  return (
    <View
      testID={testID}
      role="img"
      aria-label={name}
      accessibilityLabel={name}
      style={{
        width: units(unit, SLOT_W),
        height: Math.round(textSize * SLOT_H_EM),
        marginHorizontal: units(unit, spacing.xs),
        borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
        borderColor: colors.text.primary,
        borderRadius: units(unit, radii.md),
        backgroundColor: colors.surface.sunken,
      }}
    />
  );
}

/** `white-space: nowrap` (web): an inline chip never breaks between its Korean and its romanization. Not in the native text style types. */
const noWrap = { whiteSpace: 'nowrap' } as unknown as Record<string, never>;
