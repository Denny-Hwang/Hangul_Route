import { Body, Button, Card, Heading, Hoya, Icon, Screen, Spacer, spacing } from '@hangul-route/design-system';
import { CATALOG } from '@hangul-route/content-schema';
import { formatDate } from '@hangul-route/i18n';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { isParentSessionValid } from '../../logic/profiles/session';
import { effectiveLearnerType } from '../../logic/profiles/learner-type';
import { movedLineVisible } from '../../logic/route/home-slot';
import { planOverview } from '../../logic/route/plan-view';
import { profileRowOpens } from '../../logic/route/proposal-flow';
import { checkInOffer } from '../../logic/route/repace';
import { activeSelfRoute, completedQuestIdsOf } from '../../logic/route/self-route';
import type { RootStackParamList } from '../../navigation/types';
import { useAudience } from '../../store/audience';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useRouteStore } from '../../store/route-store';
import { useUiStore } from '../../store/ui-store';
import { LinkButton } from '../placement/parts';
import { CheckInCard, useShownOffer } from './CheckInCard';
import { PlanWeekCard } from './parts';
import { useToday } from './use-today';

/**
 * "Your weekly plan" (F-PLAN-002 section 3.9, wireframe console/curriculum-planner.md G3 as
 * amended by FP-B13 / FP-B15): the week that holds today first, the later weeks folded, the
 * optional extras, the Hoya check-in of week 5 when it applies (FP-B14), and **Move my plan
 * along**, **Change the plan** and **Stop this plan** (confirmed; what was finished stays). Never
 * behind, late, missed or overdue; the level is never named ("We found a path for you"). The calm
 * line "Hoya moved your plan along" shows once after an automatic re-pace (section 3.7).
 */

type Props = NativeStackScreenProps<RootStackParamList, 'RouteOverview'>;

