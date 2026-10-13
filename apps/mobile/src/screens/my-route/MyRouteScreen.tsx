import { Body, Button, Card, Heading, Hoya, Icon, Screen, Spacer, colors, spacing, useLayoutClass, useMediaSize } from '@hangul-route/design-system';
import type { ThemeKey } from '@hangul-route/content-schema';
import { formatDate } from '@hangul-route/i18n';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { bundleOs, flags, gatingActive } from '../../config/flags';
import { episodesAll, questsAll } from '../../content';
import { vocabTopics } from '../../content/vocab';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeQuest } from '../../logic/content-locale';
import { dayKey } from '../../logic/homework/mission-builder';
import { myRouteAccess, myRouteEntryOf, selfEntryTab } from '../../logic/my-route/access';
import { firstGoalReachedFor, focusEffects, goalRecordFor, seenForView, seenReadAfter } from '../../logic/my-route/focus';
import { practiceTopicOf } from '../../logic/my-route/free-end';
import { buildMyRoute } from '../../logic/my-route/model';
import { localizedRouteContent, routeLetterWall, routeModelInput, routeWeekOf } from '../../logic/my-route/route-input';
import { readSeen, seenFrom, withGoalReached, writeSeen } from '../../logic/my-route/seen';
import { continueTappedEvent, goalReachedEvent, stageOpenedEvent, viewedEvent } from '../../logic/my-route/telemetry';
import type { MyRouteModel, SeenRecord } from '../../logic/my-route/types';
import { emptySnapshot, myRouteView, stageRowLook } from '../../logic/my-route/view';
import { isParentSessionValid } from '../../logic/profiles/session';
import { nextStartedEvent, routeNextInputOf } from '../../logic/route-next';
import { defaultStoryIndex } from '../../logic/story/story-index';
import type { RootStackParamList } from '../../navigation/types';
import { useReducedMotion } from '../../platform/motion';
import { readJson, writeJson } from '../../platform/storage';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { LinkButton } from '../placement/parts';
import { usePlanStore } from '../../store/plan-store';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { questOpenFor, useAccessTier, useQuestAccess } from '../../store/tier-store';
import { useUiStore } from '../../store/ui-store';
import { GainsCard, StoriesNote } from './GainsCard';
import { RouteCard } from './RouteCard';
import { SkillsCard } from './SkillsCard';
import { LaterRowItem, StageRowItem } from './TrailRow';

