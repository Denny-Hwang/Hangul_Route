import { Body, Button, Caption, PipRow, Spacer, StageSegments, borderWidth, colors, spacing } from '@hangul-route/design-system';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { formatDate } from '@hangul-route/i18n';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { episodesAll, questsAll } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { dayKey } from '../../logic/homework/mission-builder';
import { dashboardRowView, type DashboardRowView } from '../../logic/my-route/dashboard-row';
import { buildMyRoute } from '../../logic/my-route/model';
import { useLessonContentVersion } from '../lesson-content';
import { localizedRouteContent, routeModelInput } from '../../logic/my-route/route-input';
import { emptySnapshot } from '../../logic/my-route/view';
import { bandLabel } from '../../logic/placement/copy';
import { startingSpotRow } from '../../logic/placement/report-page';
import { routeNextInputOf } from '../../logic/route-next';
import type { RootStackParamList } from '../../navigation/types';
import { usePlanStore } from '../../store/plan-store';
import { useProgressStore } from '../../store/progress-store';
import { questOpenFor, useAccessTier } from '../../store/tier-store';
import { SKILL_ACCENT } from '../my-route/SkillsCard';

/**
 * The Learning Route row on a profile card of the in-app parent dashboard
 * (F-ROUTE-001 R-9b, section 3.12; amendment LR-A6). Wireframes:
 * `design/wireframes/journey/my-route-overview.md` H and
 * `design/wireframes/parent/learning-route.md` L1a; the drawn segments are the
 * design system `StageSegments` (`design/components/PipRow/spec.md` "Stage
 * segments"), as the Home strip draws them. Written about the child, behind the
 * grown-up gate: seven drawn segments with a text list for screen readers,
 * Now, the goal when one exists, Started when a level check exists, the read,
 * listen and write mini rows, the skills note and See Learning Route, which
 * opens the page forced read-only. It builds the same model as the page, from
 * the same F-ENT-003 input (LR-5a), so its goal line names the page's goal. It
 * sends no telemetry and writes nothing.
 */

/** Read by assistive tech, drawn nowhere (the 1 x 1 clipped box of the web sr-only pattern, as ExtraCardsBanner). */
const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;

/** The title and the button above the rows and below them: a frame shared with the fallback. */
const frame = { marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle } as const;

