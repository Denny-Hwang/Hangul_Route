import { Body, Caption, Icon, borderWidth, colors, radii, spacing, touchTarget, useLayoutClass } from '@hangul-route/design-system';
import { formatDate } from '@hangul-route/i18n';
import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { headlineOf, ringLineOf, streakTextOf, stripLabelOf, tierLabelOf, type GoalStripView } from '../../logic/goals/strip-view';
import type { DotState } from '../../logic/goals/week';

/**
 * The Home week strip (F-CURR-002 section 7.4, OD-6, row CM-17): design/wireframes/home/goal-ring-weekly-dots.md
 * A / A2 / B, mock design/screens/goal-ring-weekly-dots/. One button (it opens the goals sheet) read as one
 * sentence: the 7 dots of the local week (Monday first in every locale), the steady weeks as the headline (the
 * biggest text), the streak line under the dots, and a ring that fills toward today's daily goal. No number of
 * points, no percentage, no "n of m"; a quiet day that is not a rest day looks like a day to come.
 */

/** 24 dp dots; 7 of them with xs gaps fit beside the 48 dp ring at 320. */
const DOT = spacing.xl;
const RING = spacing.xxxl;
const RING_STROKE = borderWidth.thick;
const GLYPH = spacing.lg;

export function dayKeyName(locale: Parameters<typeof formatDate>[0], day: string, kind: 'weekdayLong' | 'weekdayNarrow'): string {
  return formatDate(locale, `${day}T12:00:00.000Z`, kind, { utc: true });
}

function Dot({ state }: { state: DotState }): React.ReactElement {
  const learned = state === 'learned';
  const rest = state === 'rest';
  return (
    <View
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      testID={`goal-dot-${state}`}
      style={{
        width: DOT,
        height: DOT,
        borderRadius: radii.circle,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: learned ? colors.brand.primary : rest ? colors.surface.sunken : colors.surface.paper,
        borderWidth: learned ? 0 : state === 'today' ? borderWidth.base : borderWidth.thin,
        borderColor: colors.border.shape,
      }}
    >
      {learned ? <Icon name="check" size={GLYPH} color={colors.text.onPrimary} /> : rest ? <Icon name="rest" size={GLYPH} color={colors.text.secondary} /> : null}
    </View>
  );
}

/** The daily goal ring: a track and an arc, closed with a check once the goal is met; never a number. */
export function GoalRing({ fraction, met }: { fraction: number; met: boolean }): React.ReactElement {
  const r = (RING - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const arc = Math.max(0, Math.min(1, fraction)) * c;
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }} testID={met ? 'goal-ring-met' : 'goal-ring'}>
      <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke={colors.border.subtle} strokeWidth={RING_STROKE} />
        {arc > 0 ? (
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            fill="none"
            stroke={colors.brand.primary}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${c}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        ) : null}
      </Svg>
      {met ? <Icon name="check" size={spacing.xl} color={colors.brand.primary} /> : null}
    </View>
  );
}

export interface GoalStripProps {
  view: GoalStripView;
  /** The learner's local day. */
  today: string;
  onPress: () => void;
}

export function GoalStrip({ view, today, onPress }: GoalStripProps): React.ReactElement {
  const messages = useMessages();
  const locale = useLocale();
  const g = messages.learner.goals;
  const wide = useLayoutClass().width !== 'compact';
  const label = stripLabelOf(view, messages, today, (day) => dayKeyName(locale, day, 'weekdayLong'));
  const streak = streakTextOf(view, messages);

  const week = (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        {view.dots.map((dot) => (
          <View key={dot.day} style={{ width: DOT, alignItems: 'center', gap: spacing.xxs }}>
            <Dot state={dot.state} />
            <Caption tone={dot.day === today ? 'primary' : 'muted'} weight={dot.day === today ? 'semibold' : 'medium'} align="center">
              {dayKeyName(locale, dot.day, 'weekdayNarrow')}
            </Caption>
          </View>
        ))}
      </View>
      {streak !== null ? (
        <Caption tone="secondary" testID="goal-streak-line">
          {streak}
        </Caption>
      ) : null}
    </View>
  );
  const headline = (
    <Body size="lg" weight="bold" testID="goal-headline">
      {headlineOf(view, g)}
    </Body>
  );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="home-goal-strip"
      style={({ pressed }) => ({
        minHeight: touchTarget.hero,
        padding: spacing.md,
        borderRadius: radii.lg,
        backgroundColor: pressed ? colors.surface.sunken : colors.surface.paper,
        borderWidth: borderWidth.thin,
        borderColor: colors.border.subtle,
      })}
    >
      {wide ? (
        // B: one row; the dots and the headline first and largest, then the ring with its state line (bodySm).
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xl }}>
          <View style={{ gap: spacing.xs, flexShrink: 1 }}>
            {headline}
            {week}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 }}>
            <GoalRing fraction={view.ring.fraction} met={view.ring.state === 'met'} />
            <View style={{ flexShrink: 1 }}>
              <Body size="sm">{ringLineOf(view, g)}</Body>
              <Caption tone="secondary">{tierLabelOf(view.tier, g)}</Caption>
            </View>
          </View>
        </View>
      ) : (
        // A: the ring at the left; the headline, the dots and the streak line beside it (they wrap under it at 200 % text).
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing.md }}>
          <GoalRing fraction={view.ring.fraction} met={view.ring.state === 'met'} />
          <View style={{ gap: spacing.xs, flexShrink: 1 }}>
            {headline}
            {week}
          </View>
        </View>
      )}
    </Pressable>
  );
}
