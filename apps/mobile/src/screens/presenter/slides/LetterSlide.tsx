import { colors, koreanTextLabel, presenter, spacing, typography } from '@hangul-route/design-system';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { StrokeHint } from '../../../components/StrokeHint';
import { strokesForJamo } from '../../../content/jamo-strokes';
import type { BuildName } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { STROKE_DOT_RADIUS, STROKE_DOT_RING, STROKE_LINE, STROKE_PANEL, STROKE_VIEWBOX, SVG_UI_FONT, units } from '../../../logic/lecture/stage-constants';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER, STAGE_RADIUS } from '../stage-metrics';
import { buildStrokeDiagram } from '../../../logic/stroke-diagram';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { SpeakerButton } from './SpeakerButton';

type LetterBody = Extract<Slide, { kind: 'letter' }>;

/**
 * Letter slide in three columns (design/screens/presenter/slide-letter.md, README D4): the glyph
 * in the presenter font with its romanization; the stroke guide panel (`StrokeHint` at 360 units
 * over the still numbered diagram, "Simplified stroke guide" until reviewed); then the sound row,
 * the letter name and sound hint, and the example word. A build that is not reached keeps its
 * space, so nothing shifts when it appears.
 */
export function LetterSlide({
  slide,
  shown,
  strokeToken,
  onPlaySound,
}: {
  slide: LetterBody;
  /** The builds on screen (build 0 to the current reveal). */
  shown: ReadonlySet<BuildName>;
  /** Changes when the stroke guide should play (its build arrives, or R). */
  strokeToken: number;
  onPlaySound: () => void;
}): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const m = messages.learner.presenter;
  const hasStrokeBuild = slide.builds.includes('stroke');
  // With `romanization: 'tap'` the romanization is its own build; otherwise it comes with the glyph.
  const romShown = slide.builds.includes('rom') ? shown.has('rom') : shown.has('ko');
  const reveal = (on: boolean) => ({ opacity: on ? 1 : 0 });
  const promptSize = size(presenter.size.prompt);
  const bodySize = size(presenter.size.body);
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP) }}>
      <View style={{ alignItems: 'center', flexShrink: 0 }} accessibilityElementsHidden={!shown.has('ko')}>
        <View style={reveal(shown.has('ko'))}>
          <TaughtKo size={size(presenter.size.glyph)} testID="presenter-glyph" style={{ lineHeight: size(presenter.size.glyph) }}>
            {slide.char}
          </TaughtKo>
        </View>
        <Text style={[{ fontSize: promptSize, fontWeight: typography.weight.semibold, color: colors.text.secondary }, reveal(romShown)]}>
          {slide.romanization}
        </Text>
      </View>
      {hasStrokeBuild ? (
        <View style={[{ alignItems: 'center', gap: units(unit, spacing.md), flexShrink: 0 }, reveal(shown.has('stroke'))]}>
          <StrokePanel jamoId={slide.jamoId} playToken={shown.has('stroke') ? strokeToken : 0} />
          {!slide.strokeReviewed ? (
            <Text style={{ fontSize: size(presenter.size.caption), color: colors.text.secondary }}>{m.slide.strokeCaption}</Text>
          ) : null}
        </View>
      ) : null}
      <View style={{ flex: 1, gap: units(unit, STAGE_GAP_INNER) }}>
        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: units(unit, spacing.xl) }, reveal(shown.has('sound'))]}>
          <SpeakerButton enabled={shown.has('sound')} onPress={onPlaySound} />
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: units(unit, spacing.md), flexShrink: 1, flexWrap: 'wrap' }}>
            <TaughtKo size={promptSize}>{slide.spoken.text}</TaughtKo>
            <Text style={{ fontSize: promptSize, fontWeight: typography.weight.bold, color: colors.text.secondary }}>{slide.spoken.romanization}</Text>
          </View>
        </View>
        <View style={[{ gap: units(unit, spacing.md) }, reveal(shown.has('name'))]}>
          <Text style={{ fontSize: bodySize, fontWeight: typography.weight.bold, color: colors.text.primary }}>{m.slide.letterName(slide.nameEn)}</Text>
          {slide.soundHint !== undefined ? (
            <Text style={{ fontSize: bodySize, color: colors.text.secondary, lineHeight: Math.round(bodySize * typography.leading.normal) }}>{slide.soundHint}</Text>
          ) : null}
        </View>
        {slide.example !== undefined ? (
          <View style={[{ gap: units(unit, spacing.xs), alignItems: 'flex-start' }, reveal(shown.has('example'))]}>
            <View
              accessibilityLabel={koreanTextLabel(slide.example.ko, slide.example.romanization)}
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: units(unit, spacing.md),
                paddingVertical: units(unit, spacing.xs),
                paddingHorizontal: units(unit, spacing.lg),
                borderRadius: units(unit, STAGE_RADIUS),
                borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
                borderColor: colors.brand.secondary,
                backgroundColor: colors.brand.secondaryLight,
              }}
            >
              <TaughtKo size={promptSize}>{slide.example.ko}</TaughtKo>
              {/* text.secondary misses 7:1 on brand.secondaryLight (presenter.v1.md), so the romanization is text.primary here. */}
              <Text style={{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: colors.text.primary }}>{slide.example.romanization}</Text>
            </View>
            {slide.example.gloss !== undefined ? (
              <Text style={{ fontSize: bodySize, fontWeight: typography.weight.bold, color: colors.text.secondary }}>{slide.example.gloss}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The stroke guide panel: the still numbered diagram of the simplified skeleton (README
 * Constants: stroke 14 on the 200 viewBox, start dots r 14 with a 4-unit `brand.secondaryDark`
 * ring and a `text.primary` numeral on paper), with `StrokeHint` playing over it when its build
 * arrives or on R. Under reduced motion `StrokeHint` draws its own still diagram.
 */
function StrokePanel({ jamoId, playToken }: { jamoId: string; playToken: number }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const target = useMemo(() => strokesForJamo(jamoId) ?? [], [jamoId]);
  const items = useMemo(() => buildStrokeDiagram(target), [target]);
  const panel = units(unit, STROKE_PANEL);
  return (
    <View
      style={{
        width: panel,
        height: panel,
        borderRadius: units(unit, STAGE_RADIUS),
        borderWidth: Math.max(STAGE_BORDER_MIN, units(unit, STAGE_BORDER)),
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.paper,
        overflow: 'hidden',
      }}
    >
      <Svg width={panel} height={panel} viewBox={`0 0 ${STROKE_VIEWBOX} ${STROKE_VIEWBOX}`} aria-hidden>
        {items.map((item) => (
          <Path key={`s${item.order}`} d={item.d} stroke={colors.text.primary} strokeWidth={STROKE_LINE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
        {items.map((item) => (
          <React.Fragment key={`b${item.order}`}>
            <Circle cx={item.badge.x} cy={item.badge.y} r={STROKE_DOT_RADIUS} fill={colors.surface.paper} stroke={colors.brand.secondaryDark} strokeWidth={STROKE_DOT_RING} />
            <SvgText
              x={item.badge.x}
              y={item.badge.y}
              dy={typography.size.body / 3}
              fontSize={typography.size.body}
              fontFamily={SVG_UI_FONT}
              fontWeight={typography.weight.bold}
              fill={colors.text.primary}
              textAnchor="middle"
            >
              {String(item.order)}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
      {playToken > 0 ? <StrokeHint key={playToken} target={target} size={panel} viewBox={STROKE_VIEWBOX} playToken={playToken} strokeOrder={messages.a11y.minigame.strokeOrder} /> : null}
    </View>
  );
}