export function RouteOverviewScreen({ route, navigation }: Props): React.ReactElement {
  const { profileId } = route.params;
  const m = useMessages();
  const t = m.learner.weeklyPlan.overview;
  const locale = useLocale();
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId) ?? null);
  const snapshot = useProgressStore((s) => s.byProfile[profileId]);
  const ui = useRouteStore((s) => s.ui[profileId]);
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const { opensDirectly } = useAudience();
  // Read again on focus and when the app comes back: the screen may stay open across midnight.
  const today = useToday();
  const [showLater, setShowLater] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [movedByHand, setMovedByHand] = useState(false);
  const [failed, setFailed] = useState(false);
  // The calm line is read once per visit: it stays on screen for this visit and is marked seen.
  const [movedLine, setMovedLine] = useState(false);

  useEffect(() => {
    void useProgressStore.getState().hydrate(profileId);
  }, [profileId]);

  useFocusEffect(
    useCallback(() => {
      void useRouteStore
        .getState()
        .loadUi(profileId)
        .then((loaded) => {
          if (!movedLineVisible(loaded)) return;
          setMovedLine(true);
          void useRouteStore.getState().markMovedSeen(profileId, new Date().toISOString());
        });
      return undefined;
    }, [profileId]),
  );

  const active = activeSelfRoute(snapshot);
  const completed = useMemo(() => completedQuestIdsOf(snapshot?.quests), [snapshot]);
  const view = useMemo(() => (active === null ? null : planOverview(active, today)), [active, today]);
  const offer = ui === undefined ? null : checkInOffer({ route: active, completedQuestIds: completed, today, answeredFor: ui.checkInFor });
  const [shownOffer, closeOffer] = useShownOffer(offer, `${profileId}|${active?.id ?? ''}`);
  const stale = active !== null && active.meta.catalogVersion !== CATALOG.version;

  const leave = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main', { screen: 'Home' });
  };

  // Change the plan, Make a new plan and Make a weekly plan: a child's plan goes through the grown-up gate (section 3.9).
  const openGated = (next: 'RouteSetup' | 'RouteProposal'): void => {
    if (profile === null) return;
    const sessionOpen = isParentSessionValid(parentGateOpenedAt === null ? null : { openedAt: parentGateOpenedAt, profileId: 'family' }, Date.now());
    if (profileRowOpens({ learnerType: effectiveLearnerType(profile), opensDirectly: opensDirectly(sessionOpen) }) !== 'proposal') {
      navigation.navigate('PinEntry', { next, profileId });
    } else if (next === 'RouteSetup') {
      navigation.navigate('RouteSetup', { profileId });
    } else {
      navigation.replace('RouteProposal', { source: 'profile', profileId });
    }
  };
  const changePlan = (): void => openGated('RouteSetup');

  /** Runs one plan change; anything that did not work shows the calm failed line and never leaves the buttons off. */
  const run = async (change: () => Promise<boolean>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setFailed(false);
    let ok = false;
    try {
      ok = await change();
    } catch {
      ok = false;
    } finally {
      setBusy(false);
    }
    setFailed(!ok);
    return ok;
  };

  const moveAlong = async (): Promise<void> => {
    setMovedByHand(await run(() => useRouteStore.getState().repaceNow(profileId)));
  };

  const stop = async (): Promise<void> => {
    if (await run(() => useRouteStore.getState().archive(profileId))) setConfirmStop(false);
  };

  const openTopic = (topicKey: string): void => navigation.navigate('VocabTopic', { topicKey });

  const header = (
    <>
      <Pressable
        onPress={leave}
        hitSlop={spacing.md}
        accessibilityRole="button"
        accessibilityLabel={m.a11y.goBack}
        style={{ alignSelf: 'flex-start', padding: spacing.xs }}
        testID="route-overview-back"
      >
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">{t.title}</Heading>
      <Spacer size="md" />
    </>
  );

  if (snapshot === undefined) {
    return (
      <Screen tone="canvas" scrollable>
        {header}
      </Screen>
    );
  }

  // No plan (it was stopped, or never made): one way to make one.
  if (active === null || view === null) {
    return (
      <Screen tone="canvas" scrollable>
        {header}
        <Body testID="route-overview-none">{t.none}</Body>
        <Spacer size="xl" />
        <Button
          label={t.make.cta}
          tone="primary"
          size="lg"
          fullWidth
          onPress={() => openGated('RouteProposal')}
          testID="route-overview-make"
        />
        <Spacer size="sm" />
        <LinkButton label={t.back.cta} onPress={leave} testID="route-overview-leave" />
      </Screen>
    );
  }

  const startsOn = formatDate(locale, `${view.startsOn}T00:00:00Z`, 'monthDay', { utc: true });

  return (
    <Screen tone="canvas" scrollable>
      {header}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Hoya pose="cheering" size={72} accessibilityLabel={m.a11y.hoya('cheering')} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Body weight="semibold" size="lg">
            {view.status === 'finished' ? t.finished : t.intro}
          </Body>
          {movedLine ? (
            <Body tone="secondary" testID="route-overview-moved">
              {t.moved}
            </Body>
          ) : null}
          {movedByHand ? (
            <Body tone="secondary" testID="route-overview-moved-by-hand">
              {t.movedDone}
            </Body>
          ) : null}
        </View>
      </View>

      {shownOffer !== null ? (
        <>
          <Spacer size="lg" />
          <CheckInCard profileId={profileId} offer={shownOffer} onClose={closeOffer} testID="route-overview-check-in" />
        </>
      ) : null}

      {view.status === 'finished' ? (
        <>
          <Spacer size="xl" />
          <Button
            label={t.newPlan.cta}
            tone="primary"
            size="lg"
            fullWidth
            onPress={changePlan}
            testID="route-overview-new-plan"
          />
        </>
      ) : (
        <>
          <Spacer size="lg" />
          <Heading level="prompt">{view.status === 'upcoming' ? t.firstWeek : t.thisWeek}</Heading>
          {view.status === 'upcoming' ? <Body tone="secondary">{t.startsOn(startsOn)}</Body> : null}
          <Spacer size="sm" />
          {view.current !== null ? <PlanWeekCard week={view.current} locale={locale} onOpenTopic={openTopic} testID="route-overview-current" /> : <Body tone="secondary">{t.nothingThisWeek}</Body>}
          {view.later.length > 0 ? (
            <>
              <Spacer size="md" />
              <Button
                label={showLater ? m.learner.weeklyPlan.planPreview.hideLater.cta : m.learner.weeklyPlan.planPreview.showLater(view.later.length)}
                tone="ghost"
                size="md"
                expanded={showLater}
                onPress={() => setShowLater((open) => !open)}
                testID="route-overview-later"
              />
              {showLater ? (
                <View style={{ gap: spacing.md, marginTop: spacing.sm }} accessibilityLabel={t.nextWeeks}>
                  {view.later.map((week) => (
                    <PlanWeekCard key={week.index} week={week} locale={locale} onOpenTopic={openTopic} testID={`route-overview-week-${week.index}`} />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          <Spacer size="xl" />
          {stale ? (
            <>
              <Body tone="secondary" testID="route-overview-new-lessons">
                {t.newLessons}
              </Body>
              <Spacer size="sm" />
            </>
          ) : null}
          <Button
            label={t.moveAlong.cta}
            tone="secondary"
            size="lg"
            fullWidth
            disabled={busy}
            onPress={() => void moveAlong()}
            testID="route-overview-move-along"
          />
          <Spacer size="sm" />
          <Button label={t.change.cta} tone="ghost" size="md" fullWidth onPress={changePlan} testID="route-overview-change" />
        </>
      )}

      {failed ? (
        <>
          <Spacer size="sm" />
          <Body tone="secondary" testID="route-overview-failed">
            {m.learner.weeklyPlan.planPreview.saveFailed}
          </Body>
        </>
      ) : null}
      <Spacer size="lg" />
      {confirmStop ? (
        <Card padding="md" tone="sunken" testID="route-overview-stop-confirm">
          <Body>{t.stopConfirm.line}</Body>
          <Spacer size="sm" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
            <Button label={t.stopConfirm.yes.cta} tone="secondary" size="md" disabled={busy} onPress={() => void stop()} testID="route-overview-stop-yes" />
            <LinkButton label={t.stopConfirm.no.cta} onPress={() => setConfirmStop(false)} testID="route-overview-stop-no" />
          </View>
        </Card>
      ) : (
        <LinkButton label={t.stop.cta} onPress={() => setConfirmStop(true)} testID="route-overview-stop" />
      )}
      <Spacer size="xl" />
    </Screen>
  );
}
