import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Pill,
  Screen,
  Spacer,
  borderWidth,
  colors,
  spacing,
} from '@hangul-route/design-system';
import { type StageKey } from '@hangul-route/content-schema';
import { formatDate, levelWords, type Messages } from '@hangul-route/i18n';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef } from 'react';
import { Platform, View, type TextStyle } from 'react-native';
import { ProfileAvatar } from '../../components/ProfileAvatar';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeQuest } from '../../logic/content-locale';
import { questsAll, stages } from '../../content';
import { bundleOs, flags, reportsEnabledFor } from '../../config/flags';
import { grownUpEntriesOn, runGrownUpHandoff } from '../../logic/shell/entry-points';
import { grownUpPinParams } from '../../logic/shell/handoff-rules';
import { openGrownUpArea } from '../../platform/grown-up-handoff';
import { FreeLessonsRow } from './FreeLessonsRow';
import { GateLessonsButton } from './GateLessonsButton';
import { GrownUpHomeCard } from './GrownUpHomeCard';
import { LectureCard } from './LectureCard';
import { ResetByWaitNotice } from './ResetByWaitNotice';
import { localizeStage } from '../../logic/content-locale';
import { bandLabel } from '../../logic/placement/copy';
import { startingSpotRow } from '../../logic/placement/report-page';
import { practiceTotals } from '../../logic/sessions/session-log';
import { changePinMode } from '../../logic/profiles/pin-reset';
import { isParentSessionValid } from '../../logic/profiles/session';
import { reportEntry } from '../../logic/reports/entry';
import { useAudience } from '../../store/audience';
import { useUiStore } from '../../store/ui-store';
import { LinkButton } from '../../components/LinkButton';
import { LearningRouteRow } from './LearningRouteRow';
import { VocabDashboardRow } from './VocabDashboardRow';
import { wordsOffered } from '../vocab/topic-data';
import { NotesDashboardRow } from '../notes/NotesDashboardRow';
import type { RootStackParamList } from '../../navigation/types';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { syncApi } from '../../store/sync-store';
import { gateOpensDirectlyNow } from '../../store/gate-now';
import { passGate } from '../../store/gate-telemetry';

/** Learner's cub beside the name (F-LEARN-001 §3.6). */
const AVATAR_SIZE = 40;

type Props = NativeStackScreenProps<RootStackParamList, 'ParentDashboard'>;

