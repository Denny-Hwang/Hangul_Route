import {
  Body,
  Button,
  Caption,
  PIP_SIZE,
  PipParts,
  PipRow,
  Spacer,
  borderWidth,
  colors,
  cursorMarkerParts,
  markerBand,
  pipParts,
  spacing,
  useMediaSize,
  type PipPart,
} from '@hangul-route/design-system';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { formatDate } from '@hangul-route/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg from 'react-native-svg';
import { episodesAll, heritageCardsAll, questsAll, stages, themes } from '../../content';
import { journeyContent } from '../../content/sync-context';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeEpisode, localizeStage, localizeTheme } from '../../logic/content-locale';
import { cursorContext } from '../../logic/cursor-context';
import { SEGMENT_SHAPE, dashboardRowView, type DashboardRowView, type DashboardSegment } from '../../logic/my-route/dashboard-row';
import { buildMyRoute } from '../../logic/my-route/model';
import { startRouteOf } from '../../logic/my-route/start-marker';
import { emptySnapshot } from '../../logic/my-route/view';
import { bandLabel } from '../../logic/placement/copy';
import { startingSpotRow } from '../../logic/placement/report-page';
import type { RootStackParamList } from '../../navigation/types';
import { effectiveTier, useTierStore } from '../../store/tier-store';

/**
 * The Learning Route row on a profile card of the in-app parent dashboard
 * (F-ROUTE-001 R-9b, section 3.12; amendment LR-A6). Wireframes:
 * `design/wireframes/journey/my-route-overview.md` H and
 * `design/wireframes/parent/learning-route.md` L1a; the drawn segments use the
 * pip shapes of `design/components/PipRow/spec.md`, as the console strip does
 * (`design/wireframes/console/roster.md`). Written about the child, behind the
 * grown-up gate: seven drawn segments with a text list for screen readers,
 * Now, the goal when one exists, Started when a level check exists, the read,
 * listen and write mini rows, the skills note and See Learning Route, which
 * opens the page forced read-only. It builds the same model as the page, sends
 * no telemetry and writes nothing.
 */

const SEGMENT_SIZE = PIP_SIZE.stage;

/** The segment's drawn parts: the pip of its state, or the done pip's check alone for explored. */
function segmentParts(segment: DashboardSegment, size: number): PipPart[] {
  const shape = SEGMENT_SHAPE[segment.state];
  const parts = pipParts(shape.pip, size);
  return shape.checkOnly ? parts.filter((part) => part.kind === 'path') : parts;
}

/** One stage: the cursor marker on top for the stage the child is on, the state shape below. The words are on the list item. */
function Segment({ segment, size, testID }: { segment: DashboardSegment; size: number; testID: string }): React.ReactElement {
  const band = markerBand(size);
  const accent = colors.stage[segment.stage];
  return (
    <View role="listitem" accessible accessibilityLabel={segment.a11yLabel} testID={testID}>
      <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Svg width={size} height={size + band} viewBox={`0 0 ${size} ${size + band}`}>
          {segment.here ? <PipParts parts={cursorMarkerParts(size)} accent={accent} /> : null}
          <PipParts parts={segmentParts(segment, size)} accent={accent} offsetY={band} />
        </Svg>
      </View>
    </View>
  );
}

/** Decoration only: the done mark carries its own check (PipRow spec); the same inks as the page's skills card. */
const SKILL_ACCENT = { read: colors.stage.stage1, listen: colors.stage.stage4, write: colors.stage.stage7 } as const;

