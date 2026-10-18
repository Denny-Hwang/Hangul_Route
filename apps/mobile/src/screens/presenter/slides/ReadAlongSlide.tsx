import { Icon, colors, koreanTextLabel, presenter, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import type { SpokenLine } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { readAlongView, type PartView } from '../../../logic/lecture/slide-view';
import { TURN_MAX_SHARE, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_RADIUS } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { KindLabel, RomGloss, useFitLevel } from './ReadingParts';
import { revealProps } from './reveal';

type ReadAlongBody = Extract<Slide, { kind: 'read-along' }>;

/**
 * Compact levels of a long exchange (`useFitLevel`): 1 draws each line's romanization and meaning
 * as one run at `presenter.size.caption`; 2 also draws the line at `presenter.size.body`.
 */
const MAX_LEVEL = 2;

/**
 * Read along slide (design/screens/presenter/slide-read-along.md, V6; AMENDMENTS-LECTURE-V2 section
 * 5.2, LV-S1): the kind label, then the two turns as bubbles, speaker A at the left and B at the
 * right (each at most 78 % of the width): the speaker's name, the line at `presenter.size.prompt`,
 * its romanization and meaning on one row. There is no stage speaker: the bar's Sound (and `S`)
 * plays the current line (the last one shown), and while it plays (`playing`) that bubble gets a
 * `spacing.sm`-unit `brand.secondary` border, the `brand.secondaryLight` ground and the speaker glyph
 * before the name (shape, not colour alone); its text turns `text.primary`. The light switches
 * without a fade. Builds `line`, `line`; with `romanization: 'tap'` each romanization one build
 * after its line. A long exchange fits itself, one compact level at a time.
 */
export function ReadAlongSlide({ slide, reveal, playing }: { slide: ReadAlongBody; reveal: number; playing?: number | null }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const fit = useFitLevel(MAX_LEVEL);
  const view = readAlongView(slide, reveal);
  return (
    <View testID="presenter-read-along" style={{ flex: 1, gap: units(unit, spacing.md) }}>
      <KindLabel text={messages.learner.presenter.slide.readAlong.label} testID="presenter-kind-label" />
      <View onLayout={fit.onRoom} style={{ flex: 1, minHeight: 0, justifyContent: 'center' }}>
        <View onLayout={fit.onContent} role="list" {...{ dataSet: { fit: String(fit.level) } }} style={{ gap: units(unit, spacing.md) }}>
          {slide.lines.map((line, i) => (
            <Turn key={i} line={line} side={i % 2 === 0 ? 'a' : 'b'} view={view.lines[i]!} lit={playing === i && view.lines[i]!.shown} level={fit.level} />
          ))}
        </View>
      </View>
    </View>
  );
}

function Turn({ line, side, view, lit, level }: { line: SpokenLine & { speaker: string }; side: 'a' | 'b'; view: PartView; lit: boolean; level: number }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const bodySize = size(presenter.size.body);
  const captionSize = size(presenter.size.caption);
  const border = Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER));
  // The lit border is thicker; the padding gives back the difference, so lighting moves nothing.
  const ring = lit ? Math.max(border, units(unit, spacing.sm)) : border;
  // The speaker glyph is one caption line tall, so lighting a line never makes it taller.
  const glyph = units(unit, spacing.xxl);
  const hidden = revealProps(view.shown);
  const secondary = lit ? colors.text.primary : colors.text.secondary;
  return (
    <View
      testID="presenter-read-along-line"
      role="listitem"
      aria-hidden={hidden['aria-hidden']}
      accessibilityLabel={`${line.speaker}: ${view.rom ? koreanTextLabel(line.ko, line.romanization) : line.ko}, ${line.gloss}`}
      style={[
        {
          maxWidth: TURN_MAX_SHARE,
          alignSelf: side === 'a' ? 'flex-start' : 'flex-end',
          gap: units(unit, spacing.xs),
          paddingVertical: units(unit, spacing.lg) - (ring - border),
          paddingHorizontal: units(unit, spacing.xxl) - (ring - border),
          borderWidth: ring,
          borderColor: lit ? colors.brand.secondary : colors.border.strong,
          borderRadius: units(unit, STAGE_RADIUS),
          backgroundColor: lit ? colors.brand.secondaryLight : colors.surface.paper,
        },
        hidden.style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: units(unit, spacing.sm), minHeight: glyph }}>
        {lit ? (
          <View aria-hidden testID="presenter-read-along-playing">
            <Icon name="speaker" size={glyph} color={colors.brand.secondaryDark} />
          </View>
        ) : null}
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: captionSize, fontWeight: typography.weight.semibold, color: secondary }}>{line.speaker}</Text>
      </View>
      <TaughtKo size={size(level >= 2 ? presenter.size.body : presenter.size.prompt)}>{line.ko}</TaughtKo>
      {level >= 1 ? (
        <RomGloss romanization={line.romanization} gloss={line.gloss} rom={view.rom} size={captionSize} lit={lit} />
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.lg) }}>
          <View {...revealProps(view.rom)}>
            <Text {...KOREAN_LINE_BREAK} style={{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: secondary }}>{line.romanization}</Text>
          </View>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: bodySize, color: colors.text.primary }}>{line.gloss}</Text>
        </View>
      )}
    </View>
  );
}
