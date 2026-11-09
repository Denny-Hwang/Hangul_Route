import { Body, Caption, Card, Icon, KOREAN_LANGUAGE, KOREAN_LINE_BREAK, Screen, SectionTabs, Spacer, borderWidth, colors, radii, sectionTabId, spacing, typography, useTypeScale } from '@hangul-route/design-system';
import type { ReportPeriod, StageKey } from '@hangul-route/content-schema';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { AccessibilityInfo, Platform, Text, View } from 'react-native';
import { stages } from '../../content';
import { useLessonTitlesVersion, useLocale, useMessages } from '../../i18n/use-messages';
import { classReportBodyOf, type AccountClassReportBody } from '../../logic/account/account-data';
import { accountClassReportView, type AccountClassReportView, type ClassLetterBlock } from '../../logic/account/class-report';
import { failureOf } from '../../logic/account/homes';
import { accountQueryKey } from '../../logic/account/queries';
import { localizeStage } from '../../logic/content-locale';
import type { ReportSentence } from '../../logic/reports/report-view';
import type { GrownUpStackParamList } from '../../navigation/types';
import { focusForScreenReader } from '../../platform/screen-reader';
import { OutlineButton, ReportHeading, ReportSkeleton } from '../parent/report-blocks';
import { AccountButton } from './AccountButton';
import { AccountGate, type AccountGateNavigation } from './AccountGate.native';
import { useAccountNetwork } from './account-session.native';
import { StateBox, useAccountApi } from './home-parts.native';
import { readOrThrow, useEndedSession, type AccountPageNavigation } from './home-data.native';

/**
 * F-AUTH-004 sections 8.1, 8.7 and 8.8 (row NS-6; design `account-reports.md` boards 2 and 3,
 * `design/screens/reports/class-report.md`; F-REPORT-001 section 3.7; CS-N5; anti-shame): a class's report on iOS and
 * Android, `AccountClassReport { spaceId, period }`, inside `AccountGate`, opened by **Class report** on a class row or
 * the class page. It reads `GET /api/spaces/:id/class-report?period=` (and `&at=` for a past window: the Worker computes
 * one window per read), the class statistics the console draws, and draws them in the report's frame: the title, the
 * class lines, the period tabs and the stepper, the headline, What went well, Practice together, This period and More
 * detail (`accountClassReportView`). Left out on native (D14): Send a note, Print, **Plan a lesson** and the homework
 * plan link (its counts stay, as plain text). Every figure is the class's: no learner is named, ranked or compared.
 *
 * States (8.8): the report's skeleton while loading (and in the panel while a new period or step loads, under its
 * tabs); offline, `home.offline` with Try again (it reloads by itself); an error while online, `report.state.error`
 * with Try again; a space with no class report, `report.state.unavailable`; `401`, the records go and the sign-in
 * opens; `403 native_off`, `home.unavailable` with Back only. No telemetry of its own (the Worker records the view).
 */

type Props = NativeStackScreenProps<GrownUpStackParamList, 'AccountClassReport'>;
type ReportNavigation = NativeStackNavigationProp<GrownUpStackParamList, 'AccountClassReport'>;

/** The report under the tabs is their panel; the stepper controls it too. */
const PANEL_ID = 'account-class-report-panel';
const DETAIL_PANEL_ID = 'account-class-report-more-detail-panel';
/** Read by assistive tech, drawn nowhere. */
const SR_ONLY = { position: 'absolute', width: 1, height: 1, margin: -1, overflow: 'hidden' } as const;
// `lang`, `role` and `aria-*` are web-only props react-native-web forwards to the DOM (the report blocks' pattern).
const koreanSpeech = { lang: KOREAN_LANGUAGE, accessibilityLanguage: KOREAN_LANGUAGE };

export function AccountClassReportScreen({ navigation, route }: Props): ReactElement {
  const { spaceId, period, use } = route.params;
  return (
    <AccountGate screen="home" use={use} navigation={navigation as unknown as AccountGateNavigation} routeKey={route.key}>
      <AccountClassReport spaceId={spaceId} initialPeriod={period} use={use} routeKey={route.key} navigation={navigation} />
    </AccountGate>
  );
}