/**
 * My route (F-ROUTE-001 R-3): where the learner is in the whole journey, at a
 * glance. One reading column on phone, tablet and desktop (sections 3.11,
 * F-LAYOUT-001 `Screen width="reading"`): the route card, the weekly plan line,
 * the new-quests line, the trail of seven stages, what the quests practice
 * (reading, listening and writing only), gains and the stories note. Wireframe:
 * `design/wireframes/journey/my-route-overview.md` (A to G, L); the drawn pips:
 * `design/components/PipRow/spec.md`. Everything is derived from the local
 * snapshot and the bundle, so it works offline.
 *
 * Two variants (AMENDMENTS-ROUTE-LEARNING-ROUTE section 5.1, LR-4; wireframe
 * `design/wireframes/journey/learning-route.md` A and G, mock
 * `design/screens/learning-route/mock/route-tab.html`):
 * - `tab`: the learner's Route tab (`MyRouteTabScreen`), the active profile's
 *   own page. No back button; the title "Learning Route" over the purpose line.
 *   `route_map.viewed` with `source: 'tab'` once per focus.
 * - `stack`: the root-stack `MyRoute` screen (`MyRouteScreen`), grown-up only
 *   and always read-only, behind the gate. It sends nothing.
 *
 * The route card (LR-5a; `design/screens/learning-route/route-card.md`): the
 * page builds F-ENT-003's `routeNextInputOf(...)` exactly as Home does and
 * passes it to `routeModelInput`, so the card's Next is Home card (2)'s quest,
 * the goal comes from the same weekly plans, and the cells of the plan view
 * carry "In your plan". Quest access comes from F-ENT-003's tier store:
 * `useQuestAccess()` on the learner's tab, `questOpenFor(profileId)` for the
 * grown-up's read-only view of a learner.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'MyRoute'>;
type Navigation = NativeStackNavigationProp<RootStackParamList>;
type Variant = 'tab' | 'stack';

const STORAGE = { readJson, writeJson };

/** The root-stack screen: one learner's page for a grown-up, read-only (section 5.1). */
export function MyRouteScreen({ route, navigation }: Props): React.ReactElement {
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const { opensDirectly } = useAudience();
  const sessionOpen = isParentSessionValid(parentGateOpenedAt === null ? null : { openedAt: parentGateOpenedAt, profileId: 'family' }, Date.now());
  // The params are typed as required; an old call without them reads as the tab entry (`myRouteEntryOf`).
  const params: Partial<RootStackParamList['MyRoute']> | undefined = route.params;
  const access = myRouteAccess({
    entry: myRouteEntryOf(route.params),
    requestedId: params?.profileId,
    activeId,
    profiles,
    gateOpen: opensDirectly(sessionOpen),
  });
  const gateFor = access.kind === 'gate' ? access.profileId : null;

  useEffect(() => {
    // The gate is closed: the PIN screen replaces this one (section 3.1).
    if (gateFor !== null) navigation.replace('PinEntry', { next: 'MyRoute', profileId: gateFor });
    // A learner's own page is the Route tab: an old call moves there, so there is never a second copy (section 5.1).
    // `navigate`, not the section's literal `replace`: `Main` is always below this screen, and navigate returns to
    // that same route (popping this one), where replace would stack a second `Main` with its own tab bar.
    else if (access.kind === 'self') navigation.navigate('Main', { screen: selfEntryTab(flags.myRouteEnabled) });
    else if (access.kind === 'none' && navigation.canGoBack()) navigation.goBack();
  }, [gateFor, access.kind, navigation]);

  if (access.kind !== 'readOnly') return <Screen tone="canvas">{null}</Screen>;
  return <MyRouteBody key={access.profileId} profileId={access.profileId} readOnly variant="stack" navigation={navigation} />;
}

/** The Route tab (LR-4): the active profile's own page. Mounted only while `flags.myRouteEnabled` is on (`mainTabs`). */
export function MyRouteTabScreen(): React.ReactElement {
  const navigation = useNavigation<Navigation>();
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const access = myRouteAccess({ entry: 'tab', requestedId: undefined, activeId, profiles, gateOpen: false });
  if (access.kind !== 'self') return <Screen tone="canvas">{null}</Screen>;
  return <MyRouteBody key={access.profileId} profileId={access.profileId} readOnly={false} variant="tab" navigation={navigation} />;
}

interface BodyProps {
  profileId: string;
  readOnly: boolean;
  variant: Variant;
  navigation: Navigation;
}

