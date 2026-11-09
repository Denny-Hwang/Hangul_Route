import { Body, Button, Caption, Icon, PipRow, Screen, Spacer, colors, spacing, touchTarget } from '@hangul-route/design-system';
import { CATALOG, type ReportPeriod, type StageKey } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Platform, View } from 'react-native';
import { flags, reportsEnabledFor } from '../../config/flags';
import { jamoAll, questsAll, stages } from '../../content';
import { useLessonTitlesVersion, useLocale, useMessages } from '../../i18n/use-messages';
import { localizeJamo, localizeQuest, localizeStage } from '../../logic/content-locale';
import { buildMyRoute } from '../../logic/my-route/model';
import { useLessonContentVersion } from '../lesson-content';
import { localizedRouteContent, routeModelInput } from '../../logic/my-route/route-input';
import { emptySnapshot, type SkillRowView } from '../../logic/my-route/view';
import { isParentSessionValid, parentSessionRemainingMs } from '../../logic/profiles/session';
import { reportEntry } from '../../logic/reports/entry';
import { reportViewedEvent } from '../../logic/reports/events';
import { inAppReportView, type InAppReportView } from '../../logic/reports/report-view';
import { reportSkillsView, type ReportSkillsView } from '../../logic/reports/skills-view';
import { reportVoice } from '../../logic/reports/voice';
import { refreshMemorySummary } from '../../logic/sync/memory-hook';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { summarizeFor } from '../../store/sync-store';
import { useAccessTier } from '../../store/tier-store';
import { useUiStore } from '../../store/ui-store';
import { SKILL_ACCENT } from '../my-route/SkillsCard';
import { GateLessonsButton } from './GateLessonsButton';
import { ReportHeading, ReportSkeleton, ReportView } from './report-blocks';

/**
 * LearnerReport — one learner's progress report in the learner app, behind the grown-up gate (F-REPORT-001 section
 * 3.9, RP-9). Screen spec `design/screens/reports/in-app-report.md` (mock `mock/in-app-report.html`), wireframe
 * `design/wireframes/reports/in-app-report.md`.
 *
 * Three layers in one column: (1) the header, the glance with **Open Learning Route**, the period tabs
 * (`SectionTabs`' own model: every tab a Tab stop, Enter or Space selects) and the stepper, the headline, What went
 * well and What to practice next; (2) This period (figures, the calendar or the growth line); (3) More detail,
 * collapsed, ending with the device-only skills rows. Built from this device's own summary (`summarizeFor`, the one
 * the device uploads), so it works fully offline.
 *
 * The blocks themselves are `./report-blocks.tsx` (`ReportView`), shared with the native account report (F-AUTH-004
 * section 8.7, row NS-5); this screen adds what only the device has: its own summary, Open Learning Route, Preview
 * lessons on the web and the skills rows.
 *
 * Read-only: it never writes progress, never changes the active profile and sends only `report.viewed` without a
 * profile id. The voice comes from `reportVoice` (never from `gateOpensDirectly`, which decides only the entry). No
 * Print, no Send a note, no Browse link on a letter (OD-7, section 3.9).
 */

type Props = NativeStackScreenProps<RootStackParamList, 'LearnerReport'>;