export function LearningRouteRowView({ view, onOpen, testID }: { view: DashboardRowView; onOpen: () => void; testID: string }): React.ReactElement {
  const size = useMediaSize(SEGMENT_SIZE);
  return (
    <View testID={testID} style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle }}>
      <Caption tone="muted">{view.title}</Caption>
      <Spacer size="xs" />
      <View
        role="list"
        aria-label={view.segmentsLabel}
        accessibilityLabel={view.segmentsLabel}
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.sm }}
        testID={`${testID}-segments`}
      >
        {view.segments.map((segment) => (
          <Segment key={segment.stage} segment={segment} size={size} testID={`${testID}-segment-${segment.order}`} />
        ))}
      </View>
      <Spacer size="xs" />
      <View accessible accessibilityLabel={view.a11y.now}>
        <Body weight="semibold">{view.now}</Body>
      </View>
      {view.goal !== null ? (
        <View accessible accessibilityLabel={view.a11y.goal ?? view.goal}>
          <Body>{view.goal}</Body>
        </View>
      ) : null}
      {view.started !== null ? (
        <View accessible accessibilityLabel={view.a11y.started ?? view.started}>
          <Body tone="secondary">{view.started}</Body>
        </View>
      ) : null}
      <Spacer size="sm" />
      <View style={{ gap: spacing.xxs }}>
        {view.skills.map((row) => (
          <View
            key={row.skill}
            accessible
            accessibilityLabel={row.a11yLabel}
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: spacing.xxs }}
            testID={`${testID}-skill-${row.skill}`}
          >
            <Body weight="semibold">{row.label}</Body>
            {row.marks.length > 0 ? <PipRow groups={[row.marks]} context="stage" accent={SKILL_ACCENT[row.skill]} /> : null}
            <Body size="sm" tone="secondary">
              {row.detail}
            </Body>
          </View>
        ))}
      </View>
      {view.tiles !== null ? (
        <>
          <Spacer size="xs" />
          <Body tone="secondary">{view.tiles}</Body>
        </>
      ) : null}
      <Spacer size="xs" />
      <Caption tone="muted">{view.note}</Caption>
      <Spacer size="sm" />
      <View style={{ alignItems: 'flex-start' }}>
        <Button label={view.cta} tone="secondary" size="md" onPress={onOpen} testID={`${testID}-open`} />
      </View>
    </View>
  );
}

/**
 * One profile's row: builds the model the page builds (the same cursor and
 * start route), so the row and the read-only page always name the same stage.
 * Content that cannot be read leaves the row out; the page itself shows the retry.
 */
export function LearningRouteRow({
  profileId,
  name,
  stored,
  testID,
}: {
  profileId: string;
  name: string;
  /** The profile's stored snapshot; undefined before it is read (the new-learner row). */
  stored: ProgressSnapshot | undefined;
  testID: string;
}): React.ReactElement | null {
  const messages = useMessages();
  const locale = useLocale();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Re-renders when the inbox changes this learner's tier, as the page does.
  const cachedTier = useTierStore((s) => s.byLearner[profileId]);

  const view = useMemo((): DashboardRowView | null => {
    try {
      const snapshot = stored ?? emptySnapshot(profileId);
      const tier = effectiveTier(profileId, new Date()).tier;
      const cursor = cursorContext({ tier, placements: snapshot.placements, quests: questsAll, episodes: episodesAll });
      const model = buildMyRoute({
        snapshot,
        catalog: journeyContent.catalog,
        episodes: episodesAll.map((e) => localizeEpisode(e, locale)),
        quests: questsAll,
        cards: heritageCardsAll,
        stages: stages.map((s) => localizeStage(s, locale)),
        themes: themes.map((t) => localizeTheme(t, locale)),
        isEntitled: cursor.isEntitled,
        skipQuestIds: cursor.skipQuestIds,
        route: startRouteOf(snapshot.placements, journeyContent.catalog, cursor.isEntitled),
        now: new Date(),
      });
      const spot = startingSpotRow(snapshot.placements);
      const started = spot === null ? null : { stage: spot.level.stage, band: bandLabel(messages, spot.level), date: formatDate(locale, spot.takenAt, 'monthDay') };
      return dashboardRowView({ model, messages, name, started });
    } catch {
      return null;
    }
    // `cachedTier` re-renders the row when the inbox changes the tier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored, profileId, name, cachedTier, locale, messages]);

  if (view === null) return null;
  return <LearningRouteRowView view={view} testID={testID} onOpen={() => navigation.navigate('MyRoute', { source: 'parent', profileId, viewer: 'grownup' })} />;
}
