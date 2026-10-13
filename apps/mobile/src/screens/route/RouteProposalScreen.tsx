import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Hoya,
  Icon,
  Pill,
  Screen,
  Spacer,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
} from '@hangul-route/design-system';
import {
  CATALOG,
  CURRICULUM_MAX_ITEMS,
  PACES,
  WEEKDAYS,
  addDays,
  generateCurriculum,
  type CurriculumDraft,
  type DateKey,
  type PaceId,
  type RouteProposal,
  type StageKey,
  type Weekday,
} from '@hangul-route/content-schema';
import { formatDate, type Messages, type UiLocale } from '@hangul-route/i18n';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { dayKey } from '../../logic/homework/mission-builder';
import {
  CUSTOM_WEEKS_MAX,
  CUSTOM_WEEKS_MIN,
  MINUTE_CHOICES,
  PACE_IDS,
  choiceChanged,
  daysReady,
  defaultDaysFor,
  firstWeekRows,
  initialChoice,
  moreLessonsComing,
  paramsOfChoice,
  otherPlanFrom,
  previewLineOf,
  proposalInputOf,
  proposalSkippedEvent,
  proposedEvent,
  safePropose,
  startDaysOf,
  startPickOf,
  toggleDay,
  weeksOfChoice,
  withPace,
  type LengthChoice,
  type PlanChoice,
  type PreviewLine,
  type ProposalContext,
  type WeekRow,
} from '../../logic/route/proposal-flow';
import { activeSelfRoute, completedQuestIdsOf } from '../../logic/route/self-route';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { unlockedStagesFor, usePlanStore } from '../../store/plan-store';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { useRouteStore } from '../../store/route-store';
import { useAccessTier } from '../../store/tier-store';
import { LinkButton, RadioTile } from '../placement/parts';
import { A_SUNDAY, DayChip, StepButton, WIDE_CHIP, WeekList, dayLabel } from './parts';