export function LearnerReportScreen({ route, navigation }: Props): ReactElement {
  const messages = useMessages();
  const locale = useLocale();
  const profileId = route.params.profileId;
  const profiles = useProfileStore((s) => s.profiles);
  const activeId = useProfileStore((s) => s.activeId);
  const profile = profiles.find((p) => p.id === profileId);
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const { opensDirectly } = useAudience();
  const session = parentGateOpenedAt === null ? null : { openedAt: parentGateOpenedAt, profileId: 'family' };
  const sessionOpen = isParentSessionValid(session, Date.now());
  const gateOpen = opensDirectly(sessionOpen);
  const allowed = reportsEnabledFor(locale);
  // A render when the grown-up session lapses, so a report left open hands over to the PIN screen (below).
  const [, setLapsed] = useState(0);
  useEffect(() => {
    const left = parentSessionRemainingMs(parentGateOpenedAt === null ? null : { openedAt: parentGateOpenedAt, profileId: 'family' }, Date.now());
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setLapsed((n) => n + 1), left);
    return () => clearTimeout(timer);
  }, [parentGateOpenedAt]);

  // An unknown profile (deleted meanwhile, or a stale navigation state) or a UI locale whose report words are not
  // reviewed yet leaves for the previous screen, or the dashboard when there is none. Otherwise a closed gate (the
  // session lapsed) hands over to the PIN screen, which comes back here.
  useEffect(() => {
    if (!allowed || profile === undefined) {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.replace('ParentDashboard');
      return;
    }
    const entry = reportEntry(profileId, gateOpen);
    if (entry.screen === 'PinEntry') navigation.replace('PinEntry', entry.params);
  }, [allowed, gateOpen, profile, profileId, navigation]);

  if (!allowed || !gateOpen || profile === undefined) return <Screen tone="canvas">{null}</Screen>;
  return <ReportBody key={profileId} profileId={profileId} name={profile.displayName} voice={reportVoice({ profiles, activeProfileId: activeId, profileId })} navigation={navigation} locale={locale} messages={messages} />;
}

type BodyProps = {
  profileId: string;
  name: string;
  voice: ReturnType<typeof reportVoice>;
  navigation: Props['navigation'];
  locale: ReturnType<typeof useLocale>;
  messages: ReturnType<typeof useMessages>;
};

