import {
  Body,
  Button,
  Caption,
  Card,
  Icon,
  KOREAN_LANGUAGE,
  PipRow,
  Screen,
  SectionTabs,
  Spacer,
  borderWidth,
  colors,
  radii,
  sectionTabId,
  spacing,
  touchTarget,
  typography,
} from '@hangul-route/design-system';
import { CATALOG, type ReportPeriod, type StageKey } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { flags, reportsEnabledFor } from '../../config/flags';
import { jamoAll, questsAll, stages } from '../../content';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { localizeJamo, localizeQuest, localizeStage } from '../../logic/content-locale';
import { buildMyRoute } from '../../logic/my-route/model';
import { localizedRouteContent, routeModelInput } from '../../logic/my-route/route-input';
import { emptySnapshot, type SkillRowView } from '../../logic/my-route/view';
import { isParentSessionValid, parentSessionRemainingMs } from '../../logic/profiles/session';
import { reportEntry } from '../../logic/reports/entry';
import { reportViewedEvent } from '../../logic/reports/events';
import {
  inAppReportView,
  type InAppReportView,
  type ReportCalendarView,
  type ReportDetailBlock,
  type ReportGrowthView,
  type ReportLetterTile,
  type ReportLineView,
  type ReportSectionView,
  type ReportSentence,
} from '../../logic/reports/report-view';
import { reportSkillsView, type ReportSkillsView } from '../../logic/reports/skills-view';
import { reportVoice } from '../../logic/reports/voice';
import type { RootStackParamList } from '../../navigation/types';
import { focusForScreenReader } from '../../platform/screen-reader';
import { track } from '../../platform/telemetry';
import { useAudience } from '../../store/audience';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { summarizeFor } from '../../store/sync-store';
import { useAccessTier } from '../../store/tier-store';
import { useUiStore } from '../../store/ui-store';
import { SKILL_ACCENT } from '../my-route/SkillsCard';

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
 * Read-only: it never writes progress, never changes the active profile and sends only `report.viewed` without a
 * profile id. The voice comes from `reportVoice` (never from `gateOpensDirectly`, which decides only the entry). No
 * Print, no Send a note, no Browse link on a letter (OD-7, section 3.9).
 */

type Props = NativeStackScreenProps<RootStackParamList, 'LearnerReport'>;

/** The report below the tabs is their panel (`aria-controls` / `aria-labelledby`); the stepper controls it too. */
const PANEL_ID = 'learner-report-panel';
/** The More detail disclosure's panel (`aria-controls`). */
const DETAIL_PANEL_ID = 'learner-report-more-detail-panel';
/** Read by assistive tech, drawn nowhere (the 1 x 1 clipped box of the web sr-only pattern). */
const srOnly = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;
/** Figure tiles: two a row on a phone (design README "Constants": 7rem). */
const FIGURE_TILE_MIN = 112;
/** The growth chart's drawing box (design README "Constants"): an SVG viewBox that scales to the column. */
const GROWTH_BOX = { width: 300, height: 150 } as const;
/** The cards line is dashed so the two lines differ by more than colour (section 3.12). */
const GROWTH_DASH = `${spacing.sm} ${spacing.xs}`;
/** One week of calendar columns. */
const WEEK_COLUMNS = 7;

// `lang`, `role` and `aria-*` are web-only props react-native-web forwards to the DOM; spread so the native props
// need no type for them (the SourcesParts pattern).
const koreanSpeech = { lang: KOREAN_LANGUAGE, accessibilityLanguage: KOREAN_LANGUAGE };
const headingLevel = (level: 1 | 2 | 3): Record<string, string | number> => ({ role: 'heading', 'aria-level': level });

function ReportHeading({ level, children, testID }: { level: 1 | 2 | 3; children: React.ReactNode; testID?: string }): React.ReactElement {
  const size = level === 1 ? typography.size.title : level === 2 ? typography.size.prompt : typography.size.body;
  return (
    <Text
      {...headingLevel(level)}
      accessibilityRole="header"
      testID={testID}
      style={{ fontSize: size, lineHeight: size * typography.leading.normal, fontWeight: typography.weight.bold, color: colors.text.primary }}
    >
      {children}
    </Text>
  );
}

/**
 * LR-D's `link-button` (design README "Reused"): an outlined pill on paper, `touchTarget.min` tall, named by its
 * visible text. The report's quieter controls use it: Open Learning Route, the step buttons, the table toggle and,
 * full width and square-cornered, the More detail disclosure.
 */
