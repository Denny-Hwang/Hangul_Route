import { Body, Button, Card, Heading, Icon, Screen, Spacer, colors, spacing, useLayoutClass } from '@hangul-route/design-system';
import type { ThemeKey } from '@hangul-route/content-schema';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { flags } from '../../config/flags';
import { questsAll } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeQuest } from '../../logic/content-locale';
import { myRouteAccess, myRouteEntryOf, selfEntryTab } from '../../logic/my-route/access';
import { focusEffects, seenForView, seenReadAfter } from '../../logic/my-route/focus';
import { buildMyRoute } from '../../logic/my-route/model';
import { localizedRouteContent, routeModelInput } from '../../logic/my-route/route-input';
import { readSeen, seenFrom, writeSeen } from '../../logic/my-route/seen';
import { continueTappedEvent, stageOpenedEvent, viewedEvent } from '../../logic/my-route/telemetry';
import type { MyRouteModel, SeenRecord } from '../../logic/my-route/types';
import { emptySnapshot, myRouteView, stageRowLook } from '../../logic/my-route/view';
import { isParentSessionValid } from '../../logic/profiles/session';
import { defaultStoryIndex } from '../../logic/story/story-index';
import type { RootStackParamList } from '../../navigation/types';
import { useReducedMotion } from '../../platform/motion';
import { readJson, writeJson } from '../../platform/storage';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useAccessTier } from '../../store/tier-store';
import { useUiStore } from '../../store/ui-store';
import { GainsCard, StoriesNote } from './GainsCard';
import { HeroCard } from './HeroCard';
import { SkillsCard } from './SkillsCard';
import { LaterRowItem, StageRowItem } from './TrailRow';

/**
 * My route (F-ROUTE-001 R-3): where the learner is in the whole journey, at a
 * glance. One reading column on phone, tablet and desktop (sections 3.11,
 * F-LAYOUT-001 `Screen width="reading"`): the hero, the new-quests line, the
 * trail of seven stages, what the quests practice (reading, listening and
 * writing only), gains and the stories note. Wireframe:
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

  const built = useMemo((): { model: MyRouteModel } | { error: true } => {
    try {
      const snapshot = snap ?? emptySnapshot(profileId);
      const model = buildMyRoute(routeModelInput({ snapshot, tier, localized, seen, now: new Date() }));
      return { model };
    } catch {
      return { error: true };
    }
    // `attempt` is the retry.
  }, [snap, profileId, tier, localized, seen, attempt]);
  const model = 'model' in built ? built.model : null;

  const view = useMemo(() => {
    if (model === null) return null;
    const themeTitles = Object.fromEntries(localized.themes.map((t) => [t.key, t.titleEn])) as Record<ThemeKey, string>;
    const quest = model.cursor ? questsAll.find((q) => q.id === model.cursor?.questId) : undefined;
    return myRouteView({
      model,
      messages,
      viewer: readOnly ? 'grownup' : 'self',
      name: profile?.displayName ?? '',
      themeTitles,
      nextTitle: quest ? localizeQuest(quest, locale).titleEn : null,
      hasStories: defaultStoryIndex().some((e) => e.placement === 'shelf'),
      seen,
    });
  }, [model, messages, readOnly, profile?.displayName, localized, locale, seen]);

  // Once per focus: route_map.viewed from the tab, then remember what this open saw (active learner only, never
  // read-only: the grown-up screen sends and writes nothing, section 8).
  const viewedFor = useRef(0);
  const seenWrittenFor = useRef(0);
  useEffect(() => {
    if (model === null) return;
    const fx = focusEffects({ focusKey, viewedFor: viewedFor.current, seenFor, seenWrittenFor: seenWrittenFor.current, readOnly, modelReady: true });
    if (fx.sendViewed) {
      viewedFor.current = focusKey;
      const event = viewedEvent({ profileId, model, source: 'tab', hasPlan: false, readOnly });
      if (event) void track(event);
    }
    if (fx.writeSeen) {
      seenWrittenFor.current = focusKey;
      pendingWrite.current = writeSeen(STORAGE, profileId, seenFrom(model, new Date()), { readOnly });
    }
  }, [model, focusKey, seenFor, profileId, readOnly]);

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
    return (
      <Screen tone="canvas">
        {header}
        <Spacer size="lg" />
        <Card padding="lg">
          <Body>{messages.common.errors.generic}</Body>
          <Spacer size="md" />
          <Button label={messages.common.buttons.tryAgain} tone="secondary" size="md" onPress={() => setAttempt((n) => n + 1)} />
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

  const onHero = (): void => {
    const cta = view.heroCopy.cta;
    if (cta === null) return;
    if (cta.action === 'quest' && model.cursor) {
      const event = continueTappedEvent({ profileId, model, readOnly });
      if (event) void track(event);
      navigation.navigate('QuestPlayer', { questId: model.cursor.questId, episodeId: model.cursor.episodeId });
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

      <HeroCard copy={view.heroCopy} pose={view.pose} onAction={onHero} focusToken={focusKey} />

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
              onOpenEpisode={(episodeId) => navigation.navigate('EpisodeDetail', { episodeId })}
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
