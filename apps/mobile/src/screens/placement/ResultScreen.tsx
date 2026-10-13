import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  Icon,
  Screen,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import type { PaceId, StageKey, ThemeKey } from '@hangul-route/content-schema';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { episodesAll, questsAll } from '../../content';
import { gridEpisodes } from '../../content/episodes';
import { stages, themes } from '../../content/stages';
import { localizeQuest, localizeStage } from '../../logic/content-locale';
import { cellLook, startCell } from '../../logic/placement/cell-look';
import { bandLabel } from '../../logic/placement/copy';
import { stripLineOf } from '../../logic/placement/plan-offer';
import { stripSkipped, withPlanKept, withPlanMade, type ResultLink, type ResultPrimary } from '../../logic/placement/result-view';
import { PACE_IDS } from '../../logic/route/proposal-flow';
import { activeSelfRoute } from '../../logic/route/self-route';
import { keepPlan } from '../../store/plan-offer-store';
import { useProgressStore } from '../../store/progress-store';
import { useRouteStore } from '../../store/route-store';
import { usePlacement, type FinishedCheck, type ResultAction } from './context';
import { LinkButton } from './parts';
import { PlanStrip, PlanUpdateCard } from './PlanParts';

/**
 * Result (F-PLC-001 section 3.1 step 7, wireframe placement G): Hoya
 * cheering, the headline, the stage title and band label (the only words about
 * level: never a number, ratio, percent or "score"), a mini map with a pin on
 * the start cell and a light outline on cells the route skips ahead of, and
 * three route cards. A retake that changes nothing says so; a route with no
 * entitled quest left says "You know a lot!". Behind `flags.routeEnabled`
 * (P-7b, wireframe journey/my-route-overview.md J1, J3, K3): a self profile
 * gets the weekly-plan strip (**Use this plan** with one tap, no PIN, OD-14;
 * **Change**; **Just start**), below the not-tested line when reading was not
 * tested; a retake that found a later start with a plan gets **Update my
 * plan** / **Keep my plan**. Without either the primary is **Start**.
 */
export function ResultScreen(): React.ReactElement | null {
  const { finished } = usePlacement();
  return finished === null ? null : <ResultView check={finished} />;
}

const PRIMARY_ACTION: Readonly<Record<ResultPrimary, ResultAction>> = {
  start: 'start',
  seeMap: 'seeMap',
  openStories: 'openStories',
  usePlan: 'start',
  updatePlan: 'start',
};

const LINK_ACTION: Readonly<Record<ResultLink, ResultAction>> = {
  seeMyRoute: 'seeMyRoute',
  seeMap: 'seeMap',
  forGrownUps: 'forGrownUps',
  forGrownUpsPlan: 'forGrownUps',
  tryStandard: 'tryStandard',
};