function OutlineButton({
  label,
  onPress,
  accessibilityLabel,
  leading,
  trailing,
  expanded,
  controls,
  block = false,
  pressableRef,
  testID,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  expanded?: boolean;
  /** The id of the region this button changes (web `aria-controls`). */
  controls?: string;
  block?: boolean;
  pressableRef?: React.Ref<View>;
  testID?: string;
}): React.ReactElement {
  const disclosure = {
    ...(expanded === undefined ? {} : { 'aria-expanded': expanded }),
    ...(controls === undefined ? {} : { 'aria-controls': controls }),
  };
  return (
    <Pressable
      ref={pressableRef}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      {...disclosure}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: touchTarget.min,
        minWidth: touchTarget.min,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: block ? 'space-between' : 'center',
        alignSelf: block ? 'stretch' : 'flex-start',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderRadius: block ? radii.md : radii.pill,
        borderWidth: borderWidth.base,
        borderColor: pressed ? colors.border.focus : colors.border.strong,
        backgroundColor: colors.surface.paper,
      })}
    >
      {leading}
      <Body weight="bold">{label}</Body>
      {trailing}
    </Pressable>
  );
}

export function LearnerReportScreen({ route, navigation }: Props): React.ReactElement {
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

function ReportBody({ profileId, name, voice, navigation, locale, messages }: BodyProps): React.ReactElement {
  const stored = useProgressStore((s) => s.byProfile[profileId]);
  const hydrated = useProgressStore((s) => s.hydratedFor.has(profileId));
  const tier = useAccessTier(profileId);
  const localized = useMemo(() => localizedRouteContent(locale), [locale]);
  const [period, setPeriod] = useState<ReportPeriod>('week');
  const [at, setAt] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The live region speaks only after the grown-up changed the period or stepped, never on open.
  const [changed, setChanged] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const prevRef = useRef<View>(null);
  const nextRef = useRef<View>(null);
  const lastStep = useRef<'prev' | 'next' | null>(null);

  useEffect(() => {
    void useProgressStore.getState().hydrate(profileId);
  }, [profileId]);

  const built = useMemo((): { view: InAppReportView; skills: ReportSkillsView | null } | null => {
    if (!hydrated) return null;
    void attempt;
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
  }, [hydrated, stored, profileId, name, voice, period, at, locale, messages, tier, localized, attempt]);

  // One `report.viewed` on open and on each period change or step (section 3.13), without a profile id. Keyed on
  // what the grown-up chose, not on `built`, which also changes when the progress store does. Every drawn report
  // counts, whatever its state (the console's route records every view too).
  const shown = built !== null;
  useEffect(() => {
    if (shown) void track(reportViewedEvent(period));
  }, [period, at, shown]);

  // A step that removes the pressed button (Next on reaching this window, Previous on the oldest) moves focus to the
  // other step button, so it never drops to the page body (design pass #444).
  const stepper = built?.view.stepper ?? null;
  useEffect(() => {
    const step = lastStep.current;
    if (step === null) return;
    lastStep.current = null;
    const target = step === 'next' && stepper?.next === null ? prevRef.current : step === 'prev' && stepper?.prev === null ? nextRef.current : null;
    if (target === null) return;
    // A view's own focus() moves keyboard focus on the web; VoiceOver and TalkBack need their own call.
    if (Platform.OS === 'web') (target as unknown as { focus?: () => void }).focus?.();
    else focusForScreenReader(target);
  }, [stepper]);

  // The polite announcement after a period change or a step (section 3.12). The live region below speaks on the web
  // and on Android; VoiceOver does not read live regions, so iOS announces it (the ResultsScreen pattern).
  const announce = changed ? (built?.view.announce ?? null) : null;
  useEffect(() => {
    if (announce !== null && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(announce);
  }, [announce]);

  const back = (
    <View style={{ flexDirection: 'row' }}>
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel={messages.common.buttons.back}
        testID="learner-report-back"
        style={{ minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center', borderRadius: radii.circle }}
      >
        <Icon name="arrow-left" size={28} />
      </Pressable>
    </View>
  );

  if (!hydrated) {
    return (
      <Screen tone="canvas" scrollable>
        {back}
        <View accessibilityRole="progressbar" accessibilityLabel={messages.a11y.report.loading} testID="learner-report-loading" style={{ gap: spacing.md }}>
          {[spacing.xxxl, spacing.jumbo, spacing.jumbo].map((height, k) => (
            <View key={k} style={{ height, borderRadius: radii.md, backgroundColor: colors.surface.sunken }} />
          ))}
        </View>
      </Screen>
    );
  }

  if (built === null) {
    return (
      <Screen tone="canvas" scrollable>
        {back}
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
  const step = (dir: 'prev' | 'next'): void => {
    const target = dir === 'prev' ? stepper?.prev : stepper?.next;
    if (!target) return;
    lastStep.current = dir;
    setAt(target.at);
    setChanged(true);
  };

  const body = (
    <>
      {view.headline !== null ? (
        <>
          <Spacer size="md" />
          <Text testID="learner-report-headline" style={{ fontSize: typography.size.prompt, lineHeight: typography.size.prompt * typography.leading.normal, fontWeight: typography.weight.bold, color: colors.text.primary }}>
            {view.headline.text}
          </Text>
          {view.headline.horizon !== null ? <Caption tone="muted">{view.headline.horizon}</Caption> : null}
        </>
      ) : null}
      {view.wentWell !== null ? <InsightSection section={view.wentWell} marker={colors.brand.primary} testID="learner-report-went-well" /> : null}
      {view.practiceNext !== null ? (
        <InsightSection section={view.practiceNext} marker={colors.border.shape} testID="learner-report-practice-next">
          {/* The end of this section is F-BROWSE-001 BR-12a's: one Preview lessons row, web only (design: in-app-report.md). */}
        </InsightSection>
      ) : null}
      {view.thisPeriod !== null ? (
        <View testID="learner-report-this-period">
          <Spacer size="lg" />
          <ReportHeading level={2}>{view.thisPeriod.heading}</ReportHeading>
          <Spacer size="sm" />
          {view.thisPeriod.figures !== null ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {view.thisPeriod.figures.map((figure) => (
                <View
                  key={figure.key}
                  testID={`learner-report-figure-${figure.key}`}
                  style={{ flexGrow: 1, flexBasis: FIGURE_TILE_MIN, minWidth: FIGURE_TILE_MIN, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.paper, borderWidth: borderWidth.thin, borderColor: colors.border.subtle }}
                >
                  <Text style={{ fontSize: typography.size.title, lineHeight: typography.size.title * typography.leading.tight, fontWeight: typography.weight.bold, color: colors.text.primary }}>{figure.count}</Text>
                  <Body size="sm" tone="secondary">
                    {figure.label}
                  </Body>
                  {figure.up !== null ? <Caption style={{ color: colors.feedback.successDark }}>{figure.up}</Caption> : null}
                </View>
              ))}
            </View>
          ) : null}
          {view.thisPeriod.calendar !== null ? <CalendarBlock calendar={view.thisPeriod.calendar} period={period} /> : null}
          {view.thisPeriod.growth !== null ? <GrowthBlock growth={view.thisPeriod.growth} /> : null}
        </View>
      ) : null}
      {view.moreDetail !== null ? (
        <View testID="learner-report-more-detail">
          <Spacer size="lg" />
          <View {...headingLevel(2)}>
            <OutlineButton
              label={view.moreDetail.button}
              block
              expanded={detailOpen}
              controls={DETAIL_PANEL_ID}
              onPress={() => setDetailOpen((open) => !open)}
              trailing={<View style={{ transform: [{ rotate: detailOpen ? '-90deg' : '90deg' }] }}><Icon name="arrow-right" size={20} /></View>}
              testID="learner-report-more-detail-toggle"
            />
          </View>
          <View nativeID={DETAIL_PANEL_ID} {...{ id: DETAIL_PANEL_ID }}>
            {detailOpen ? (
              <View style={{ gap: spacing.lg, paddingTop: spacing.md }}>
                {view.moreDetail.blocks.map((detail) => (
                  <DetailBlock key={'key' in detail ? detail.key : detail.kind} block={detail} />
                ))}
                {skills !== null ? <SkillsBlock skills={skills} /> : null}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <Screen tone="canvas" scrollable>
      {back}
      <ReportHeading level={1} testID="learner-report-title">
        {view.title}
      </ReportHeading>
      {view.glance !== null ? (
        <View style={{ gap: spacing.xs, marginTop: spacing.xs }} testID="learner-report-glance">
          {view.glance.nowOn !== null ? <Body>{view.glance.nowOn}</Body> : null}
          {view.glance.openRoute !== null ? (
            <OutlineButton
              label={view.glance.openRoute}
              // The grown-up's read-only view of this report's profile (L1), never the learner's own page.
              onPress={() => navigation.navigate('MyRoute', { profileId, viewer: 'grownup' })}
              testID="learner-report-open-route"
            />
          ) : null}
          {view.glance.lastPractice !== null ? <Caption tone="muted">{view.glance.lastPractice}</Caption> : null}
        </View>
      ) : null}
      {view.notices.length > 0 ? (
        <>
          <Spacer size="md" />
          <Card padding="md" tone="sunken" testID="learner-report-notices">
            {view.notices.map((line) => (
              <Body key={line}>{line}</Body>
            ))}
          </Card>
        </>
      ) : null}
      {view.tabs !== null ? (
        <>
          <Spacer size="md" />
          <SectionTabs items={view.tabs.items} value={view.tabs.value} onChange={choosePeriod} accessibilityLabel={view.tabs.label} panelId={PANEL_ID} testID="learner-report-tabs" />
          {stepper !== null ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
              {stepper.prev !== null ? (
                <OutlineButton
                  label={stepper.prev.label}
                  accessibilityLabel={stepper.prev.name}
                  leading={<Icon name="arrow-left" size={20} />}
                  onPress={() => step('prev')}
                  controls={PANEL_ID}
                  pressableRef={prevRef}
                  testID="learner-report-step-prev"
                />
              ) : null}
              <Body tone="secondary" testID="learner-report-range">
                {stepper.range}
              </Body>
              {stepper.next !== null ? (
                <OutlineButton
                  label={stepper.next.label}
                  accessibilityLabel={stepper.next.name}
                  trailing={<Icon name="arrow-right" size={20} />}
                  onPress={() => step('next')}
                  controls={PANEL_ID}
                  pressableRef={nextRef}
                  testID="learner-report-step-next"
                />
              ) : null}
            </View>
          ) : null}
          {/* A polite announcement after a period change or a step (section 3.12). */}
          <View style={srOnly} accessibilityLiveRegion="polite" {...{ 'aria-live': 'polite' }}>
            <Text>{announce ?? ''}</Text>
          </View>
          <View {...{ role: 'tabpanel', id: PANEL_ID, 'aria-labelledby': sectionTabId(PANEL_ID, view.tabs.value) }}>{body}</View>
        </>
      ) : (
        body
      )}
      <Spacer size="xl" />
    </Screen>
  );
}

function SentenceText({ sentence }: { sentence: ReportSentence }): React.ReactElement {
  return (
    <Body>
      {sentence.parts.map((part, k) => {
        if (part.kind === 'text') return <Text key={k}>{part.text}</Text>;
        if (part.kind === 'quest') return <Text key={k}>{part.title}</Text>;
        return (
          <Text key={k}>
            {part.before}
            <Text {...koreanSpeech}>{part.letter}</Text>
            {part.after}
          </Text>
        );
      })}
    </Body>
  );
}

function InsightSection({ section, marker, testID, children }: { section: ReportSectionView; marker: string; testID: string; children?: React.ReactNode }): React.ReactElement {
  return (
    <View testID={testID}>
      <Spacer size="lg" />
      <ReportHeading level={2}>{section.heading}</ReportHeading>
      <Spacer size="xs" />
      <View accessibilityRole="list" style={{ gap: spacing.xs }}>
        {section.lines.map((line: ReportLineView, k) => (
          <View key={`${line.code}-${k}`} {...{ role: 'listitem' }} style={{ flexDirection: 'row', gap: spacing.sm }} testID={`${testID}-line-${k}`}>
            {/* A small disc marks each line: never a check or a star that would grade (design pass). */}
            <View style={{ width: spacing.sm, height: spacing.sm, borderRadius: radii.circle, backgroundColor: marker, marginTop: spacing.sm + spacing.xxs }} />
            <View style={{ flex: 1 }}>
              <SentenceText sentence={line.sentence} />
              {line.tip !== null ? (
                <Body size="sm" tone="secondary">
                  {line.tip}
                </Body>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      {children}
    </View>
  );
}

function CalendarBlock({ calendar, period }: { calendar: ReportCalendarView; period: ReportPeriod }): React.ReactElement {
  const cells: (ReportCalendarView['cells'][number] | null)[] = [...Array.from({ length: calendar.lead }, () => null), ...calendar.cells];
  const columnWidth = `${100 / WEEK_COLUMNS}%` as const;
  return (
    <View testID="learner-report-calendar" style={{ marginTop: spacing.md }}>
      {/* The sentence below says the same in words; the marks are hidden from screen readers. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...{ 'aria-hidden': true }}>
        {cells.map((cell, k) => (
          <View key={cell?.day ?? `lead-${k}`} style={{ width: columnWidth, alignItems: 'center', paddingVertical: spacing.xxs }}>
            {cell === null ? null : (
              <>
                <Caption tone="secondary">{period === 'week' ? cell.weekday : String(cell.date)}</Caption>
                {period === 'week' ? <Caption tone="muted">{String(cell.date)}</Caption> : null}
                <View
                  testID={`learner-report-day-${cell.day}`}
                  style={{
                    width: '86%',
                    maxWidth: spacing.xxxl,
                    aspectRatio: 1,
                    borderRadius: radii.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: cell.kind === 'practiced' ? colors.brand.secondary : colors.surface.paper,
                    borderWidth: borderWidth.base,
                    borderColor: cell.kind === 'practiced' ? colors.brand.secondary : colors.border.shape,
                  }}
                >
                  {cell.kind === 'practiced' ? <Icon name="check" size={20} color={colors.text.onSecondary} /> : null}
                </View>
              </>
            )}
          </View>
        ))}
      </View>
      <Spacer size="xs" />
      <Body size="sm" tone="secondary" testID="learner-report-calendar-sentence">
        {calendar.sentence}
      </Body>
    </View>
  );
}

function GrowthBlock({ growth }: { growth: ReportGrowthView }): React.ReactElement {
  const [tableOpen, setTableOpen] = useState(false);
  const count = growth.rows.length;
  // Points sit at the centres of equal columns, so a month label sits under its point (design README).
  const point = (k: number, value: number): string =>
    `${((k + 0.5) / Math.max(1, count)) * GROWTH_BOX.width},${GROWTH_BOX.height - (value / growth.max) * (GROWTH_BOX.height - spacing.lg) - spacing.xs}`;
  const line = (key: 'quests' | 'cards'): string => growth.rows.map((row, k) => point(k, row[key])).join(' ');
  const legend = (label: string, color: string, dashed: boolean): React.ReactElement => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={{ width: spacing.xl, height: 0, borderTopWidth: borderWidth.thick, borderStyle: dashed ? 'dashed' : 'solid', borderColor: color }} />
      <Caption tone="secondary">{label}</Caption>
    </View>
  );
  const table = (
    <View accessibilityLabel={growth.caption} testID="learner-report-growth-table" style={{ gap: spacing.xxs }}>
      <View style={{ flexDirection: 'row' }}>
        {[growth.month, growth.quests, growth.cards].map((head) => (
          <Body key={head} weight="bold" size="sm" style={{ flex: 1 }}>
            {head}
          </Body>
        ))}
      </View>
      {growth.rows.map((row) => (
        <View key={row.m} style={{ flexDirection: 'row' }}>
          <Body size="sm" style={{ flex: 1 }}>
            {row.label}
          </Body>
          <Body size="sm" style={{ flex: 1 }}>
            {String(row.quests)}
          </Body>
          <Body size="sm" style={{ flex: 1 }}>
            {String(row.cards)}
          </Body>
        </View>
      ))}
    </View>
  );
  return (
    <View testID="learner-report-growth" style={{ marginTop: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {legend(growth.quests, colors.brand.primary, false)}
        {legend(growth.cards, colors.brand.secondary, true)}
      </View>
      {count > 0 ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" {...{ 'aria-hidden': true }}>
          <Svg width="100%" height={GROWTH_BOX.height} viewBox={`0 0 ${GROWTH_BOX.width} ${GROWTH_BOX.height}`} preserveAspectRatio="none">
            {/* The box stretches to the column; strokes keep their width and dash length (non-scaling-stroke). */}
            <Polyline points={line('quests')} fill="none" stroke={colors.brand.primary} strokeWidth={borderWidth.thick} vectorEffect="non-scaling-stroke" />
            <Polyline
              points={line('cards')}
              fill="none"
              stroke={colors.brand.secondary}
              strokeWidth={borderWidth.thick}
              strokeDasharray={GROWTH_DASH}
              vectorEffect="non-scaling-stroke"
            />
          </Svg>
          <View style={{ flexDirection: 'row' }}>
            {growth.rows.map((row) => (
              <Caption key={row.m} tone="muted" style={{ flex: 1, textAlign: 'center' }}>
                {row.label}
              </Caption>
            ))}
          </View>
        </View>
      ) : null}
      {growth.since !== null ? <Body size="sm" tone="secondary">{growth.since}</Body> : null}
      {count > 0 ? (
        <>
          <View style={{ alignItems: 'flex-start' }}>
            <OutlineButton label={tableOpen ? growth.hideTable : growth.showTable} expanded={tableOpen} onPress={() => setTableOpen((open) => !open)} testID="learner-report-growth-toggle" />
          </View>
          {/* The table is the line's text alternative: visible when opened, read by screen readers always. */}
          {tableOpen ? table : <View style={srOnly}>{table}</View>}
        </>
      ) : null}
    </View>
  );
}

function DetailBlock({ block }: { block: ReportDetailBlock }): React.ReactElement {
  if (block.kind === 'totals') return <Body testID="learner-report-detail-totals">{block.line}</Body>;
  if (block.kind === 'letters') {
    return (
      <>
        <LetterTiles heading={block.heading} tiles={block.tiles} id={block.key} />
        {block.moreLine !== null ? <Body testID={`learner-report-letters-more-${block.key}`}>{block.moreLine}</Body> : null}
      </>
    );
  }
  return (
    <View testID={`learner-report-detail-${block.key}`}>
      <ReportHeading level={3}>{block.heading}</ReportHeading>
      {block.lines.map((line) => (
        <Body key={line}>{line}</Body>
      ))}
    </View>
  );
}

/**
 * Letter tiles that expand (design: "a letter tile tapped"): each tile is a disclosure button named by its visible
 * letter and romanization; the expansion under the row shows the letter large with its content romanization and gloss.
 */
function LetterTiles({ heading, tiles, id }: { heading: string; tiles: ReportLetterTile[]; id: string }): React.ReactElement {
  const [open, setOpen] = useState<string | null>(null);
  const expansionId = `learner-report-letters-${id}-detail`;
  const opened = tiles.find((tile) => tile.letter === open) ?? null;
  return (
    <View testID={`learner-report-detail-${id}`}>
      <ReportHeading level={3}>{heading}</ReportHeading>
      <Spacer size="xs" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {tiles.map((tile) => {
          const expanded = tile.letter === open;
          return (
            <Pressable
              key={tile.letter}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              {...{ 'aria-expanded': expanded, 'aria-controls': expansionId }}
              onPress={() => setOpen(expanded ? null : tile.letter)}
              testID={`learner-report-tile-${id}-${tile.letter}`}
              style={{
                // At least a touch target, and free to grow so large text never clips the romanization (section 3.12).
                minWidth: touchTarget.min,
                minHeight: touchTarget.min,
                paddingHorizontal: spacing.xs,
                paddingVertical: spacing.xs,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radii.md,
                backgroundColor: colors.surface.paper,
                borderWidth: expanded ? borderWidth.base : borderWidth.thin,
                borderColor: expanded ? colors.brand.primary : colors.border.strong,
              }}
            >
              <Text {...koreanSpeech} style={{ fontSize: typography.size.prompt, color: colors.text.primary }}>
                {tile.letter}
              </Text>
              {tile.romanization !== null ? <Caption tone="secondary">{tile.romanization}</Caption> : null}
            </Pressable>
          );
        })}
      </View>
      <View nativeID={expansionId} {...{ id: expansionId }}>
        {opened !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: colors.surface.sunken }} testID={`learner-report-tile-detail-${id}`}>
            <Text {...koreanSpeech} style={{ fontSize: typography.size.display, color: colors.text.primary }}>
              {opened.letter}
            </Text>
            <View style={{ flex: 1 }}>
              {opened.detail !== null ? (
                <>
                  <Body weight="bold">{opened.detail.romanization}</Body>
                  {opened.detail.gloss !== null ? <Body tone="muted">{opened.detail.gloss}</Body> : null}
                </>
              ) : opened.romanization !== null ? (
                <Body weight="bold">{opened.romanization}</Body>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The device-only skills rows (OD-8), drawn as the Learning Route's SkillsCard rows, read-only. */
function SkillsBlock({ skills }: { skills: ReportSkillsView }): React.ReactElement {
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
