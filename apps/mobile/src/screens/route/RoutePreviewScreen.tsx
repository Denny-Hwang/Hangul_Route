import { Body, Button, Heading, Icon, Screen, Spacer, spacing } from '@hangul-route/design-system';
import { CATALOG, generateCurriculum, type CurriculumDraft, type SelfRoute } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { draftWeeks, learnerNotices, previewStats, previewWeeks, type LearnerNotice } from '../../logic/route/plan-view';
import { routesAfterStart, setupParams } from '../../logic/route/setup-flow';
import type { RootStackParamList } from '../../navigation/types';
import { useRouteStore } from '../../store/route-store';
import { LinkButton } from '../../components/LinkButton';
import { PlanWeekCard } from './parts';
import { usePlanBasis } from './use-plan-basis';

/**
 * The new plan before it starts (F-PLAN-002 section 3.9, wireframe console/curriculum-planner.md
 * G2): the first four weeks open and the later ones behind one row, the stats and the notices in
 * the UI language. The Premium warning is never shown here: locked and unreleased parts read
 * only "More lessons are coming." **Start this plan** stores it (`routeStore.create`, from
 * `setup`, replacing the plan in force when there is one), derives its first week and opens the overview; **Change something** goes back.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'RoutePreview'>;
type PreviewMessages = Messages['learner']['weeklyPlan']['planPreview'];

function noticeText(t: PreviewMessages['notices'], notice: LearnerNotice): string {
  switch (notice.code) {
    case 'content-runs-out':
      return t.contentRunsOut(notice.week);
    case 'more-coming':
      return t.moreComing;
    case 'did-not-fit':
      return t.didNotFit(notice.count);
    case 'too-short':
      return t.tooShort(notice.count);
    case 'already-known':
      return t.alreadyKnown(notice.count);
  }
}

export function RoutePreviewScreen({ route, navigation }: Props): React.ReactElement {
  const { profileId, setup, replacing } = route.params;
  const m = useMessages();
  const t = m.learner.weeklyPlan.planPreview;
  const locale = useLocale();
  const { basis } = usePlanBasis(profileId);
  const [showLater, setShowLater] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const draft = useMemo((): CurriculumDraft | null => {
    if (basis === null) return null;
    try {
      return generateCurriculum(setupParams(basis.ctx, setup), CATALOG);
    } catch {
      return null;
    }
  }, [basis, setup]);

  const back = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main', { screen: 'Home' });
  };

  const start = async (): Promise<void> => {
    if (draft === null || busy) return;
    setBusy(true);
    setFailed(false);
    // Change the plan replaces the plan these steps started from (section 3.9), and only that one: a plan
    // that became active meanwhile (a sync, another tab) is never overwritten, the failed line shows instead.
    let created: SelfRoute | null = null;
    try {
      created = await useRouteStore.getState().create(profileId, draft, { from: 'setup', changed: true, ...(replacing === null ? {} : { replacing }) });
    } catch {
      created = null;
    } finally {
      setBusy(false);
    }
    if (created === null) {
      setFailed(true);
      return;
    }
    navigation.dispatch((state) => {
      const routes = routesAfterStart(state.routes, { key: `RouteOverview-${created.id}`, name: 'RouteOverview' as const, params: { profileId } });
      return CommonActions.reset({ ...state, routes, index: routes.length - 1 });
    });
  };

  const weeks = draft === null ? null : previewWeeks(draft);
  const stats = draft === null ? null : previewStats(draft);
  const notices = draft === null ? [] : learnerNotices(draft);
  const ready = weeks !== null && stats !== null && stats.items > 0;

  return (
    <Screen tone="canvas" scrollable>
      <Pressable
        onPress={back}
        hitSlop={spacing.md}
        accessibilityRole="button"
        accessibilityLabel={m.a11y.goBack}
        style={{ alignSelf: 'flex-start', padding: spacing.xs }}
        testID="route-preview-back"
      >
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">{t.title}</Heading>
      <Spacer size="sm" />
      {stats !== null && ready ? (
        <Body tone="secondary" testID="route-preview-stats">
          {t.stats(stats.items, stats.minutes, stats.stage)}
        </Body>
      ) : null}
      {notices.length > 0 ? (
        <View testID="route-preview-notices" style={{ marginTop: spacing.sm, gap: spacing.xs }}>
          {notices.map((notice) => (
            <Body key={notice.code}>{noticeText(t.notices, notice)}</Body>
          ))}
        </View>
      ) : null}
      <Spacer size="md" />
      {ready && weeks !== null ? (
        <View style={{ gap: spacing.md }}>
          {weeks.open.map((week) => (
            <PlanWeekCard key={week.index} week={week} locale={locale} testID={`route-preview-week-${week.index}`} />
          ))}
          {weeks.later > 0 ? (
            <Button
              label={showLater ? t.hideLater.cta : t.showLater(weeks.later)}
              tone="ghost"
              size="md"
              expanded={showLater}
              onPress={() => setShowLater((open) => !open)}
              testID="route-preview-later"
            />
          ) : null}
          {showLater && draft !== null
            ? draftWeeks(draft).slice(weeks.open.length).map((week) => (
                <PlanWeekCard key={week.index} week={week} locale={locale} testID={`route-preview-week-${week.index}`} />
              ))
            : null}
        </View>
      ) : (
        <Body testID="route-preview-empty">{t.empty}</Body>
      )}

      <Spacer size="xl" />
      {failed ? (
        <>
          <Body tone="secondary" testID="route-preview-failed">
            {t.saveFailed}
          </Body>
          <Spacer size="sm" />
        </>
      ) : null}
      {ready ? (
        <Button
          label={busy ? t.starting.cta : t.start.cta}
          tone="primary"
          size="lg"
          fullWidth
          disabled={busy}
          onPress={() => void start()}
          testID="route-preview-start"
        />
      ) : null}
      <Spacer size="sm" />
      <LinkButton label={t.change.cta} onPress={back} testID="route-preview-change" />
      <Spacer size="xl" />
    </Screen>
  );
}