function ResultView({ check }: { check: FinishedCheck }): React.ReactElement {
  const { m, flow, say, screenReader, onResultAction, acceptPlan, updatePlan, profileId } = usePlacement();
  const copy = m.learner.placement.result;
  // A plan made meanwhile (Change, then the proposal screen), or the proposal screen's Not now
  // after this result, replaces the strip with Start.
  const planMade = useProgressStore((s) => activeSelfRoute(s.byProfile[profileId]) !== null);
  const skipped = useRouteStore((s) => stripSkipped(s.ui[profileId]?.dismissedAt, check.result.completedAt));
  const [kept, setKept] = useState(false);
  const madeView = planMade || skipped ? withPlanMade(check.view) : check.view;
  const view = kept ? withPlanKept(madeView) : madeView;
  const offer = check.offer;
  const [pace, setPace] = useState<PaceId>(offer?.kind === 'new' ? offer.pace : 'steady');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Two taps in one frame both see `busy` false; the ref lets only the first one through.
  const acting = useRef(false);
  const act = async (work: () => Promise<boolean>): Promise<void> => {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    setFailed(false);
    const ok = await work();
    acting.current = false;
    setBusy(false);
    if (!ok) setFailed(true);
  };
  const locale = flow.testLocale;
  const headline = copy[view.headline];

  useEffect(() => {
    if (!screenReader) void say(headline);
  }, [screenReader, say, headline]);

  const questTitle = (id: string): string => {
    const quest = questsAll.find((q) => q.id === id);
    return quest === undefined ? '' : localizeQuest(quest, locale).titleEn;
  };
  const stageTitle = (key: StageKey): string => {
    const stage = stages.find((s) => s.key === key);
    return stage === undefined ? '' : localizeStage(stage, locale).titleEn;
  };
  const primaryLabel = { start: copy.start.cta, seeMap: copy.seeMap, openStories: copy.openStories, usePlan: copy.start.cta, updatePlan: copy.start.cta }[view.primary];
  // With the strip or the update card the one primary sits inside the card (J1, K3), not pinned.
  const inCard = view.strip || view.planUpdate;
  const shown = offer?.kind === 'new' ? offer.byPace[pace] : undefined;
  const line = shown === undefined ? null : stripLineOf(shown);
  const t = m.learner.weeklyPlan.proposal;
  const linkLabel: Record<ResultLink, string> = {
    seeMyRoute: copy.seeMyRoute,
    seeMap: copy.seeMap,
    forGrownUps: copy.forGrownUps,
    forGrownUpsPlan: copy.forGrownUpsPlan,
    tryStandard: copy.tryStandard,
  };

  return (
    <Screen
      tone="canvas"
      testID="placement-result"
      footer={
        inCard ? undefined : (
        <Button
          label={primaryLabel}
          tone="primary"
          size="hero"
          fullWidth
          leading={<Icon name="play" size={spacing.xl} color={colors.text.inverse} />}
          onPress={() => onResultAction(PRIMARY_ACTION[view.primary])}
          testID="placement-result-primary"
        />
        )
      }
    >
      <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg }}>
        <Hoya pose="cheering" size={touchTarget.hero + touchTarget.min} />
        <Heading level="title" align="center" testID="placement-headline">
          {headline}
        </Heading>
        {view.headline === 'knowALot' ? null : (
          <Body align="center" weight="semibold" testID="placement-level">
            {`${stageTitle(view.level.stage)} · ${bandLabel(m, view.level)}`}
          </Body>
        )}
      </View>
      {view.notTestedLine ? (
        <>
          <Spacer size="sm" />
          <Body align="center" tone="secondary">
            {copy.notTestedLine}
          </Body>
        </>
      ) : null}
      {view.retryHidden ? (
        <View style={{ alignItems: 'center' }}>
          <LinkButton label={copy.retryHidden} onPress={() => onResultAction('retryHidden')} testID="placement-retry-hidden" />
        </View>
      ) : null}
      {view.routeLine === null ? null : (
        <>
          <Spacer size="sm" />
          <Body align="center" testID="placement-route-line">
            {copy[view.routeLine]}
          </Body>
        </>
      )}

      <Spacer size="lg" />
      <MiniMap check={check} label={copy.map} />

      {view.cards.startHere === null ? null : (
        <>
          <Spacer size="lg" />
          <Card padding="md" testID="placement-route-cards">
            <RouteCard title={copy.startHere} lines={[questTitle(view.cards.startHere)]} icon="pin" />
            {view.cards.next.length > 0 ? <RouteCard title={copy.next} lines={view.cards.next.map(questTitle)} /> : null}
            {view.cards.laterStage === null ? null : <RouteCard title={copy.later} lines={[stageTitle(view.cards.laterStage)]} />}
          </Card>
        </>
      )}

      {view.strip && line !== null && offer?.kind === 'new' ? (
        <>
          <Spacer size="lg" />
          <PlanStrip
            m={m}
            pace={pace}
            paces={PACE_IDS.filter((id) => offer.byPace[id] !== undefined)}
            basis={copy.strip.basis(t.length[line.length], line.days, line.minutes)}
            busy={busy}
            failed={failed}
            onPace={setPace}
            onUse={() => void act(() => acceptPlan(pace))}
            onChange={() => onResultAction('changePlan')}
          />
          <Spacer size="sm" />
          <Button
            label={copy.strip.justStart}
            tone="ghost"
            size="lg"
            fullWidth
            disabled={busy}
            onPress={() => {
              // Once: a second tap before the stack resets would skip (and count the skip) twice.
              if (acting.current) return;
              acting.current = true;
              setBusy(true);
              onResultAction('justStart');
            }}
            testID="placement-plan-just-start"
          />
        </>
      ) : null}
      {view.planUpdate ? (
        <>
          <Spacer size="lg" />
          <PlanUpdateCard m={m} busy={busy} failed={failed} onUpdate={() => void act(updatePlan)} onKeep={() => {
              setKept(true);
              // The report's update card stays quiet for this change too.
              void keepPlan(profileId);
            }} />
        </>
      ) : null}

      <Spacer size="md" />
      <View style={{ alignItems: 'center' }}>
        {view.links.map((link) => (
          <LinkButton key={link} label={linkLabel[link]} onPress={() => onResultAction(LINK_ACTION[link])} testID={`placement-link-${link}`} />
        ))}
      </View>
    </Screen>
  );
}