/**
 * The weekly plan proposal (F-PLAN-002 section 3.9, AMENDMENTS-PLC-PLAN-HANDOFF FP-B6;
 * wireframe design/wireframes/journey/my-route-overview.md K1): Hoya's plan from
 * `proposeRoute`, the pace chips, three length cards with the suggested one pre-selected and
 * tagged "Hoya suggests" (plus Choose weeks), the start day (Today by default, OD-15), the
 * "Change days and time" disclosure, the first week, then **Start this plan** or **Not now**
 * (hides the Home prompt for 14 days or until the next result, OD-16). Learner screens never
 * show the Premium warning, a price or a product: locked and unreleased parts read only "More
 * lessons are coming." Everything is local: the generator and the catalogue are bundled.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'RouteProposal'>;
type ProposalMessages = Messages['learner']['weeklyPlan']['proposal'];

const LENGTHS: readonly LengthChoice[] = ['4-week', '12-week', '6-month', 'custom'];

function previewText(t: ProposalMessages, line: PreviewLine): string {
  switch (line.code) {
    case 'lessons-and-stories':
      return t.preview.lessonsAndStories(line.stage, line.week);
    case 'lessons-cut-short':
      return t.preview.cutShort(line.weeks);
    case 'lessons-then-free-practice':
      return t.preview.freePractice(line.weeks);
    case 'lessons-fill':
      return t.preview.lessonsFill(line.weeks);
    case 'stories-and-words':
      return t.preview.storiesAndWords(line.stories);
  }
}

export function RouteProposalScreen({ route, navigation }: Props): React.ReactElement {
  const { source, profileId, proposedSent: sentBefore } = route.params;
  const m = useMessages();
  const t = m.learner.weeklyPlan.proposal;
  const locale = useLocale();
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId) ?? null);
  const profilesReady = useProfileStore((s) => s.hydrated);
  const plans = usePlanStore((s) => s.byLearner[profileId]);
  const snapshot = useProgressStore((s) => s.byProfile[profileId]);
  // The access tier re-renders the screen when the inbox or the subscription changes it (F-ENT-003 section 3.4).
  const tier = useAccessTier(profileId);
  const today = useMemo(() => dayKey(new Date().toISOString()), []);

  useEffect(() => {
    void useProgressStore.getState().hydrate(profileId);
    void usePlanStore.getState().hydrate(profileId);
  }, [profileId]);

  const active = activeSelfRoute(snapshot);
  const context = useMemo((): ProposalContext | null => {
    if (profile === null || snapshot === undefined) return null;
    return {
      placements: snapshot.placements,
      completedQuestIds: completedQuestIdsOf(snapshot.quests),
      ageGroup: profile.ageGroup,
      unlockedStages: unlockedStagesFor(new Date(), profileId) as StageKey[],
      today,
    };
    // `tier` is read through `unlockedStagesFor`; it is listed so a tier change re-plans.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, snapshot, profileId, today, tier]);

  const initial = useMemo(() => (context === null ? null : safePropose(proposalInputOf(context))), [context]);
  const [choice, setChoice] = useState<PlanChoice | null>(null);
  const [lengthTouched, setLengthTouched] = useState(false);
  const [daysOpen, setDaysOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const firstChoice = useRef<PlanChoice | null>(null);
  const proposedSent = useRef(sentBefore === true);
  // Two taps in one frame both see `busy` false; the ref lets only the first one create a plan.
  const starting = useRef(false);

  useEffect(() => {
    if (initial === null || choice !== null) return;
    const start = initialChoice(initial);
    firstChoice.current = start;
    setChoice(start);
  }, [initial, choice]);

  // `route.proposed` once per offer, for the proposal Hoya made before any change (not again when the door already sent it).
  useEffect(() => {
    if (initial === null || active !== null || proposedSent.current) return;
    proposedSent.current = true;
    const event = proposedEvent(profileId, source, initial);
    void track({ name: event.name, profileId, payload: { ...event.payload } });
  }, [initial, active, profileId, source]);

  // A plan already in force when the screen opens: its overview instead (G3). A plan started here leaves through `leave`.
  const started = useRef(false);
  useEffect(() => {
    if (context !== null && active !== null && !started.current) navigation.replace('RouteOverview', { profileId });
  }, [context, active, navigation, profileId]);

  const pace = choice?.pace;
  const startDate = choice?.startDate;
  // The cards follow the pace and the start day the learner picks (the same `proposeRoute` as the console).
  const proposal = useMemo((): RouteProposal | null => {
    if (context === null || pace === undefined || startDate === undefined) return initial;
    return safePropose(proposalInputOf({ ...context, pace, startDate })) ?? initial;
  }, [context, pace, startDate, initial]);

  // Until the learner picks a length, the suggested one follows the pace.
  const current = choice !== null && proposal !== null && !lengthTouched ? { ...choice, length: proposal.defaultId } : choice;

  const draft = useMemo((): CurriculumDraft | null => {
    if (proposal === null || current === null || !daysReady(current)) return null;
    try {
      return generateCurriculum(paramsOfChoice(proposal, current), CATALOG);
    } catch {
      return null;
    }
  }, [proposal, current]);

  const leave = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main', { screen: 'Home' });
  };

  // The profile was removed or switched away while this screen was open: nothing to plan for.
  const gone = profilesReady && profile === null;
  useEffect(() => {
    if (gone) leave();
    // `leave` only reads `navigation`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gone]);

  const notNow = (): void => {
    void useRouteStore.getState().markDismissed(profileId, new Date().toISOString());
    const event = proposalSkippedEvent(profileId, source);
    void track({ name: event.name, profileId, payload: { ...event.payload } });
    leave();
  };

  const startPlan = async (): Promise<void> => {
    if (draft === null || current === null || starting.current) return;
    starting.current = true;
    setBusy(true);
    setFailed(false);
    started.current = true;
    const changed = firstChoice.current === null ? false : choiceChanged(firstChoice.current, current);
    const created = await useRouteStore.getState().create(profileId, draft, { from: 'proposal', changed });
    starting.current = false;
    setBusy(false);
    if (created === null) {
      started.current = false;
      setFailed(true);
      return;
    }
    leave();
  };

  const header = (
    <>
      <Pressable
        onPress={leave}
        hitSlop={spacing.md}
        accessibilityRole="button"
        accessibilityLabel={m.a11y.goBack}
        style={{ alignSelf: 'flex-start', padding: spacing.xs }}
        testID="route-proposal-back"
      >
        <Icon name="arrow-left" size={28} />
      </Pressable>
      <Spacer size="sm" />
      <Heading level="title">{t.title}</Heading>
      <Spacer size="md" />
    </>
  );

  // Still reading the snapshot: an empty screen for a moment, never a wrong plan.
  if (context === null) {
    return (
      <Screen tone="canvas" scrollable>
        {header}
      </Screen>
    );
  }

  // The learner already follows an own plan: the overview shows it (the effect above moves there).
  if (active !== null) {
    return (
      <Screen tone="canvas" scrollable>
        {header}
      </Screen>
    );
  }

  // Nothing ready to schedule (e.g. placed past every open lesson with no story bundled): no plan, no blank page.
  if (initial === null || proposal === null || current === null) {
    return (
      <Screen tone="canvas" scrollable>
        {header}
        <View testID="route-proposal-nothing" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Hoya pose="thinking" size={72} accessibilityLabel={m.a11y.hoya('thinking')} />
          <Body style={{ flex: 1 }}>{t.nothingReady}</Body>
        </View>
        <Spacer size="xl" />
        <Button label={t.back.cta} tone="secondary" size="lg" fullWidth onPress={leave} testID="route-proposal-done" />
      </Screen>
    );
  }

  const days = startDaysOf(today);
  const pick = startPickOf(current.startDate, today);
  const chosenDays = current.days ?? defaultDaysFor(current.startDate, current.pace);
  const rows = draft === null ? [] : firstWeekRows(draft);
  // The picked days do not match the pace yet: say so where the plan and the Start button are.
  const daysWaiting = !daysReady(current);
  const daysHint = t.daysHint(PACES[current.pace]);
  const otherPlan = otherPlanFrom(plans);
  const optionOf = (id: LengthChoice) => proposal.options.find((o) => o.id === id);
  const maxCustom = Math.min(CUSTOM_WEEKS_MAX, Math.floor(CURRICULUM_MAX_ITEMS / PACES[current.pace]));

  const setLength = (length: LengthChoice): void => {
    setLengthTouched(true);
    setChoice({ ...current, length, customWeeks: length === 'custom' ? weeksOfChoice(current) : current.customWeeks });
  };
  const setCustomWeeks = (weeks: number): void => {
    setLengthTouched(true);
    setChoice({ ...current, length: 'custom', customWeeks: Math.max(CUSTOM_WEEKS_MIN, Math.min(maxCustom, weeks)) });
  };
  const setStart = (date: DateKey): void => setChoice({ ...current, startDate: date, days: null });
  const setPace = (next: PaceId): void => setChoice(withPace(current, next));

  return (
    <Screen tone="canvas" scrollable>
      {header}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Hoya pose="waving" size={72} accessibilityLabel={m.a11y.hoya('waving')} />
        <View style={{ flex: 1 }}>
          <Body weight="semibold" size="lg">
            {t.intro}
          </Body>
          <Body tone="secondary" testID="route-proposal-headline">
            {t.headline[proposal.headline]}
          </Body>
        </View>
      </View>
      {otherPlan !== null ? (
        <>
          <Spacer size="sm" />
          <Body tone="secondary" testID="route-proposal-other-plan">
            {t.otherPlanFirst[otherPlan]}
          </Body>
        </>
      ) : null}

      <Spacer size="lg" />
      <Heading level="prompt">{t.paceTitle}</Heading>
      <Spacer size="sm" />
      <View accessibilityRole="radiogroup" accessibilityLabel={t.paceTitle} style={{ gap: spacing.sm }}>
        {PACE_IDS.map((id) => (
          <RadioTile
            key={id}
            selected={current.pace === id}
            onPress={() => setPace(id)}
            accessibilityLabel={t.paceLabel(t.pace[id], PACES[id])}
            testID={`route-proposal-pace-${id}`}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.md }}>
              <Body weight="semibold">{t.pace[id]}</Body>
              <Caption tone="secondary">{t.paceDays(PACES[id])}</Caption>
            </View>
          </RadioTile>
        ))}
      </View>

      <Spacer size="lg" />
      <Heading level="prompt">{t.lengthTitle}</Heading>
      <Spacer size="sm" />
      <View accessibilityRole="radiogroup" accessibilityLabel={t.lengthTitle} style={{ gap: spacing.sm }}>
        {LENGTHS.map((id) => {
          const option = optionOf(id);
          const selected = current.length === id;
          const suggested = id === proposal.defaultId;
          const line = option === undefined ? null : previewText(t, previewLineOf(option));
          const more = option !== undefined && moreLessonsComing(option);
          const label = id === 'custom' ? t.length.custom : t.length[id];
          return (
            <RadioTile
              key={id}
              selected={selected}
              onPress={() => setLength(id)}
              accessibilityLabel={[label, suggested ? t.suggested.pill : null, line, more ? t.preview.moreComing : null].filter((part) => part !== null).join('. ')}
              testID={`route-proposal-length-${id}`}
            >
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
                <Body weight="semibold">{label}</Body>
                {suggested ? <Pill label={t.suggested.pill} tone="primary" size="sm" testID="route-proposal-suggested" /> : null}
              </View>
              {line !== null ? <Caption tone="secondary">{line}</Caption> : null}
              {more ? <Caption tone="secondary">{t.preview.moreComing}</Caption> : null}
            </RadioTile>
          );
        })}
      </View>
      {current.length === 'custom' ? (
        <>
          <Spacer size="sm" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
            <StepButton
              icon="dash"
              label={t.fewerWeeks}
              disabled={current.customWeeks <= CUSTOM_WEEKS_MIN}
              onPress={() => setCustomWeeks(current.customWeeks - 1)}
              testID="route-proposal-weeks-less"
            />
            <Body weight="semibold" testID="route-proposal-weeks" style={{ minWidth: touchTarget.hero, textAlign: 'center' }}>
              {t.weeks(current.customWeeks)}
            </Body>
            <StepButton
              icon="plus"
              label={t.moreWeeks}
              disabled={current.customWeeks >= maxCustom}
              onPress={() => setCustomWeeks(current.customWeeks + 1)}
              testID="route-proposal-weeks-more"
            />
          </View>
        </>
      ) : null}

      <Spacer size="lg" />
      <Heading level="prompt">{t.startTitle}</Heading>
      <Spacer size="sm" />
      <View accessibilityRole="radiogroup" accessibilityLabel={t.startTitle} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {(['today', 'tomorrow', 'pick'] as const).map((id) => (
          <View key={id} style={{ flexGrow: 1, flexBasis: WIDE_CHIP }}>
            <RadioTile
              selected={pick === id}
              onPress={() => setStart(id === 'today' ? days.today : id === 'tomorrow' ? days.tomorrow : (days.later[0] as DateKey))}
              accessibilityLabel={t.start[id]}
              testID={`route-proposal-start-${id}`}
            >
              <Body weight="semibold">{t.start[id]}</Body>
            </RadioTile>
          </View>
        ))}
      </View>
      {pick === 'pick' ? (
        <>
          <Spacer size="sm" />
          <Caption tone="secondary">{t.pickDay}</Caption>
          <Spacer size="xs" />
          <View accessibilityRole="radiogroup" accessibilityLabel={t.pickDay} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {days.later.map((date) => {
              const selected = current.startDate === date;
              const weekday = dayLabel(locale, date);
              const monthDay = formatDate(locale, `${date}T00:00:00Z`, 'monthDay', { utc: true });
              return (
                <Pressable
                  key={date}
                  onPress={() => setStart(date)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  aria-checked={selected}
                  accessibilityLabel={t.pickDayLabel(weekday, monthDay)}
                  testID={`route-proposal-day-${date}`}
                  style={{
                    minWidth: touchTarget.child,
                    minHeight: touchTarget.min,
                    paddingHorizontal: spacing.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: radii.lg,
                    borderWidth: selected ? borderWidth.thick : borderWidth.base,
                    borderColor: selected ? colors.brand.primary : colors.border.subtle,
                    backgroundColor: selected ? colors.brand.primaryLight : colors.surface.paper,
                  }}
                >
                  <Caption tone="secondary">{weekday}</Caption>
                  <Body weight="semibold">{monthDay}</Body>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Spacer size="md" />
      <Button
        label={daysOpen ? t.hideDays.cta : t.changeDays.cta}
        tone="ghost"
        size="md"
        expanded={daysOpen}
        onPress={() => setDaysOpen((open) => !open)}
        testID="route-proposal-change-days"
      />
      {daysOpen ? (
        <Card padding="md" tone="sunken" testID="route-proposal-days">
          <Body weight="semibold">{t.daysTitle}</Body>
          <Caption tone="secondary">{t.daysHint(PACES[current.pace])}</Caption>
          <Spacer size="sm" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {WEEKDAYS.map((day: Weekday, i) => (
              <DayChip
                key={day}
                label={dayLabel(locale, addDays(A_SUNDAY, i))}
                checked={chosenDays.includes(day)}
                onPress={() => setChoice(toggleDay(current, day))}
                testID={`route-proposal-weekday-${day}`}
              />
            ))}
          </View>
          <Spacer size="md" />
          <Body weight="semibold">{t.minutesTitle}</Body>
          <Spacer size="sm" />
          <View accessibilityRole="radiogroup" accessibilityLabel={t.minutesTitle} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {MINUTE_CHOICES.map((minutes) => (
              <View key={minutes} style={{ flexBasis: WIDE_CHIP, flexGrow: 1 }}>
                <RadioTile
                  selected={current.minutes === minutes}
                  onPress={() => setChoice({ ...current, minutes })}
                  accessibilityLabel={t.minutesLabel(minutes)}
                  testID={`route-proposal-minutes-${minutes}`}
                >
                  <Body weight="semibold">{t.minutes(minutes)}</Body>
                </RadioTile>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Spacer size="lg" />
      <Heading level="prompt">{t.firstWeek}</Heading>
      <Spacer size="sm" />
      {daysWaiting ? (
        <Body tone="secondary" testID="route-proposal-days-waiting">
          {daysHint}
        </Body>
      ) : rows.length > 0 ? (
        <WeekList rows={rows} locale={locale} testID="route-proposal-first-week" />
      ) : (
        <Body tone="secondary">{t.firstWeekEmpty}</Body>
      )}

      <Spacer size="xl" />
      {failed ? (
        <>
          <Body tone="secondary" testID="route-proposal-failed">
            {t.saveFailed}
          </Body>
          <Spacer size="sm" />
        </>
      ) : null}
      <Button
        label={busy ? t.starting.cta : t.startPlan.cta}
        tone="primary"
        size="lg"
        fullWidth
        disabled={busy || draft === null}
        accessibilityHint={daysWaiting ? daysHint : undefined}
        onPress={() => void startPlan()}
        testID="route-proposal-start"
      />
      <Spacer size="sm" />
      <Button
        label={t.moreChoices.cta}
        tone="ghost"
        size="md"
        fullWidth
        onPress={() => navigation.navigate('RouteSetup', { profileId, choice: current })}
        testID="route-proposal-more-choices"
      />
      <Spacer size="sm" />
      <LinkButton label={t.notNow.cta} onPress={notNow} testID="route-proposal-not-now" />
      <Spacer size="xl" />
    </Screen>
  );
}
