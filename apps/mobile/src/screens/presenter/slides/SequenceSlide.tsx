import { colors, presenter, radii, spacing, typography } from '@hangul-route/design-system';
import React from 'react';
import { Text, View } from 'react-native';
import type { SequenceStep } from '../../../logic/lecture/build-steps';
import type { Slide } from '../../../logic/lecture/deck-builder';
import { markerFor, sequenceView } from '../../../logic/lecture/slide-view';
import { MARKER_BODY_FACTOR, units } from '../../../logic/lecture/stage-constants';
import { ShapeMarker } from '../ShapeMarker';
import { STAGE_BORDER, STAGE_BORDER_MIN, STAGE_GAP, STAGE_GAP_INNER } from '../stage-metrics';
import { TaughtKo, usePresenterView, useStageText } from '../presenter-context';
import { revealProps } from './reveal';

type SequenceBody = Extract<Slide, { kind: 'sequence' }>;

/**
 * Sequence slide (design/screens/presenter/slide-sequence.md): the steps in their true order, two
 * columns, one per build, each a numbered circle with the step's gloss (bold), its Korean and the
 * romanization (with `romanization: 'tap'`, every romanization at one build). The last build asks
 * "What comes first?" over the builder's shuffled order, each step marked with the quiz's shape and
 * number marker instead of a number, so the room can answer "triangle, 2" without the true order
 * showing. Nothing is collected.
 */
export function SequenceSlide({ slide, reveal }: { slide: SequenceBody; reveal: number }): React.ReactElement {
  const { unit, messages } = usePresenterView();
  const size = useStageText();
  const view = sequenceView(slide, reveal);
  const titleSize = size(presenter.size.title);
  if (view.mode === 'order') {
    return (
      <View testID="presenter-sequence-order" style={{ flex: 1, justifyContent: 'center', gap: units(unit, STAGE_GAP_INNER) }}>
        <Text role="heading" style={{ fontSize: titleSize, lineHeight: Math.round(titleSize * typography.leading.tight), fontWeight: typography.weight.bold, color: colors.text.primary }}>
          {messages.learner.presenter.slide.order}
        </Text>
        <StepGrid>
          {view.steps.map((step, i) => {
            const marker = markerFor(i, presenter.marker.shapes);
            return <StepRow key={step.id} step={step} lead={<ShapeMarker shape={marker.shape} n={marker.n} />} rom on />;
          })}
        </StepGrid>
      </View>
    );
  }
  return (
    <View testID="presenter-sequence-steps" style={{ flex: 1, justifyContent: 'center' }}>
      <StepGrid>
        {slide.steps.map((step, i) => (
          <StepRow key={step.id} step={step} lead={<StepNumber n={i + 1} />} rom={view.rom} on={i < view.count} />
        ))}
      </StepGrid>
    </View>
  );
}

/** Two columns in reading order (row by row), as the mock's grid. */
function StepGrid({ children }: { children: React.ReactNode }): React.ReactElement {
  const { unit } = usePresenterView();
  return (
    <View role="list" style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: units(unit, STAGE_GAP), rowGap: units(unit, STAGE_GAP_INNER) }}>
      {children}
    </View>
  );
}

function StepRow({ step, lead, rom, on }: { step: SequenceStep; lead: React.ReactNode; rom: boolean; on: boolean }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const bodySize = size(presenter.size.body);
  const promptSize = size(presenter.size.prompt);
  const hidden = revealProps(on);
  return (
    <View
      testID="presenter-step"
      role="listitem"
      aria-hidden={hidden['aria-hidden']}
      style={[{ flexBasis: '40%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: units(unit, STAGE_GAP_INNER) }, hidden.style]}
    >
      {lead}
      <View style={{ flex: 1, gap: units(unit, spacing.xs) }}>
        <Text style={{ fontSize: bodySize, lineHeight: Math.round(bodySize * typography.leading.tight), fontWeight: typography.weight.bold, color: colors.text.primary }}>{step.gloss}</Text>
        {step.ko !== undefined && step.romanization !== undefined ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: units(unit, spacing.lg) }}>
            <TaughtKo size={promptSize}>{step.ko}</TaughtKo>
            <View {...revealProps(rom)}>
              <Text style={{ fontSize: bodySize, fontWeight: typography.weight.semibold, color: colors.text.secondary }}>{step.romanization}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The true order's numbered circle: 80 units, a `borderWidth.thick`-unit `text.primary` ring. */
function StepNumber({ n }: { n: number }): React.ReactElement {
  const { unit } = usePresenterView();
  const size = useStageText();
  const box = units(unit, MARKER_BODY_FACTOR * presenter.size.body);
  return (
    <View
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
      <Text style={{ fontSize: size(presenter.size.body), fontWeight: typography.weight.bold, color: colors.text.primary }}>{String(n)}</Text>
    </View>
  );
}