function MyRouteBody({ profileId, readOnly, variant, navigation }: BodyProps): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.myRoute;
  const locale = useLocale();
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId));
  const snap = useProgressStore((s) => s.byProfile[profileId]);
  // The access tier (F-ENT-003 section 3.4); re-renders when it changes, as Home and Results do.
  const tier = useAccessTier(profileId);
  // Quest access (F-ENT-003 section 3.4): the active learner's own, or the viewed learner's for a grown-up.
  const activeQuestOpen = useQuestAccess();
  // The learner's cached inbox plans: the goal and the one next follow them (amendment sections 4.1, 4.4).
  const plans = usePlanStore((s) => s.byLearner[profileId]);
  const hoyaSize = useMediaSize(64);
  const { windowWidth } = useLayoutClass();
  const reducedMotion = useReducedMotion();

  // Each focus is one open (the tab stays mounted between visits): counted from 1, 0 before the first focus.
  const [focusKey, setFocusKey] = useState(0);
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocusKey((k) => k + 1);
      setFocused(true);
      return () => {
        setFocused(false);
      };
    }, []),
  );

  // The record this open starts from (section 3.10), read again on every focus; for the active learner only.
  // The read waits for the previous focus's write (`seenReadAfter`), so a quick tab switch never reads the record
  // from before it; a read superseded by a newer focus is dropped.
  const [seenRead, setSeenRead] = useState<SeenRecord | undefined>(undefined);
  const [seenFor, setSeenFor] = useState(0);
  const pendingWrite = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    if (readOnly || focusKey === 0) return;
    let live = true;
    void seenReadAfter(pendingWrite.current, () => readSeen(STORAGE, profileId), () => live).then((result) => {
      if (result === null) return;
      setSeenRead(result.record);
      setSeenFor(focusKey);
    });
    return () => {
      live = false;
    };
  }, [profileId, readOnly, focusKey]);
  // What is new is measured against this open's record only, and only while the page is in front (`seenForView`).
  const seen = seenForView({ focusKey, seenFor, focused, seen: seenRead });

  const [attempt, setAttempt] = useState(0);
  const localized = useMemo(() => localizedRouteContent(locale), [locale]);
  // The free-end hero's Practice words: the first free word topic this build lists (LR-5b).
  const practiceTopic = useMemo(() => practiceTopicOf(vocabTopics.map((t) => t.key)), []);

  const built = useMemo((): { model: MyRouteModel; week: number | null } | { error: true } => {
    try {
      const snapshot = snap ?? emptySnapshot(profileId);
      const now = new Date();
      // The same input Home builds (F-ENT-003 section 3.5), so the page names Home card (2)'s quest.
      const next = routeNextInputOf({
        snapshot,
        profileId,
        today: dayKey(now.toISOString()),
        plans,
        quests: questsAll,
        episodes: episodesAll,
        tier,
        gatingActive: gatingActive(flags, bundleOs()),
        isQuestOpen: readOnly ? questOpenFor(profileId, now, snapshot) : activeQuestOpen,
      });
      const model = buildMyRoute(routeModelInput({ snapshot, tier, localized, seen, now, next }));
      return { model, week: routeWeekOf(model, next) };
    } catch {
      return { error: true };
    }
    // `attempt` is the retry.
  }, [snap, profileId, tier, plans, readOnly, activeQuestOpen, localized, seen, attempt]);
  const model = 'model' in built ? built.model : null;
  const week = 'model' in built ? built.week : null;
  // The first visit that shows a reached plan goal (LR-5c, section 4.3): Hoya cheers and the card says so for this
  // visit only; the effect below records the goal and sends route_map.goal_reached. Never read-only.
  const firstReached = firstGoalReachedFor({ focusKey, seenFor, focused, readOnly, goal: model?.goal ?? null, seen: seenRead });

  const view = useMemo(() => {
    if (model === null) return null;
    const themeTitles = Object.fromEntries(localized.themes.map((t) => [t.key, t.titleEn])) as Record<ThemeKey, string>;
    // The card names F-ENT-003's one next (amendment section 4.4), not the catalogue cursor.
    const quest = model.next ? questsAll.find((q) => q.id === model.next?.questId) : undefined;
    return myRouteView({
      model,
      messages,
      viewer: readOnly ? 'grownup' : 'self',
      name: profile?.displayName ?? '',
      themeTitles,
      nextTitle: quest ? localizeQuest(quest, locale).titleEn : null,
      hasStories: defaultStoryIndex().some((e) => e.placement === 'shelf'),
      practiceTopic,
      seen,
      firstReached,
      letterWall: routeLetterWall(model),
      week,
      // Open plan (R-7d) needs F-PLAN-002's RouteOverview, which the navigator mounts only behind this flag.
      planOverview: flags.routeEnabled,
      // "Plan ends {date}" on the grown-up card only (LR-OD-7); a plan day is a UTC calendar day.
      formatDay: (day) => formatDate(locale, `${day}T00:00:00.000Z`, 'monthDay', { utc: true }),
    });
  }, [model, messages, readOnly, profile?.displayName, localized, locale, seen, firstReached, week, practiceTopic]);

  // Once per focus: route_map.viewed from the tab, then remember what this open saw (active learner only, never
  // read-only: the grown-up screen sends and writes nothing, section 8).
  const viewedFor = useRef(0);
  const seenWrittenFor = useRef(0);
  const goalRecordedFor = useRef<string | null>(null);
  useEffect(() => {
    if (model === null) return;
    const fx = focusEffects({ focusKey, viewedFor: viewedFor.current, seenFor, seenWrittenFor: seenWrittenFor.current, readOnly, modelReady: true });
    if (fx.sendViewed) {
      viewedFor.current = focusKey;
      const event = viewedEvent({ profileId, model, source: 'tab', readOnly });
      if (event) void track(event);
    }
    // A goal reached for the first time (LR-5c) is recorded once per focus: with this focus's seen write, or on
    // its own when it is reached later while the tab is in front.
    const goalRecord = goalRecordFor({ focusKey, seenWrittenFor: seenWrittenFor.current, writeSeenNow: fx.writeSeen, firstReached, goal: model.goal, recordedFor: goalRecordedFor.current });
    if (goalRecord) goalRecordedFor.current = goalRecord.mark;
    const goal = goalRecord ? model.goal : null;
    let written: Promise<boolean> | null = null;
    if (fx.writeSeen) {
      seenWrittenFor.current = focusKey;
      // The record this open read is passed on, so the goals already reached (LR-3b) are kept; a goal reached
      // for the first time joins them now, so the next visit no longer cheers (LR-5c).
      const record = seenFrom(model, new Date(), seenRead);
      written = writeSeen(STORAGE, profileId, goal !== null ? withGoalReached(record, goal) : record, { readOnly });
    } else if (goal !== null) {
      // Reached after this focus's write: the stored record (after any write still running) gains the key.
      const fallback = seenFrom(model, new Date(), seenRead);
      written = pendingWrite.current
        .then(() => readSeen(STORAGE, profileId))
        .then((stored) => writeSeen(STORAGE, profileId, withGoalReached(stored ?? fallback, goal), { readOnly }));
    }
    if (written !== null) {
      pendingWrite.current = written;
      // route_map.goal_reached once the key is stored, so a failed write never sends it twice (section 12).
      const reached = goalReachedEvent({ profileId, goal, firstReached, readOnly });
      if (reached) {
        void written.then((ok) => {
          if (ok) void track(reached);
        });
      }
    }
  }, [model, focusKey, seenFor, profileId, readOnly, seenRead, firstReached]);

  // One row open at a time; the `here` stage is open on first view.
  const [openKey, setOpenKey] = useState<string | null | undefined>(undefined);
  const look = stageRowLook(windowWidth);

  const openLibrary = (): void => navigation.navigate('Main', { screen: 'Library' });
  const back = (
    <Pressable
      onPress={() => navigation.goBack()}
      hitSlop={spacing.md}
      accessibilityRole="button"
      accessibilityLabel={messages.a11y.goBack}
      style={{ alignSelf: 'flex-start', padding: spacing.xs }}
    >
      <Icon name="arrow-left" size={28} />
    </Pressable>
  );
  // The tab is a root: no back button, and the purpose line under the title (LR-OD-3). The grown-up screen keeps Back.
  const header = (
    <>
      {variant === 'stack' ? back : null}
      {variant === 'stack' ? <Spacer size="sm" /> : null}
      <Heading level="title">{m.title}</Heading>
      {variant === 'tab' ? (
        <>
          <Spacer size="xs" />
          <Body tone="secondary">{m.purpose}</Body>
        </>
      ) : null}
    </>
  );

  if (model === null || view === null) {
    // State J (LR-D `route-card.md`): Hoya, one calm line and Try again.
    const line = readOnly ? messages.caregiver.journey.error(profile?.displayName ?? '') : m.hero.error;
    return (
      <Screen tone="canvas">
        {header}
        <Spacer size="lg" />
        <Card padding="lg" elevation="card" testID="my-route-error">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Hoya pose="thinking" size={hoyaSize} />
            </View>
            <Heading level="prompt" style={{ flex: 1 }}>
              {line}
            </Heading>
          </View>
          <Spacer size="lg" />
          <Button label={messages.common.buttons.tryAgain} tone="primary" size="lg" fullWidth onPress={() => setAttempt((n) => n + 1)} />
        </Card>
      </Screen>
    );
  }

  const current = openKey === undefined ? view.initialOpen : openKey;
  const toggle = (key: string, stage: MyRouteModel['stages'][number]['stage']): void => {
    if (current === key) {
      setOpenKey(null);
      return;
    }
    setOpenKey(key);
    const event = stageOpenedEvent({ profileId, stage, readOnly });
    if (event) void track(event);
  };

  // The card's one button: Continue (or Start) opens F-ENT-003's one next, the quest Home card (2) names.
  const onHero = (): void => {
    const cta = view.heroCopy.cta;
    if (cta === null) return;
    if (cta.action === 'quest' && model.next) {
      const event = continueTappedEvent({ profileId, model, readOnly });
      if (event) void track(event);
      if (!readOnly) void track(nextStartedEvent(profileId, model.next.source, 'route'));
      navigation.navigate('QuestPlayer', { questId: model.next.questId, episodeId: model.next.episodeId });
    } else if (cta.action === 'practice' && practiceTopic !== null) {
      // The free-end hero (LR-5b): practice words that stay open; the route page never asks (section 4.5).
      navigation.navigate('VocabTopic', { topicKey: practiceTopic });
    } else openLibrary();
  };

  return (
    <Screen tone="canvas" testID="my-route-screen">
      {header}
      {view.viewing !== null ? (
        <>
          <Spacer size="xs" />
          <Body tone="secondary">{view.viewing}</Body>
        </>
      ) : null}
      <Spacer size="md" />

      <RouteCard
        copy={view.routeCard}
        pips={model.goalPips}
        goalStage={model.goal?.stage ?? null}
        cta={view.heroCopy.cta}
        pose={view.pose}
        onAction={onHero}
        focusToken={focusKey}
      />

      {view.planLine !== null ? (
        <>
          <Spacer size="sm" />
          <Body tone="secondary" testID="my-route-plan-line">
            {view.planLine}
          </Body>
          {view.planOpen !== null && !readOnly ? (
            // Open plan (R-7d; wireframe design/wireframes/journey/learning-route.md A): the learner's own weekly plan.
            <View style={{ alignSelf: 'flex-end' }}>
              <LinkButton label={view.planOpen} onPress={() => navigation.navigate('RouteOverview', { profileId })} testID="my-route-plan-open" />
            </View>
          ) : null}
        </>
      ) : null}

      {view.newQuests !== null ? (
        <>
          <Spacer size="md" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} accessibilityLiveRegion="polite">
            <Icon name="sparkle" size={24} color={colors.brand.primary} />
            <Body weight="semibold" style={{ flex: 1 }}>
              {view.newQuests}
            </Body>
          </View>
        </>
      ) : null}

      <Spacer size="xl" />
      <View accessibilityRole="list" accessibilityLabel={messages.a11y.myRoute.trail} testID="my-route-trail">
        {view.trail.map((row) =>
          row.kind === 'stage' ? (
            <StageRowItem
              key={row.key}
              row={row}
              open={current === row.key}
              look={look}
              reducedMotion={reducedMotion}
              onToggle={() => toggle(row.key, row.stage)}
              onOpenEpisode={(episodeId) => navigation.navigate('EpisodeDetail', { episodeId, from: 'route' })}
            />
          ) : (
            <LaterRowItem key={row.key} row={row} open={current === row.key} onToggle={() => toggle(row.key, row.stage)} />
          ),
        )}
      </View>

      <Spacer size="md" />
      <SkillsCard title={view.skillsTitle} rows={view.skills} tiles={view.tiles} note={view.skillsNote} />

      {view.gains.length > 0 ? (
        <>
          <Spacer size="lg" />
          <GainsCard tiles={view.gains} onOpenLibrary={openLibrary} />
        </>
      ) : null}

      {view.storiesNote !== null ? (
        <>
          <Spacer size="md" />
          <StoriesNote text={view.storiesNote} cta={m.cta.stories} onOpen={openLibrary} />
        </>
      ) : null}
      <Spacer size="xl" />
    </Screen>
  );
}
