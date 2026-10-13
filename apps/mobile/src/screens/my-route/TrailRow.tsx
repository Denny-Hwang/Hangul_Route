import {
  Body,
  Button,
  Caption,
  Icon,
  Pill,
  Pip,
  PipRow,
  Progress,
  Spacer,
  borderWidth,
  colors,
  motion,
  radii,
  spacing,
  touchTarget,
  useMediaSize,
  type PipState,
} from '@hangul-route/design-system';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View, type PressableStateCallbackType } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useMessages } from '../../i18n/use-messages';
import type { Connector, LaterRowView, RouteIcon, StageRowView, TagView } from '../../logic/my-route/view';
import { LetterWall } from './LetterWall';
import { BADGE_SIZE, StageBadge } from './StageBadge';

/**
 * One trail row of My route (F-ROUTE-001 sections 3.4, 3.11, 3.14; wireframe
 * `design/wireframes/journey/my-route-overview.md` A, B, C, and All lessons
 * `design/wireframes/browse/home.md` A, where the rows come from `catalogueTrail`; PipRow spec
 * `design/components/PipRow/spec.md` for the trail connector). The row header
 * is one button of at least `touchTarget.min` that opens the stage in place;
 * its label reads the row, and the drawn pips are hidden from screen readers.
 */

const CONNECTOR_WIDTH = spacing.xs;

/** The trail line below a badge, down to the next row: solid in the stage colour, or round dots in `border.shape`. */
function TrailConnector({ look, color, badge }: { look: Exclude<Connector, null>; color: string; badge: number }): React.ReactElement {
  const box = { position: 'absolute', left: badge / 2 - CONNECTOR_WIDTH / 2, top: badge, bottom: 0, width: CONNECTOR_WIDTH } as const;
  if (look === 'solid') return <View aria-hidden importantForAccessibility="no" style={{ ...box, backgroundColor: color, borderRadius: radii.pill }} />;
  return (
    <View aria-hidden importantForAccessibility="no" style={box}>
      <Svg width={CONNECTOR_WIDTH} height="100%">
        <Line
          x1={CONNECTOR_WIDTH / 2}
          y1={CONNECTOR_WIDTH + spacing.xs}
          x2={CONNECTOR_WIDTH / 2}
          y2="100%"
          stroke={colors.border.shape}
          strokeWidth={CONNECTOR_WIDTH}
          strokeLinecap="round"
          strokeDasharray={`0.01 ${spacing.sm}`}
        />
      </Svg>
    </View>
  );
}

/** The chip's glyph and word box; a long tag wraps inside its chip, never cut off (LR-D "Three tags at 320"). */
const chip = {
  flexDirection: 'row',
  alignItems: 'center',
  flexShrink: 1,
  gap: spacing.xxs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
  borderRadius: radii.pill,
} as const;

/** "You are here" on the brand tint; "Your goal" with the flag and "You started here" with the pin on sunken. */
export function TagChip({ tag }: { tag: TagView }): React.ReactElement {
  return (
    <View style={{ ...chip, backgroundColor: tag.glyph === null ? colors.brand.primaryLight : colors.surface.sunken }}>
      {tag.glyph !== null ? <Icon name={tag.glyph} size={spacing.lg} color={colors.text.primary} /> : null}
      <Caption tone="primary" weight="semibold" style={{ flexShrink: 1 }}>
        {tag.label}
      </Caption>
    </View>
  );
}

/** The 16 dp solid ring of "In your plan" (RouteMarkers spec, "Tag marks"): a chip mark, never a bare ring in a pip row. */
function PlanRing(): React.ReactElement {
  const size = spacing.lg;
  const stroke = borderWidth.base;
  return (
    <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={size / 2 - stroke / 2} fill="none" stroke={colors.border.shape} strokeWidth={stroke} />
      </Svg>
    </View>
  );
}