interface ReportProps {
  spaceId: string;
  initialPeriod: ReportPeriod;
  use: Props['route']['params']['use'];
  routeKey: string;
  navigation: ReportNavigation;
}

function AccountClassReport({ spaceId, initialPeriod, use, routeKey, navigation }: ReportProps): ReactElement {
  const messages = useMessages();
  const locale = useLocale();
  const titles = useLessonTitlesVersion();
  const api = useAccountApi();
  const { online, recheck } = useAccountNetwork();
  const [period, setPeriod] = useState<ReportPeriod>(initialPeriod);
  const [at, setAt] = useState<string | null>(null);
  // The live region speaks only after the grown-up changed the period or stepped, never on open.
  const [changed, setChanged] = useState(false);

  const report = useQuery({
    queryKey: accountQueryKey('class-report', spaceId, period, at ?? 'current'),
    queryFn: (): Promise<AccountClassReportBody> => readOrThrow(() => api.classReport(spaceId, period, at), classReportBodyOf),
    enabled: online,
    retry: false,
    staleTime: 0,
    // A period change or a step keeps the frame (title, tabs) on screen while the next window is read.
    placeholderData: (previous) => previous,
  });

  const view = useMemo((): AccountClassReportView | null => {
    if (report.data === undefined) return null;
    void titles;
    return accountClassReportView({
      body: report.data,
      period,
      at,
      now: new Date(),
      locale,
      messages,
      stageTitle: (key: StageKey) => {
        const stage = stages.find((s) => s.key === key);
        return stage === undefined ? '' : localizeStage(stage, locale).titleEn;
      },
    });
  }, [report.data, period, at, locale, messages, titles]);

  const failure = !online ? 'offline' : report.isError && !report.isFetching ? failureOf(report.error) : null;
  useEndedSession(failure, navigation as unknown as AccountPageNavigation, routeKey, use);

  const retry = (): void => {
    recheck();
    if (online) void report.refetch();
  };
  // The figures under the tabs are the window asked for, never the previous one's while it loads.
  const loadingWindow = report.isPlaceholderData;

  let body: ReactElement;
  if (failure === 'unauthorized') body = <ReportSkeleton label={messages.a11y.report.loading} />;
  else if (failure === 'offline' || failure === 'unavailable') body = <StateBox failure={failure} onRetry={retry} onBack={() => navigation.goBack()} testID="account-class-report-state" />;
  else if (failure === 'cant_load') {
    body = (
      <>
        <Body testID="account-class-report-error">{messages.report.state.error}</Body>
        <Spacer size="md" />
        <AccountButton label={messages.common.buttons.tryAgain} tone="primary" onPress={retry} testID="account-class-report-retry" />
      </>
    );
  } else if (report.data !== undefined && view === null) body = <Body testID="account-class-report-unavailable">{messages.report.state.unavailable}</Body>;
  else if (view === null) body = <ReportSkeleton label={messages.a11y.report.loading} />;
  else {
    body = (
      <ClassReportView
        view={view}
        loading={loadingWindow}
        announce={changed && !loadingWindow ? view.announce : null}
        onChoosePeriod={(next) => {
          setPeriod(next);
          setAt(null);
          setChanged(true);
        }}
        onStep={(target) => {
          setAt(target);
          setChanged(true);
        }}
        loadingLabel={messages.a11y.report.loading}
      />
    );
  }
  return (
    <Screen tone="canvas" scrollable testID="account-class-report">
      {body}
      <Spacer size="xl" />
    </Screen>
  );
}

interface ClassReportViewProps {
  view: AccountClassReportView;
  /** A new period or window is being read: the panel shows the skeleton under the tabs. */
  loading: boolean;
  announce: string | null;
  onChoosePeriod: (period: ReportPeriod) => void;
  onStep: (at: string | null) => void;
  loadingLabel: string;
}

