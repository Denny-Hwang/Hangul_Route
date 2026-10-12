import { Body, Button, Card, Heading, Icon, Screen, Spacer, colors, spacing, useLayoutClass } from '@hangul-route/design-system';
import type { ThemeKey } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { questsAll } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeQuest } from '../../logic/content-locale';
import { myRouteAccess } from '../../logic/my-route/access';
import { buildMyRoute } from '../../logic/my-route/model';
import { localizedRouteContent, routeModelInput } from '../../logic/my-route/route-input';
import { readSeen, seenFrom, writeSeen } from '../../logic/my-route/seen';
import { continueTappedEvent, stageOpenedEvent, viewedEvent, type MyRouteSource } from '../../logic/my-route/telemetry';
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
import { effectiveTier, useTierStore } from '../../store/tier-store';
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
 */

type Props = NativeStackScreenProps<RootStackParamList, 'MyRoute'>;

const STORAGE = { readJson, writeJson };

export function MyRouteScreen({ route, navigation }: Props): React.ReactElement {
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const { opensDirectly } = useAudience();
  const sessionOpen = isParentSessionValid(parentGateOpenedAt === null ? null : { openedAt: parentGateOpenedAt, profileId: 'family' }, Date.now());
  const access = myRouteAccess({
    requestedId: route.params?.profileId,
    activeId,
    profiles,
    gateOpen: opensDirectly(sessionOpen),
    grownup: route.params?.viewer === 'grownup',
  });
  const gateFor = access.kind === 'gate' ? access.profileId : null;

  useEffect(() => {
    // Another profile with the gate closed: the PIN screen replaces this one (section 3.1).
    if (gateFor !== null) navigation.replace('PinEntry', { next: 'MyRoute', profileId: gateFor });
    else if (access.kind === 'none' && navigation.canGoBack()) navigation.goBack();
  }, [gateFor, access.kind, navigation]);

  if (access.kind === 'gate' || access.kind === 'none') return <Screen tone="canvas">{null}</Screen>;
  return (
    <MyRouteBody
      key={access.profileId}
      profileId={access.profileId}
      readOnly={access.kind === 'readOnly'}
      source={route.params?.source ?? 'journey'}
      navigation={navigation}
    />
  );
}

interface BodyProps {
  profileId: string;
  readOnly: boolean;
  source: MyRouteSource;
  navigation: Props['navigation'];
}

function MyRouteBody({ profileId, readOnly, source, navigation }: BodyProps): React.ReactElement {
  const messages = useMessages();
  const m = messages.learner.myRoute;
  const locale = useLocale();
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId));
  const snap = useProgressStore((s) => s.byProfile[profileId]);
  // Re-renders when the inbox changes the tier, as Home and Results do.
  const cachedTier = useTierStore((s) => s.byLearner[profileId]);
  const tier = effectiveTier(profileId, new Date()).tier;
  const { windowWidth } = useLayoutClass();
  const reducedMotion = useReducedMotion();

  // The record this open starts from (section 3.10); read for the active learner only.
  const [seen, setSeen] = useState<SeenRecord | undefined>(undefined);
  const [seenLoaded, setSeenLoaded] = useState(readOnly);
  useEffect(() => {
    if (readOnly) return;
    let live = true;
    void readSeen(STORAGE, profileId).then((record) => {
      if (!live) return;
      setSeen(record);
      setSeenLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [profileId, readOnly]);

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
    // `cachedTier` re-renders this screen when the inbox changes the tier; `attempt` is the retry.
  }, [snap, profileId, tier, cachedTier, localized, seen, attempt]);
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

  // Once per open: route_map.viewed, then remember what this open saw (active learner only, never read-only).
  const viewedSent = useRef(false);
  const seenWritten = useRef(false);
  useEffect(() => {
    if (model === null) return;
    if (!viewedSent.current) {
      viewedSent.current = true;
      const event = viewedEvent({ profileId, model, source, hasPlan: false, readOnly });
      if (event) void track(event);
    }
    if (seenLoaded && !seenWritten.current && !readOnly) {
      seenWritten.current = true;
      void writeSeen(STORAGE, profileId, seenFrom(model, new Date()), { readOnly });
    }
  }, [model, seenLoaded, profileId, source, readOnly]);

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

  if (model === null || view === null) {
    return (
      <Screen tone="canvas">
        {back}
        <Spacer size="sm" />
        <Heading level="title">{m.title}</Heading>
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
      {back}
      <Spacer size="sm" />
      <Heading level="title">{m.title}</Heading>
      {view.viewing !== null ? (
        <>
          <Spacer size="xs" />
          <Body tone="secondary">{view.viewing}</Body>
        </>
      ) : null}
      <Spacer size="md" />

      <HeroCard copy={view.heroCopy} pose={view.pose} onAction={onHero} />

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