/** "In your plan" on a cell row (F-ENT-003 E3-D): the solid ring plus the word on a sunken chip. */
export function InPlanChip({ label }: { label: string }): React.ReactElement {
  return (
    <View style={{ ...chip, alignSelf: 'flex-start', backgroundColor: colors.surface.sunken }} testID="my-route-in-plan">
      <PlanRing />
      <Caption tone="primary" weight="semibold" style={{ flexShrink: 1 }}>
        {label}
      </Caption>
    </View>
  );
}

function BuildChips({ builds }: { builds: { label: string; icon: RouteIcon }[] }): React.ReactElement {
  const m = useMessages().learner.myRoute;
  return (
    <View>
      <Caption tone="muted">{m.builds}</Caption>
      <Spacer size="xxs" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {builds.map((b) => (
          <View
            key={b.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radii.pill, backgroundColor: colors.surface.sunken }}
          >
            <Icon name={b.icon} size={16} color={colors.text.secondary} />
            <Caption tone="secondary" weight="semibold">
              {b.label}
            </Caption>
          </View>
        ))}
      </View>
    </View>
  );
}

const LEGEND_BEFORE: readonly PipState[] = ['done', 'known', 'open', 'new'];
const LEGEND_AFTER: readonly PipState[] = ['later'];

/**
 * "What the shapes mean": each drawn shape with its word (section 3.4). A row with a not-open pip adds
 * "Not open yet" with the same dotted ring, just before "Coming later" (amendment section 4.5, LR-5b;
 * mock `design/screens/learning-route/mock/route-card.html` state D): the word tells them apart.
 */