function RouteCard({ title, lines, icon }: { title: string; lines: string[]; icon?: 'pin' }): React.ReactElement {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm }}>
      <View style={{ width: spacing.xl, alignItems: 'center', paddingTop: spacing.xxs }}>
        {icon ? <Icon name={icon} size={spacing.lg} color={colors.brand.primary} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Caption tone="secondary">{title}</Caption>
        {/* Two quests may share a title (or have none on this build): keyed by position. */}
        {lines.map((line, index) => (
          <Body key={`${index}:${line}`} weight="semibold">
            {line}
          </Body>
        ))}
      </View>
    </View>
  );
}

/**
 * The 7 x 5 map: a pin on the start cell, a light outline and a small check on
 * cells whose quests are all placed out or done (still tappable later, never
 * "completed"), the completed tint on finished cells. One accessible element.
 */
function MiniMap({ check, label }: { check: FinishedCheck; label: string }): React.ReactElement {
  const grid = gridEpisodes(episodesAll);
  const episodeAt = (stage: StageKey, theme: ThemeKey): string | undefined =>
    grid.find((e) => e.stage === stage && e.theme === theme)?.id;
  const start = startCell(check.catalog, check.startQuest?.questId ?? null);
  const cell = spacing.xl;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} testID="placement-map" style={{ alignItems: 'center', gap: spacing.xs }}>
      {stages.map((stage) => (
        <View key={stage.key} style={{ flexDirection: 'row', gap: spacing.xs }}>
          {themes.map((theme) => {
            const episodeId = episodeAt(stage.key, theme.key);
            const isStart = start !== null && start.stage === stage.key && start.theme === theme.key;
            const look = episodeId === undefined ? 'none' : cellLook(episodeId, check.catalog, check.placedOut, check.completed);
            const background = isStart
              ? colors.brand.primary
              : look === 'done'
                ? colors.feedback.successLight
                : episodeId === undefined
                  ? colors.surface.canvas
                  : look === 'placed-out'
                    ? colors.surface.paper
                    : colors.surface.sunken;
            return (
              <View
                key={theme.key}
                testID={isStart ? 'placement-map-start' : look === 'placed-out' ? 'placement-map-placed-out' : undefined}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: radii.sm,
                  borderWidth: look === 'placed-out' && !isStart ? borderWidth.base : borderWidth.thin,
                  borderColor: look === 'placed-out' && !isStart ? colors.brand.primary : colors.border.subtle,
                  backgroundColor: background,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isStart ? <Icon name="pin" size={spacing.lg} color={colors.text.inverse} /> : null}
                {look === 'placed-out' && !isStart ? <Icon name="check-circle" size={spacing.md} color={colors.brand.primary} /> : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