export function LearningRouteRowView({ view, onOpen, testID }: { view: DashboardRowView; onOpen: () => void; testID: string }): React.ReactElement {
  const aboutRows = useMessages().caregiver.dashboard.aboutRows.cta;
  const [aboutOpen, setAboutOpen] = useState(false);
  const segments = view.segments.map((s) => ({ key: s.stage, state: s.state, here: s.here, accent: colors.stage[s.stage] }));
  return (
    <View testID={testID} style={frame}>
      <Caption tone="muted">{view.title}</Caption>
      <Spacer size="xs" />
      {/* The drawing is hidden from screen readers (StageSegments); this list reads the seven stages in words. */}
      <StageSegments segments={segments} testID={`${testID}-segments`} />
      <View role="list" aria-label={view.segmentsLabel} accessibilityLabel={view.segmentsLabel} style={srOnly} testID={`${testID}-segments-list`}>
        {view.segments.map((segment) => (
          <View key={segment.stage} role="listitem" testID={`${testID}-segment-${segment.order}`}>
            <Caption>{segment.a11yLabel}</Caption>
          </View>
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
      {/* The level-check note opens behind "About these rows" (owner request 2026-10-16, item 8). */}
      <View style={{ alignItems: 'flex-start' }}>
        <Button label={aboutRows} tone="ghost" size="sm" expanded={aboutOpen} onPress={() => setAboutOpen((v) => !v)} testID={`${testID}-about`} />
      </View>
      {aboutOpen ? (
        <Caption tone="muted" testID={`${testID}-note`}>
          {view.note}
        </Caption>
      ) : null}
      <Spacer size="sm" />
      {/* An outline button: See report is the card's one filled button. */}
      <View style={{ alignItems: 'flex-start' }}>
        <Button label={view.cta} tone="ghost" size="md" onPress={onOpen} testID={`${testID}-open`} />
      </View>
    </View>
  );
}

/**
 * Content that could not be read: the title and See Learning Route stay, so the
 * dashboard still reaches the page, which shows its own Try again card.
 */
export function LearningRouteRowFallback({ title, cta, onOpen, testID }: { title: string; cta: string; onOpen: () => void; testID: string }): React.ReactElement {
  return (
    <View testID={testID} style={frame}>
      <Caption tone="muted">{title}</Caption>
      <Spacer size="sm" />
      <View style={{ alignItems: 'flex-start' }}>
        <Button label={cta} tone="ghost" size="md" onPress={onOpen} testID={`${testID}-open`} />
      </View>
    </View>
  );
}

/**
 * One profile's row: builds the model with the page's own input
 * (`routeModelInput`, the same cursor and start route), so the row and the
 * read-only page always name the same stage. Nothing draws until the profile's
 * snapshot is read, so a child is never first shown as a new learner.
 * `showStarted` is false while the card already shows the Starting spot row,
 * so the level check appears once per card.
 */
export function LearningRouteRow({
  profileId,
  name,
  stored,
  showStarted,
  testID,
}: {
  profileId: string;
  name: string;
  /** The profile's stored snapshot; undefined when this profile has none yet (a new learner). */
  stored: ProgressSnapshot | undefined;
  showStarted: boolean;
  testID: string;
}): React.ReactElement | null {
  const messages = useMessages();
  const locale = useLocale();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const hydrated = useProgressStore((s) => s.hydratedFor.has(profileId));
  // The learner's access tier (F-ENT-003 section 3.4); re-renders when it changes, as the page does.
  const tier = useAccessTier(profileId);
  // This learner's cached inbox plans: the goal follows them (amendment section 4.1).
  const plans = usePlanStore((s) => s.byLearner[profileId]);
  const localized = useMemo(() => localizedRouteContent(locale), [locale]);
  // The skills count every quest's games, so every lesson chunk loads and the counts follow (F-CURR-002 §10).
  const lessonsLoaded = useLessonContentVersion();

  const view = useMemo((): DashboardRowView | null => {
    try {
      const snapshot = stored ?? emptySnapshot(profileId);
      const now = new Date();
      const next = routeNextInputOf({
        snapshot,
        profileId,
        today: dayKey(now.toISOString()),
        plans,
        quests: questsAll,
        episodes: episodesAll,
        tier,
        gatingActive: gatingActive(flags, bundleOs()),
        isQuestOpen: questOpenFor(profileId, now, snapshot),
      });
      const model = buildMyRoute(routeModelInput({ snapshot, tier, localized, now, next }));
      const spot = showStarted ? startingSpotRow(snapshot.placements) : null;
      const started = spot === null ? null : { stage: spot.level.stage, band: bandLabel(messages, spot.level), date: formatDate(locale, spot.takenAt, 'monthDay') };
      // The same goal the page's route card shows (LR-5a; R-9b shipped the slot).
      return dashboardRowView({ model, messages, name, started, goalStage: model.goal?.stage ?? null });
    } catch {
      return null;
    }
  }, [stored, profileId, name, showStarted, tier, plans, locale, localized, messages, lessonsLoaded]);

  if (!hydrated) return null;
  const onOpen = (): void => navigation.navigate('MyRoute', { profileId, viewer: 'grownup' });
  const words = messages.caregiver.journey.row;
  return view === null ? (
    <LearningRouteRowFallback title={words.title} cta={words.cta} onOpen={onOpen} testID={testID} />
  ) : (
    <LearningRouteRowView view={view} testID={testID} onOpen={onOpen} />
  );
}