function PipLegend({ accent, notOpen }: { accent: string; notOpen: boolean }): React.ReactElement {
  const m = useMessages().learner.myRoute.legend;
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Button label={m.title} tone="ghost" size="sm" onPress={() => setOpen((v) => !v)} expanded={open} />
      {open ? (
        <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
          {LEGEND_BEFORE.map((state) => (
            <View key={state} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Pip state={state} context="cell" accent={accent} />
              <Body size="sm">{m[state]}</Body>
            </View>
          ))}
          {notOpen ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} testID="my-route-legend-not-open">
              <Pip state="later" context="cell" accent={accent} />
              <Body size="sm">{m.notOpen}</Body>
            </View>
          ) : null}
          {LEGEND_AFTER.map((state) => (
            <View key={state} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Pip state={state} context="cell" accent={accent} />
              <Body size="sm">{m[state]}</Body>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <PipRow groups={[[{ key: 'legend-cursor', state: 'open', isCursor: true }]]} context="cell" accent={accent} />
            <Body size="sm">{m.cursor}</Body>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const FRESH_FROM = 0.3;

/**
 * Fades a row's pips in once when a quest was finished since the last open; never when motion is reduced.
 * It restarts from faded each time `fresh` turns on, so it also plays on a later open of a mounted Route tab.
 */
function FreshFill({ fresh, reducedMotion, children }: { fresh: boolean; reducedMotion: boolean; children: React.ReactNode }): React.ReactElement {
  const animate = fresh && !reducedMotion;
  const opacity = useRef(new Animated.Value(animate ? FRESH_FROM : 1)).current;
  useEffect(() => {
    if (!animate) return;
    opacity.setValue(FRESH_FROM);
    Animated.timing(opacity, { toValue: 1, duration: motion.duration.celebration, useNativeDriver: false }).start();
  }, [animate, opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

export interface StageRowItemProps {
  row: StageRowView;
  open: boolean;
  look: 'pips' | 'bar';
  reducedMotion: boolean;
  onToggle: () => void;
  onOpenEpisode: (episodeId: string) => void;
  /**
   * Default true: the header opens the stage in place (My route). False: the header is a plain
   * button that goes somewhere else (All lessons, F-BROWSE-001 §4.5: a stage row opens the Journey
   * at that stage), so it carries no expanded state and the stage never opens in place.
   */
  expandable?: boolean;
}

export function StageRowItem({ row, open, look, reducedMotion, onToggle, onOpenEpisode, expandable = true }: StageRowItemProps): React.ReactElement {
  const badge = useMediaSize(BADGE_SIZE);
  const accent = colors.stage[row.stage];
  return (
    <View style={{ paddingBottom: spacing.lg }} testID={`my-route-stage-${row.order}`}>
      {row.connector ? <TrailConnector look={row.connector} color={accent} badge={badge} /> : null}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={row.a11yLabel}
        accessibilityState={expandable ? { expanded: open } : undefined}
        aria-expanded={expandable ? open : undefined}
        style={({ pressed, focused }: PressableStateCallbackType & { focused?: boolean }) => ({
          flexDirection: 'row',
          gap: spacing.md,
          minHeight: touchTarget.min,
          borderRadius: radii.md,
          backgroundColor: pressed ? colors.surface.inkScrim : 'transparent',
          // All lessons draws the `border.focus` ring on keyboard focus (F-BROWSE-001 design decision 20); My route is unchanged.
          ...(expandable ? {} : { borderWidth: borderWidth.thick, borderColor: focused ? colors.border.focus : 'transparent' }),
        })}
      >
        <StageBadge look={row.badge} stage={row.stage} order={row.order} />
        <View style={{ flex: 1, gap: spacing.xs, paddingTop: spacing.xxs }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: spacing.xxs }}>
            <Body weight="bold" size="lg">
              {row.title}
            </Body>
            <Pill label={row.stateWord} tone={row.tone} size="sm" />
          </View>
          {row.captions.map((line) => (
            <Body key={line} tone="secondary">
              {line}
            </Body>
          ))}
          {row.groups.length > 0 ? (
            <FreshFill fresh={row.fresh} reducedMotion={reducedMotion}>
              {look === 'pips' || row.fill === null ? (
                <PipRow groups={row.groups} context="stage" accent={accent} testID={`my-route-pips-${row.order}`} />
              ) : (
                // A plain fill on a narrow window: no label and no number, hidden from screen readers (the row label reads it).
                <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <Progress value={row.fill.value} max={row.fill.max} tone="primary" height={spacing.sm} />
                </View>
              )}
            </FreshFill>
          ) : null}
          {row.tags.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {row.tags.map((tag) => (
                <TagChip key={tag.label} tag={tag} />
              ))}
            </View>
          ) : null}
        </View>
        {/* A row that goes somewhere else ends in an arrow (All lessons: to the Journey at that stage). */}
        {expandable ? null : (
          <View style={{ justifyContent: 'center' }}>
            <Icon name="arrow-right" size={spacing.xl} color={colors.text.secondary} />
          </View>
        )}
      </Pressable>

      {expandable && open ? (
        <View style={{ marginLeft: badge + spacing.md, marginTop: spacing.sm, gap: spacing.sm }}>
          <View
            style={{
              backgroundColor: colors.surface.paper,
              borderRadius: radii.lg,
              borderWidth: borderWidth.thin,
              borderColor: colors.border.subtle,
              padding: spacing.md,
              gap: spacing.md,
            }}
          >
            <View>
              <Body weight="semibold">{row.canDo.lead}</Body>
              <Body>{row.canDo.line}</Body>
            </View>
            <BuildChips builds={row.builds} />
            <View style={{ gap: spacing.sm }}>
              {row.cells.map((cell) => {
                const body = (
                  <>
                    <View style={{ flex: 1, gap: spacing.xxs }}>
                      <Caption tone="muted">{cell.themeLabel}</Caption>
                      <Body weight="semibold">{cell.title}</Body>
                      <PipRow groups={[cell.pips]} context="cell" accent={accent} />
                      {cell.inPlan !== null ? <InPlanChip label={cell.inPlan} /> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: spacing.xxs, maxWidth: '40%' }}>
                      <Body size="sm" tone="secondary" align="right">
                        {cell.word}
                      </Body>
                      {cell.episodeId === null ? null : <Icon name="arrow-right" size={20} color={colors.text.muted} />}
                    </View>
                  </>
                );
                const box = {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  minHeight: touchTarget.min,
                  padding: spacing.sm,
                  borderRadius: radii.md,
                } as const;
                const episodeId = cell.episodeId;
                return episodeId === null ? (
                  <View key={cell.key} accessible accessibilityLabel={cell.a11yLabel} style={{ ...box, backgroundColor: colors.surface.canvas }}>
                    {body}
                  </View>
                ) : (
                  <Pressable
                    key={cell.key}
                    onPress={() => onOpenEpisode(episodeId)}
                    accessibilityRole="button"
                    accessibilityLabel={cell.a11yLabel}
                    style={({ pressed }) => ({ ...box, backgroundColor: pressed ? colors.surface.sunken : colors.surface.canvas })}
                  >
                    {body}
                  </Pressable>
                );
              })}
            </View>
            <PipLegend accent={accent} notOpen={row.notOpenLegend} />
          </View>
          {row.letterWall ? <LetterWall wall={row.letterWall} /> : null}
        </View>
      ) : null}
    </View>
  );
}

export interface LaterRowItemProps {
  row: LaterRowView;
  open: boolean;
  onToggle: () => void;
  /**
   * Default true: the row opens in place (My route). False: a plain row, never a button, since it has
   * no lesson to show (All lessons, F-BROWSE-001 design decision 5, the BR-5b note's choice for BR-7).
   */
  expandable?: boolean;
}

/** A compact coming-later row: no pips; a run of them is one row ("Stages 5 to 7") that opens on tap. */
export function LaterRowItem({ row, open, onToggle, expandable = true }: LaterRowItemProps): React.ReactElement {
  const badge = useMediaSize(BADGE_SIZE);
  if (!expandable) {
    return (
      <View style={{ paddingBottom: spacing.lg }} testID={`my-route-later-${row.order}`}>
        {row.connector ? <TrailConnector look={row.connector} color={colors.stage[row.stage]} badge={badge} /> : null}
        <View accessible accessibilityLabel={row.a11yLabel} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget.min }}>
          <StageBadge look="later" stage={row.stage} order={row.merged ? null : row.order} />
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: spacing.xxs }}>
            <Body weight="bold" tone="secondary">
              {row.title}
            </Body>
            <Pill label={row.stateWord} tone="neutral" size="sm" />
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={{ paddingBottom: spacing.lg }} testID={`my-route-later-${row.order}`}>
      {row.connector ? <TrailConnector look={row.connector} color={colors.stage[row.stage]} badge={badge} /> : null}
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={row.a11yLabel}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          minHeight: touchTarget.min,
          borderRadius: radii.md,
          backgroundColor: pressed ? colors.surface.inkScrim : 'transparent',
        })}
      >
        <StageBadge look="later" stage={row.stage} order={row.merged ? null : row.order} />
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: spacing.xxs }}>
          <Body weight="bold" tone="secondary">
            {row.title}
          </Body>
          <Pill label={row.stateWord} tone="neutral" size="sm" />
          {row.tags.map((tag) => (
            <TagChip key={tag.label} tag={tag} />
          ))}
        </View>
      </Pressable>
      {open ? (
        <View style={{ marginLeft: badge + spacing.md, marginTop: spacing.sm, gap: spacing.md }}>
          {row.details.map((d) => (
            <View key={d.stage} style={{ gap: spacing.xs }}>
              {row.merged ? <Body weight="semibold">{d.title}</Body> : null}
              <Body tone="secondary">{d.canDo}</Body>
              <BuildChips builds={d.builds} />
            </View>
          ))}
          <Caption tone="muted">{row.note}</Caption>
        </View>
      ) : null}
    </View>
  );
}