/** The class report, from its title to More detail (`design/screens/reports/class-report.md`, without Print and links). */
function ClassReportView({ view, loading, announce, onChoosePeriod, onStep, loadingLabel }: ClassReportViewProps): ReactElement {
  const textScale = useTypeScale();
  const [detailOpen, setDetailOpen] = useState(false);
  const prevRef = useRef<View>(null);
  const nextRef = useRef<View>(null);
  const lastStep = useRef<'prev' | 'next' | null>(null);
  const stepper = view.stepper;

  // A step that removes the pressed button (Next on reaching this window, Previous on the oldest) moves the screen
  // reader's focus to the other step button, so it never drops to the page body (the learner report's rule).
  useEffect(() => {
    const step = lastStep.current;
    if (step === null) return;
    lastStep.current = null;
    const target = step === 'next' && stepper?.next === null ? prevRef.current : step === 'prev' && stepper?.prev === null ? nextRef.current : null;
    if (target !== null) focusForScreenReader(target);
  }, [stepper]);

  // VoiceOver reads no live region: iOS announces the change (Android reads the polite region below).
  useEffect(() => {
    if (announce !== null && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(announce);
  }, [announce]);

  const step = (dir: 'prev' | 'next'): void => {
    const target = dir === 'prev' ? stepper?.prev : stepper?.next;
    if (!target) return;
    lastStep.current = dir;
    onStep(target.at);
  };

  const panel = loading ? (
    <ReportSkeleton label={loadingLabel} />
  ) : (
    <>
      {view.headline !== null ? (
        <View testID="account-class-report-headline">
          <Spacer size="md" />
          <Text {...KOREAN_LINE_BREAK} style={{ fontSize: textScale.size.prompt, lineHeight: textScale.size.prompt * typography.leading.normal, fontWeight: typography.weight.bold, color: colors.text.primary }}>
            {view.headline.text}
          </Text>
          {view.headline.up !== null ? <UpLine text={view.headline.up} /> : null}
          {view.headline.note !== null ? <Caption tone="muted">{view.headline.note}</Caption> : null}
        </View>
      ) : null}
      {view.wentWell !== null ? (
        <Section heading={view.wentWell.heading} testID="account-class-report-went-well">
          {view.wentWell.letters !== null ? <LetterBlock block={view.wentWell.letters} testID="account-class-report-letters-new" /> : null}
          <View>
            <Body>{view.wentWell.quests.text}</Body>
            {view.wentWell.quests.up !== null ? <UpLine text={view.wentWell.quests.up} /> : null}
          </View>
          <Body>{view.wentWell.cards}</Body>
          {view.wentWell.milestones !== null ? (
            <View style={{ gap: spacing.xs }}>
              <ReportHeading level={3}>{view.wentWell.milestones.heading}</ReportHeading>
              {view.wentWell.milestones.lines.map((line) => (
                <Body key={line}>{line}</Body>
              ))}
            </View>
          ) : null}
        </Section>
      ) : null}
      {view.practiceTogether !== null ? (
        <Section heading={view.practiceTogether.heading} testID="account-class-report-practice-together">
          <LetterBlock block={view.practiceTogether.revisit} testID="account-class-report-revisit" />
        </Section>
      ) : null}
      {view.thisPeriod !== null ? (
        <Section heading={view.thisPeriod.heading} testID="account-class-report-this-period">
          {view.thisPeriod.noneYet !== null ? <Body>{view.thisPeriod.noneYet}</Body> : null}
          {view.thisPeriod.afterUpdate !== null ? <Body>{view.thisPeriod.afterUpdate}</Body> : null}
          {view.thisPeriod.bands !== null ? (
            <View>
              <ReportHeading level={3}>{view.thisPeriod.bands.heading}</ReportHeading>
              {/* One text row per band, separated by rules: no bar and no highlight on any row (anti-shame). */}
              {view.thisPeriod.bands.rows.map((row, k) => (
                <View key={row} style={{ paddingVertical: spacing.xs, borderTopWidth: k === 0 ? 0 : borderWidth.thin, borderTopColor: colors.border.subtle }}>
                  <Body>{row}</Body>
                </View>
              ))}
            </View>
          ) : null}
          {view.thisPeriod.notSaved !== null ? <Body tone="secondary">{view.thisPeriod.notSaved}</Body> : null}
          {view.thisPeriod.time !== null ? (
            <View style={{ gap: spacing.xs }}>
              <ReportHeading level={3}>{view.thisPeriod.time.heading}</ReportHeading>
              <View>
                <Body>{view.thisPeriod.time.total}</Body>
                {view.thisPeriod.time.up !== null ? <UpLine text={view.thisPeriod.time.up} /> : null}
              </View>
              {view.thisPeriod.time.median !== null ? <Body>{view.thisPeriod.time.median}</Body> : null}
            </View>
          ) : null}
        </Section>
      ) : null}
      {view.moreDetail !== null ? (
        <View testID="account-class-report-more-detail">
          <Spacer size="lg" />
          <View {...{ role: 'heading', 'aria-level': 2 }}>
            <OutlineButton
              label={view.moreDetail.button}
              block
              expanded={detailOpen}
              controls={DETAIL_PANEL_ID}
              onPress={() => setDetailOpen((open) => !open)}
              trailing={
                <View style={{ transform: [{ rotate: detailOpen ? '-90deg' : '90deg' }] }}>
                  <Icon name="arrow-right" size={20} />
                </View>
              }
              testID="account-class-report-more-detail-toggle"
            />
          </View>
          <View nativeID={DETAIL_PANEL_ID} {...{ id: DETAIL_PANEL_ID }}>
            {detailOpen ? (
              <View style={{ gap: spacing.lg, paddingTop: spacing.md }}>
                {view.moreDetail.memory !== null ? (
                  <View style={{ gap: spacing.xs }}>
                    <ReportHeading level={3}>{view.moreDetail.memory.heading}</ReportHeading>
                    {view.moreDetail.memory.lines.map((line) => (
                      <Body key={line}>{line}</Body>
                    ))}
                    <Caption tone="muted">{view.moreDetail.memory.from}</Caption>
                  </View>
                ) : null}
                {view.moreDetail.levelCheck !== null ? (
                  <View style={{ gap: spacing.sm }} testID="account-class-report-level-check">
                    <ReportHeading level={3}>{view.moreDetail.levelCheck.heading}</ReportHeading>
                    {view.moreDetail.levelCheck.strands.map((strand) => (
                      <View key={strand.name} style={{ gap: spacing.xxs }}>
                        <Body weight="bold">{strand.name}</Body>
                        {strand.rows.map((row) => (
                          <Body key={row} size="sm">
                            {row}
                          </Body>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : null}
                {view.moreDetail.homework !== null ? (
                  <View style={{ gap: spacing.sm }} testID="account-class-report-homework">
                    <ReportHeading level={3}>{view.moreDetail.homework.heading}</ReportHeading>
                    {/* Plain text here: the plan builder is not in the app (ND-2), so no plan is a link. */}
                    {view.moreDetail.homework.plans.map((plan, k) => (
                      <View key={`${plan.title}-${k}`} accessible accessibilityLabel={`${plan.title}, ${plan.counts}`} style={{ backgroundColor: colors.surface.paper, borderRadius: radii.md, borderWidth: borderWidth.thin, borderColor: colors.border.subtle, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
                        <Body weight="bold">{plan.title}</Body>
                        <Body size="sm" tone="secondary">
                          {plan.counts}
                        </Body>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </>
  );

  return (
    <>
      <ReportHeading level={1} testID="account-class-report-title">
        {view.title}
      </ReportHeading>
      <View style={{ gap: spacing.xxs, marginTop: spacing.xs }} testID="account-class-report-class-lines">
        {view.classLines.map((line) => (
          <Body key={line} size="sm" tone="muted">
            {line}
          </Body>
        ))}
      </View>
      {view.archived !== null ? (
        <>
          <Spacer size="md" />
          <Card padding="md" tone="sunken" testID="account-class-report-archived">
            <Body>{view.archived}</Body>
          </Card>
        </>
      ) : null}
      {view.empty !== null ? (
        <>
          <Spacer size="md" />
          <Card padding="md" tone="sunken" testID="account-class-report-empty">
            <Body>{view.empty}</Body>
          </Card>
        </>
      ) : null}
      {view.tabs !== null ? (
        <>
          <Spacer size="md" />
          <SectionTabs items={view.tabs.items} value={view.tabs.value} onChange={onChoosePeriod} accessibilityLabel={view.tabs.label} panelId={PANEL_ID} testID="account-class-report-tabs" />
          {stepper !== null ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
              {stepper.prev !== null ? (
                <OutlineButton label={stepper.prev.label} accessibilityLabel={stepper.prev.name} leading={<Icon name="arrow-left" size={20} />} onPress={() => step('prev')} controls={PANEL_ID} pressableRef={prevRef} testID="account-class-report-step-prev" />
              ) : null}
              <Body tone="secondary" testID="account-class-report-range">
                {stepper.range}
              </Body>
              {stepper.next !== null ? (
                <OutlineButton label={stepper.next.label} accessibilityLabel={stepper.next.name} trailing={<Icon name="arrow-right" size={20} />} onPress={() => step('next')} controls={PANEL_ID} pressableRef={nextRef} testID="account-class-report-step-next" />
              ) : null}
            </View>
          ) : null}
          {/* A polite announcement after a period change or a step (Android; iOS announces it above). */}
          <View style={SR_ONLY} accessibilityLiveRegion="polite" {...{ 'aria-live': 'polite' }}>
            <Text {...KOREAN_LINE_BREAK}>{announce ?? ''}</Text>
          </View>
          <View {...{ role: 'tabpanel', id: PANEL_ID, 'aria-labelledby': sectionTabId(PANEL_ID, view.tabs.value) }}>{panel}</View>
        </>
      ) : null}
    </>
  );
}

/** "More than last week": the up-only line, never a down one (`size.caption` semibold `feedback.successDark`). */
function UpLine({ text }: { text: string }): ReactElement {
  return <Caption style={{ color: colors.feedback.successDark }}>{text}</Caption>;
}

function Section({ heading, testID, children }: { heading: string; testID: string; children: ReactElement | (ReactElement | null)[] }): ReactElement {
  return (
    <View testID={testID}>
      <Spacer size="lg" />
      <ReportHeading level={2}>{heading}</ReportHeading>
      <Spacer size="xs" />
      <View style={{ gap: spacing.sm }}>{children}</View>
    </View>
  );
}

/** A heading over counted letters: one pill per letter, the letter spoken in Korean. Counts, never links. */
function LetterBlock({ block, testID }: { block: ClassLetterBlock; testID: string }): ReactElement {
  return (
    <View style={{ gap: spacing.xs }} testID={testID}>
      <ReportHeading level={3}>{block.heading}</ReportHeading>
      <View accessibilityRole="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {block.chips.map((chip) => (
          <View key={chip.text} {...{ role: 'listitem' }} style={{ backgroundColor: colors.surface.sunken, borderRadius: radii.pill, paddingVertical: spacing.xxs, paddingHorizontal: spacing.sm }}>
            <Chip sentence={chip} />
          </View>
        ))}
      </View>
    </View>
  );
}

function Chip({ sentence }: { sentence: ReportSentence }): ReactElement {
  return (
    <Body size="sm" weight="semibold">
      {sentence.parts.map((part, k) => {
        if (part.kind === 'text') return <Text {...KOREAN_LINE_BREAK} key={k}>{part.text}</Text>;
        if (part.kind === 'quest') return <Text {...KOREAN_LINE_BREAK} key={k}>{part.title}</Text>;
        return (
          <Text {...KOREAN_LINE_BREAK} key={k}>
            {part.before}
            <Text {...KOREAN_LINE_BREAK} {...koreanSpeech}>
              {part.letter}
            </Text>
            {part.after}
          </Text>
        );
      })}
    </Body>
  );
}