function ReportBody({ profileId, name, voice, navigation, locale, messages }: BodyProps): ReactElement {
  // A title chunk that arrives late fills its titles in place, so the localized memos key on it too (F-CURR-002 §10).
  const titles = useLessonTitlesVersion();
  const stored = useProgressStore((s) => s.byProfile[profileId]);
  const hydrated = useProgressStore((s) => s.hydratedFor.has(profileId));
  const tier = useAccessTier(profileId);
  const localized = useMemo(() => localizedRouteContent(locale), [locale, titles]);
  const [period, setPeriod] = useState<ReportPeriod>('week');
  const [at, setAt] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The live region speaks only after the grown-up changed the period or stepped, never on open.
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    void useProgressStore.getState().hydrate(profileId);
  }, [profileId]);
  // F-CURR-002 CM-16: the memory counts as the store has them now (none while the profile does not record); read-only.
  const [memoryRead, setMemoryRead] = useState(0);
  useEffect(() => {
    let live = true;
    void refreshMemorySummary(profileId).then(() => {
      if (live) setMemoryRead((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [profileId]);
  // The skills rows count every quest's games, so every lesson chunk loads and the rows follow (F-CURR-002 §10).
  // A grown-up report counts every volume while online, so it reads the same on any device (row CM-5B).
  const lessonsLoaded = useLessonContentVersion(true);

  const built = useMemo((): { view: InAppReportView; skills: ReportSkillsView | null } | null => {
    if (!hydrated) return null;
    void attempt;
    void memoryRead;
    try {
      const snapshot = stored ?? emptySnapshot(profileId);
      const now = new Date();
      const view = inAppReportView({
        summary: summarizeFor(snapshot),
        name,
        voice,
        period,
        at,
        now,
        catalog: CATALOG,
        locale,
        messages,
        stageTitle: (key: StageKey) => {
          const stage = stages.find((s) => s.key === key);
          return stage === undefined ? '' : localizeStage(stage, locale).titleEn;
        },
        questTitle: (id) => {
          const quest = questsAll.find((q) => q.id === id);
          return quest === undefined ? null : localizeQuest(quest, locale).titleEn;
        },
        letterInfo: (letter) => {
          // The letter at the start of a block (a final consonant shares its glyph): its sound value and sound hint.
          const jamo = jamoAll.find((j) => j.char === letter && j.kind !== 'batchim');
          if (jamo === undefined) return null;
          const local = localizeJamo(jamo, locale);
          return { romanization: local.romanization, gloss: local.soundHint ?? null };
        },
        // L1 (the grown-up read-only Learning Route) is on this build with the Learning Route itself.
        learningRoute: flags.myRouteEnabled,
        platform: Platform.OS,
      });
      let skills: ReportSkillsView | null = null;
      try {
        skills = reportSkillsView({ model: buildMyRoute(routeModelInput({ snapshot, tier, localized, now })), voice, name, messages });
      } catch {
        // The skills rows are one block of More detail: the rest of the report stands without them.
      }
      return { view, skills };
    } catch {
      return null;
    }
  }, [hydrated, stored, profileId, name, voice, period, at, locale, messages, tier, localized, attempt, lessonsLoaded, memoryRead]);

  // One `report.viewed` on open and on each period change or step (section 3.13), without a profile id. Keyed on
  // what the grown-up chose, not on `built`, which also changes when the progress store does. Every drawn report
  // counts, whatever its state (the console's route records every view too).
  const shown = built !== null;
  useEffect(() => {
    if (shown) void track(reportViewedEvent(period));
  }, [period, at, shown]);

  // The announcement after a period change or a step (section 3.12; `ReportView` speaks it).
  const announce = changed ? (built?.view.announce ?? null) : null;

  if (!hydrated) {
    return (
      <Screen tone="canvas" scrollable>
        <ReportSkeleton label={messages.a11y.report.loading} />
      </Screen>
    );
  }

  if (built === null) {
    return (
      <Screen tone="canvas" scrollable>
        <Spacer size="md" />
        <Body testID="learner-report-error">{messages.report.state.error}</Body>
        <Spacer size="md" />
        <Button label={messages.common.buttons.tryAgain} tone="primary" size="md" onPress={() => setAttempt((n) => n + 1)} testID="learner-report-retry" />
      </Screen>
    );
  }

  const { view, skills } = built;
  const choosePeriod = (next: ReportPeriod): void => {
    setPeriod(next);
    setAt(null);
    setChanged(true);
  };
  const step = (target: string | null): void => {
    setAt(target);
    setChanged(true);
  };

  return (
    <Screen tone="canvas" scrollable>
      <ReportView
        view={view}
        period={period}
        announce={announce}
        onChoosePeriod={choosePeriod}
        onStep={step}
        // The grown-up's read-only view of this report's profile (L1), never the learner's own page.
        onOpenRoute={() => navigation.navigate('MyRoute', { profileId, viewer: 'grownup' })}
        practiceNextFooter={
          // F-BROWSE-001 BR-12a: one Preview lessons row at the end of this section, web only (design: in-app-report.md).
          Platform.OS === 'web' ? (
            <>
              <Spacer size="sm" />
              <GateLessonsButton kind="preview" target={{ kind: 'stage', stage: view.previewStage }} testID="learner-report-preview-lessons" />
            </>
          ) : null
        }
        detailFooter={skills !== null ? <SkillsBlock skills={skills} /> : null}
      />
      <Spacer size="xl" />
    </Screen>
  );
}


/** The device-only skills rows (OD-8), drawn as the Learning Route's SkillsCard rows, read-only. */
function SkillsBlock({ skills }: { skills: ReportSkillsView }): ReactElement {
  return (
    <View testID="learner-report-skills">
      <ReportHeading level={3}>{skills.title}</ReportHeading>
      <Spacer size="xs" />
      <View accessibilityRole="list" style={{ gap: spacing.xs }}>
        {skills.rows.map((row: SkillRowView) => (
          <View
            key={row.skill}
            accessible
            accessibilityLabel={row.a11yLabel}
            {...{ role: 'listitem' }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget.min }}
            testID={`learner-report-skill-${row.skill}`}
          >
            <Icon name={row.icon} size={28} color={colors.text.secondary} />
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm, rowGap: spacing.xxs }}>
                <Body weight="semibold">{row.label}</Body>
                {row.marks.length > 0 ? <PipRow groups={[row.marks]} context="stage" accent={SKILL_ACCENT[row.skill]} /> : null}
              </View>
              <Body size="sm" tone="secondary">
                {row.detail}
              </Body>
            </View>
          </View>
        ))}
      </View>
      {skills.tiles !== null ? <Body tone="secondary">{skills.tiles}</Body> : null}
      <Spacer size="xs" />
      <Caption tone="muted">{skills.note}</Caption>
    </View>
  );
}
