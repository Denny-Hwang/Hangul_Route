import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  Icon,
  PipRow,
  colors,
  spacing,
  useLayoutClass,
  useMediaSize,
  type PipView,
} from '@hangul-route/design-system';
import type { StageKey } from '@hangul-route/content-schema';
import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { HeroCopy, RouteCardCopy, RouteCardLine } from '../../logic/my-route/copy';
import { routeCardLook } from '../../logic/my-route/view';
import { focusForScreenReader } from '../../platform/screen-reader';

/**
 * The route card (AMENDMENTS-ROUTE-LEARNING-ROUTE sections 4.3, 6.2 and 10; LR-5a): where you are and
 * where you are going, how far along the goal stage is (pips that only fill) and the page's one
 * button. It replaces the hero. Wireframe `design/wireframes/journey/learning-route.md` (A to J), screen
 * spec `design/screens/learning-route/route-card.md`, mock
 * `design/screens/learning-route/mock/route-card.html`. The words come from `routeCardCopy`; this
 * component lays them out and never builds a sentence.
 *
 * The where block, the source, the can-do line, the pips and Next are one summary for screen
 * readers (its label reads them in order, the pips without digits); Hoya, the pin, the flag and
 * the pips are hidden. Focus lands on the summary on every focus of the page. The grown-up card
 * (read-only) has no button.
 */

export interface RouteCardProps {
  copy: RouteCardCopy;
  /** The goal stage's pips (`model.goalPips`); the cursor shows only when Next is in that stage. */
  pips: readonly PipView[];
  /** The goal stage, for the pips' colour; null at the end of the open road. */
  goalStage: StageKey | null;
  /** The button (`heroCopy.cta`); null in read-only mode. */
  cta: HeroCopy['cta'];
  pose: 'idle' | 'cheering';
  onAction: () => void;
  /** The page's focus count: focus moves to the summary on each focus (0 before the first). */
  focusToken: number;
  testID?: string;
}

/** A 20 dp glyph beside the where line, hidden from screen readers (the summary label reads the words). */
function Glyph({ name }: { name: 'pin' | 'flag' }): React.ReactElement {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ paddingTop: spacing.xxs }}>
      <Icon name={name} size={spacing.lg + spacing.xxs} color={colors.text.primary} />
    </View>
  );
}

/** "Now" or "Goal" over its line; a line without a label (a grown-up's reached goal) stands alone. */
function LabelledLine({ line, glyph, testID }: { line: RouteCardLine; glyph: 'pin' | 'flag'; testID: string }): React.ReactElement {
  return (
    <View testID={testID}>
      {line.label !== null ? (
        <Caption tone="muted" weight="semibold">
          {line.label}
        </Caption>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
        <Glyph name={glyph} />
        <Body size="lg" weight="bold" style={{ flex: 1 }}>
          {line.line}
        </Body>
      </View>
    </View>
  );
}

function Decorative({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {children}
    </View>
  );
}

export function RouteCard({ copy, pips, goalStage, cta, pose, onAction, focusToken, testID = 'my-route-card' }: RouteCardProps): React.ReactElement {
  const { windowWidth } = useLayoutClass();
  // Below 360 the compact card (LR-11): Continue (or Start) stays above the tab bar at 320 x 568.
  const look = routeCardLook(windowWidth);
  const hoyaLine = useMediaSize(64);
  const hoyaNext = useMediaSize(48);
  const summaryRef = useRef<object | null>(null);
  useEffect(() => {
    if (focusToken === 0) return;
    focusForScreenReader(summaryRef.current);
  }, [focusToken]);
  const { where } = copy;

  return (
    <Card padding={look.padding} elevation="card" testID={testID}>
      <View
        ref={(node) => {
          summaryRef.current = node;
        }}
        accessible
        focusable
        accessibilityRole="summary"
        accessibilityLabel={copy.a11yLabel}
        style={{ gap: spacing[look.gap] }}
        testID={`${testID}-summary`}
      >
        {copy.hoya !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Decorative>
              <Hoya pose={pose} size={hoyaLine} />
            </Decorative>
            <Heading level="prompt" style={{ flex: 1 }}>
              {copy.hoya}
            </Heading>
          </View>
        ) : null}

        {where !== null ? (
          <View style={{ gap: spacing.xs }}>
            {where.kind === 'collapsed' ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }} testID={`${testID}-collapsed`}>
                <Glyph name="pin" />
                <Glyph name="flag" />
                <Heading level="prompt" style={{ flex: 1 }}>
                  {where.line}
                </Heading>
              </View>
            ) : (
              <>
                {where.now !== null ? <LabelledLine line={where.now} glyph="pin" testID={`${testID}-now`} /> : null}
                <LabelledLine line={where.goal} glyph="flag" testID={`${testID}-goal`} />
              </>
            )}
            {copy.from !== null ? (
              <Body size="sm" tone="secondary" testID={`${testID}-from`}>
                {copy.from}
              </Body>
            ) : null}
            {copy.planEnds !== null ? (
              <Body size="sm" tone="secondary" testID={`${testID}-plan-ends`}>
                {copy.planEnds}
              </Body>
            ) : null}
          </View>
        ) : null}

        {copy.canDo !== null && look.showCanDo ? (
          <View testID={`${testID}-can-do`}>
            <Caption tone="muted" weight="semibold">
              {copy.canDo.lead}
            </Caption>
            <Body>{copy.canDo.line}</Body>
          </View>
        ) : null}
        {copy.tasteLine !== null ? <Body>{copy.tasteLine}</Body> : null}

        {copy.showPips && where !== null && goalStage !== null && pips.length > 0 ? (
          <PipRow groups={[[...pips]]} context="stage" accent={colors.stage[goalStage]} bandsPerLine testID={`${testID}-pips`} />
        ) : null}

        {copy.next !== null ? (
          copy.hoya === null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Decorative>
                <Hoya pose={pose} size={hoyaNext} />
              </Decorative>
              <Body weight="bold" style={{ flex: 1 }} testID={`${testID}-next`}>
                {copy.next}
              </Body>
            </View>
          ) : (
            <Body weight="bold" testID={`${testID}-next`}>
              {copy.next}
            </Body>
          )
        ) : null}
      </View>

      {cta !== null ? (
        <View style={{ marginTop: spacing[look.ctaGap] }}>
          <Button label={cta.label} tone="primary" size="lg" fullWidth onPress={onAction} testID={`${testID}-cta`} />
        </View>
      ) : null}
    </Card>
  );
}