export function ParentDashboardScreen({ navigation, route }: Props): React.ReactElement {
  const messages = useMessages();
  const m = messages.caregiver.dashboard;
  const locale = useLocale();
  const profiles = useProfileStore((s) => s.profiles);
  const byProfile = useProgressStore((s) => s.byProfile);
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const { opensDirectly, audience, copy } = useAudience();

  // See report (F-REPORT-001 section 3.9, RP-9): straight to the report while the grown-up gate opens directly,
  // else through the PIN screen when the 15-minute session has lapsed.
  const openReport = (profileId: string): void => {
    const sessionOpen = isParentSessionValid(parentGateOpenedAt === null ? null : { openedAt: parentGateOpenedAt, profileId: 'family' }, Date.now());
    const entry = reportEntry(profileId, passGate('LearnerReport', opensDirectly(sessionOpen)));
    if (entry.screen === 'LearnerReport') navigation.navigate('LearnerReport', entry.params);
    else navigation.navigate('PinEntry', entry.params);
  };

  // [OA] OA-2 review round 2 (CS-1, CS-15): the dashboard checks the gate itself whenever it comes into focus (Back or
  // Cancel from a page above it, a level check started from here and left): with the session closed or lapsed it
  // hands over to the PIN screen instead of staying usable. Every way in opens the gate first, so a first focus passes.
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        if (!gateOpensDirectlyNow()) navigation.replace('PinEntry', { next: 'ParentDashboard' });
      }),
    [navigation],
  );

  // Every profile's snapshot, not only the active one: the cards and the Starting spot row read them.
  useEffect(() => {
    for (const p of profiles) void useProgressStore.getState().hydrate(p.id);
  }, [profiles]);

  // F-APP-001 A-7 (section 3.6, web, flag on): the grown-up area on the app host. A PIN entered in
  // the last 2 minutes to reach this dashboard counts; a gate the 15-minute session opened does not,
  // so the PIN screen asks first (`openGrownUpArea`).
  const grownUpHome = grownUpEntriesOn(flags.grownUpHomeEnabled, bundleOs());
  const leaving = useRef(false);
  const openGrownUpHome = (): void => {
    void runGrownUpHandoff('dashboard', leaving, openGrownUpArea, (v) => navigation.navigate('PinEntry', grownUpPinParams({ via: v })));
  };

  const stageTitle = (key: StageKey): string => {
    const stage = stages.find((s) => s.key === key);
    return stage === undefined ? '' : localizeStage(stage, locale).titleEn;
  };

  return (
    <Screen tone="canvas" scrollable>
      <View>
        {/* One name for the Profile row, the PIN title and this page (owner request 2026-10-16, item 8), the persona under it. */}
        {/* Wraps inside a long word too: at 320 px with 200 % text "Dashboard" alone is wider than the line (AMENDMENTS-LECTURE-V2 LV-6). */}
        <Heading level="title" style={{ overflowWrap: 'anywhere' } as TextStyle}>
          {copy.zoneLabel}
        </Heading>
        {audience === 'family' ? (
          <Body tone="secondary" weight="semibold" testID="dashboard-persona">
            {m.persona}
          </Body>
        ) : null}
        <Caption tone="muted">{m.readOnly}</Caption>
      </View>

      {flags.whoChooserEnabled ? (
        <>
          {/* [OA] Switch user (AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4a): hands the device back through "Who is using this?", which ends the session. */}
          <Spacer size="sm" />
          <Button
            label={messages.learner.who.switchUser}
            tone="ghost"
            size="md"
            fullWidth
            onPress={() => navigation.navigate('WhoIsUsing', { trigger: 'manual' })}
            testID="dashboard-switch-user"
          />
        </>
      ) : null}
      <Spacer size="lg" />
      <ResetByWaitNotice
        onChange={() =>
          navigation.navigate('PinEntry', {
            next: 'ParentDashboard',
            mode: changePinMode(useUiStore.getState().lastPinVerifiedAt, Date.now()),
            returnAfterSet: true,
          })
        }
      />
      {grownUpHome ? (
        <>
          <GrownUpHomeCard onOpen={openGrownUpHome} />
          <Spacer size="lg" />
        </>
      ) : null}
      {/* AMENDMENTS-LECTURE-V2 E5 (LV-6): web only and behind flags.lectureModeEnabled; it draws nothing otherwise. */}
      <LectureCard learners={profiles.map((p) => ({ id: p.id, name: p.displayName }))} onGate={() => navigation.navigate('PinEntry', { next: 'LectureMode' })} />
      {profiles.length === 0 ? (
        <Body>{m.noProfiles}</Body>
      ) : (
        profiles.map((p) => {
          const snap = byProfile[p.id];
          const level = levelWords(messages, p.ageGroup)?.label ?? null;
          const completed = snap?.quests.filter((q) => q.completedAt).length ?? 0;
          const cards = snap?.cards.length ?? 0;
          // Quest sessions only, and capped minutes (F-REPORT-001 section 3.3.2): a story, game or
          // level-check visit adds minutes, never a session.
          const { sessions, minutes: sessionMinutes } = practiceTotals(snap?.sessions ?? []);
          return (
            <Card key={p.id} padding="md" style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <ProfileAvatar avatar={p.avatar} size={AVATAR_SIZE} />
                  <Body weight="bold" size="lg">
                    {p.displayName}
                  </Body>
                </View>
                {level ? <Pill tone="neutral" label={level} size="sm" /> : null}
              </View>
              <Spacer size="sm" />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Stat label={m.stats.quests} value={String(completed)} />
                <Stat label={m.stats.cards} value={String(cards)} />
                <Stat label={m.stats.sessions} value={String(sessions)} />
                <Stat label={m.stats.minutes} value={String(sessionMinutes)} />
              </View>
              {flags.placementEnabled ? (
                <StartingSpot
                  spot={startingSpotRow(snap?.placements)}
                  m={messages.caregiver.placementReport}
                  levelLine={(spot) =>
                    [stageTitle(spot.level.stage), bandLabel(messages, spot.level), formatDate(locale, spot.takenAt, 'monthDay')].join(' · ')
                  }
                  onOpen={() => navigation.navigate('PlacementReport', { profileId: p.id })}
                  testID={`dashboard-starting-spot-${p.id}`}
                />
              ) : null}
              {flags.myRouteEnabled ? (
                <LearningRouteRow
                  profileId={p.id}
                  name={p.displayName}
                  stored={snap}
                  showStarted={!flags.placementEnabled}
                  testID={`dashboard-route-${p.id}`}
                />
              ) : null}
              {/* F-VOC-005 section 3.8: the Words row while Words is offered (the flag; the e2e fixture bundle); nothing for a learner with no word. */}
              {wordsOffered() ? <VocabDashboardRow snapshot={snap} testID={`dashboard-words-${p.id}`} /> : null}
              {/* F-ENT-003 E3-12b: the free-lessons line, owner only (with the card's other rows; draws nothing otherwise). */}
              <FreeLessonsRow profileId={p.id} name={p.displayName} testID={`dashboard-free-line-${p.id}`} />
              {snap && snap.quests.length > 0 ? (
                <>
                  <Spacer size="md" />
                  <Caption tone="muted">{m.recent}</Caption>
                  {snap.quests.slice(-3).reverse().map((q) => {
                    const found = questsAll.find((x) => x.id === q.questId);
                    const quest = found && localizeQuest(found, locale);
                    return (
                      <View
                        key={q.questId + (q.completedAt ?? '')}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingVertical: spacing.xs,
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border.subtle,
                        }}
                      >
                        <Body size="sm">{quest?.titleEn ?? q.questId}</Body>
                        <Caption tone="muted">{q.stars}★</Caption>
                      </View>
                    );
                  })}
                </>
              ) : null}
              {reportsEnabledFor(locale) ? (
                <>
                  <Spacer size="md" />
                  <Button label={messages.report.action.seeReport} tone="primary" size="md" fullWidth onPress={() => openReport(p.id)} testID={`dashboard-see-report-${p.id}`} />
                </>
              ) : null}
            </Card>
          );
        })
      )}

      {/* F-FEEDBACK-001 FB-9 (section 6.10 item 1): one "Notes for <learner>" row per profile with notes or memberships. */}
      {flags.notesEnabled ? (
        <View testID="dashboard-notes-rows">
          {profiles.map((p) => (
            <NotesDashboardRow key={p.id} profileId={p.id} name={p.displayName} onOpen={() => navigation.navigate('NotesGrownUp', { profileId: p.id })} />
          ))}
        </View>
      ) : null}

      {/* F-BROWSE-001 BR-12a (section 4.11 item 6, wireframe browse/entry-points.md panel 6): web only, after the profile cards. */}
      {Platform.OS === 'web' ? (
        <>
          <Spacer size="md" />
          <GateLessonsButton kind="open" testID="dashboard-open-all-lessons" initialBlocked={route.params?.browseBlocked === true} />
        </>
      ) : null}

      <Spacer size="lg" />
      <Card padding="md" tone="sunken">
        <Heading level="prompt">{m.privacy.title}</Heading>
        <Spacer size="xs" />
        <Body size="sm" tone="secondary">
          {/* The backup sentence only on a build that backs up; a build with cloud saving off says so. */}
          {syncApi() !== null ? m.privacy.body : m.privacy.bodyDeviceOnly}
        </Body>
      </Card>
      <Spacer size="xl" />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <View style={{ alignItems: 'center' }}>
      <Body weight="bold" size="lg">
        {value}
      </Body>
      <Caption tone="muted">{label}</Caption>
    </View>
  );
}

type SpotRow = NonNullable<ReturnType<typeof startingSpotRow>>;

/**
 * The Starting spot row (F-PLC-001 section 3.9, wireframe placement/report):
 * the stage title, the band label and the date of the newest check, "Changed
 * by a grown-up" when a parent override is in force, and See the check. With
 * no check yet it says so and still opens the report (its take-it button).
 */
function StartingSpot({
  spot,
  m,
  levelLine,
  onOpen,
  testID,
}: {
  spot: SpotRow | null;
  m: Messages['caregiver']['placementReport'];
  levelLine: (spot: SpotRow) => string;
  onOpen: () => void;
  testID: string;
}): React.ReactElement {
  return (
    <View testID={testID} style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: borderWidth.thin, borderTopColor: colors.border.subtle }}>
      <Caption tone="muted">{m.row.label}</Caption>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }}>
        <View style={{ flexShrink: 1 }}>
          <Body weight="semibold">{spot === null ? m.noCheck : levelLine(spot)}</Body>
          {spot?.overridden ? <Caption tone="muted">{m.changedByGrownUp}</Caption> : null}
        </View>
        <LinkButton label={m.row.seeCheck} onPress={onOpen} testID={`${testID}-open`} />
      </View>
    </View>
  );
}
