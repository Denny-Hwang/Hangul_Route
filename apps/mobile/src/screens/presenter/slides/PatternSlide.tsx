import { colors, koreanTextLabel, presenter, radii, spacing, typography, KOREAN_LINE_BREAK } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import type { SpokenLine } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { patternView, type PartView } from '../../../logic/lecture/slide-view';
import { EXAMPLE_NUMBER, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { ChipText, GapBox, KindLabel, RomGloss, useFitLevel } from './ReadingParts';
import { revealProps } from './reveal';

type PatternBody = Extract<Slide, { kind: 'pattern' }>;

/**
 * Compact levels of a long pattern (`useFitLevel`): 1 draws each example's Korean at
 * `presenter.size.body` with its romanization and meaning as one run at `presenter.size.caption`;
 * 2 also draws the note and the frame's romanization line at the caption size; 3 also draws the
 * frame at `presenter.size.prompt` with `spacing.sm`-unit gaps. Never below the stage text floor.
 */
const MAX_LEVEL = 3;

/**
 * Sentence pattern slide (design/screens/presenter/slide-pattern.md; AMENDMENTS-LECTURE-V2 section
 * 5.2, LV-S1): the kind label; the frame at `presenter.size.title` with each `___` drawn as a gap
 * box named "gap", its romanization and meaning on the line under it; the note in the slide
 * language with its Korean as chips; then the two examples, one numbered row each (Korean at
 * `presenter.size.prompt`, romanization and meaning on the same row). Builds `frame`, `note`,
 * `example`, `example`; with `romanization: 'tap'` each romanization one build after its Korean.
 * Parts sit `spacing.md` units apart (`.tight`), so a two-line note and both examples fit; a longer
 * pattern (a Stage 7 frame with long examples) fits itself, one compact level at a time.
 */
export function PatternSlide({ slide, reveal }: { slide: PatternBody; reveal: number }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const fit = useFitLevel(MAX_LEVEL);
  const view = patternView(slide, reveal);
  const frameSize = size(fit.level >= 3 ? presenter.size.prompt : presenter.size.title);
  const lineSize = size(fit.level >= 2 ? presenter.size.caption : presenter.size.body);
  const gap = units(unit, fit.level >= 3 ? spacing.sm : spacing.md);
  const line = { fontSize: lineSize, lineHeight: Math.round(lineSize * typography.leading.tight) };
  return (
    <View testID="presenter-pattern" style={{ flex: 1, gap }}>
      <KindLabel text={messages.learner.presenter.slide.pattern.label} testID="presenter-kind-label" />
      <View onLayout={fit.onRoom} style={{ flex: 1, minHeight: 0 }}>
        <View onLayout={fit.onContent} testID="presenter-pattern-content" {...{ dataSet: { fit: String(fit.level) } }} style={{ gap }}>
          <View testID="presenter-pattern-frame" style={{ gap: units(unit, spacing.xs) }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
              {slide.frame.pieces.map((piece, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? <GapBox textSize={frameSize} testID="presenter-pattern-gap" /> : null}
                  {piece !== '' ? <TaughtKo size={frameSize}>{piece}</TaughtKo> : null}
                </React.Fragment>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.lg) }}>
              <View {...revealProps(view.frame.rom)}>
                <Text {...KOREAN_LINE_BREAK} testID="presenter-pattern-frame-rom" style={{ ...line, fontWeight: typography.weight.semibold, color: colors.text.secondary }}>
                  {slide.frame.romanization}
                </Text>
              </View>
              <Text {...KOREAN_LINE_BREAK} style={{ ...line, color: colors.text.primary }}>{slide.frame.gloss}</Text>
            </View>
          </View>
          {slide.note !== undefined ? (
            <View {...revealProps(view.note.shown)}>
              <ChipText pieces={slide.note} rom={view.note.rom} small={fit.level >= 2} testID="presenter-pattern-note" />
            </View>
          ) : null}
          <View role="list" style={{ gap }}>
            {slide.examples.map((example, i) => (
              <Example key={i} n={i + 1} example={example} view={view.examples[i]!} compact={fit.level >= 1} />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * One example row: its number in a 64-unit circle, the Korean, then its romanization and meaning on
 * the same row; `compact`: the Korean at `presenter.size.body`, its romanization and meaning as one
 * run under it at `presenter.size.caption`.
 */
function Example({ n, example, view, compact }: { n: number; example: SpokenLine; view: PartView; compact: boolean }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const bodySize = size(presenter.size.body);
  const box = units(unit, EXAMPLE_NUMBER);
  const hidden = revealProps(view.shown);
  return (
    <View
      testID="presenter-pattern-example"
      role="listitem"
      aria-hidden={hidden['aria-hidden']}
      accessibilityLabel={view.rom ? `${n}. ${koreanTextLabel(example.ko, example.romanization)}, ${example.gloss}` : `${n}. ${example.ko}, ${example.gloss}`}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: units(unit, spacing.xl) }, hidden.style]}
    >
      <View
        aria-hidden
        style={{
          width: box,
          height: box,
          borderRadius: radii.circle,
          borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
          borderColor: colors.text.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text {...KOREAN_LINE_BREAK} style={{ fontSize: bodySize, fontWeight: typography.weight.bold, color: colors.text.primary }}>{String(n)}</Text>
      </View>
      {compact ? (
        <View style={{ flex: 1 }}>
          <TaughtKo size={bodySize}>{example.ko}</TaughtKo>
          <RomGloss romanization={example.romanization} gloss={example.gloss} rom={view.rom} size={size(presenter.size.caption)} />
        </View>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.lg) }}>
          <TaughtKo size={size(presenter.size.prompt)}>{example.ko}</TaughtKo>
          <View {...revealProps(view.rom)}>
            <Text {...KOREAN_LINE_BREAK} style={{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: colors.text.secondary }}>{example.romanization}</Text>
          </View>
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: bodySize, color: colors.text.primary }}>{example.gloss}</Text>
        </View>
      )}
    </View>
  );
}
