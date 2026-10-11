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
import type { StageKey, ThemeKey } from '@hangul-route/content-schema';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { episodesAll, questsAll } from '../../content';
import { gridEpisodes } from '../../content/episodes';
import { stages, themes } from '../../content/stages';
import { localizeQuest, localizeStage } from '../../logic/content-locale';
import { cellLook, startCell } from '../../logic/placement/cell-look';
import { bandLabel } from '../../logic/placement/copy';
import type { ResultLink, ResultPrimary } from '../../logic/placement/result-view';
import { usePlacement, type FinishedCheck, type ResultAction } from './context';
import { LinkButton } from './parts';

/**
 * Result (F-PLC-001 section 3.1 step 7, wireframe placement G): Hoya
 * cheering, the headline, the stage title and band label (the only words about
 * level: never a number, ratio, percent or "score"), a mini map with a pin on
 * the start cell and a light outline on cells the route skips ahead of, and
 * three route cards. A retake that changes nothing says so; a route with no
 * entitled quest left says "You know a lot!". The weekly-plan strip arrives
 * with P-7b; until then the primary is **Start**.
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
  seeMyRoute: 'seeMap',
  seeMap: 'seeMap',
  forGrownUps: 'forGrownUps',
  forGrownUpsPlan: 'forGrownUps',
  tryStandard: 'tryStandard',
};

function ResultView({ check }: { check: FinishedCheck }): React.ReactElement {
  const { m, flow, say, screenReader, onResultAction } = usePlacement();
  const copy = m.learner.placement.result;
  const { view } = check;
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
  const linkLabel: Record<ResultLink, string> = {
    seeMyRoute: copy.seeMyRoute,
    seeMap: copy.seeMap,
    forGrownUps: copy.forGrownUps,
    forGrownUpsPlan: copy.forGrownUpsPlan,
    tryStandard: copy.tryStandard,
  };

  return (
    <Screen tone="canvas" testID="placement-result">
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

      <Spacer size="xl" />
      <Button
        label={primaryLabel}
        tone="primary"
        size="hero"
        fullWidth
        leading={<Icon name="play" size={spacing.xl} color={colors.text.inverse} />}
        onPress={() => onResultAction(PRIMARY_ACTION[view.primary])}
        testID="placement-result-primary"
      />
      <Spacer size="sm" />
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
        {lines.map((line) => (
          <Body key={line} weight="semibold">
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
