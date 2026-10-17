import { Body, Button, Caption, Card, Heading, Icon, Screen, Spacer, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import { CURRICULUM_MAX_ITEMS, PACES, WEEKDAYS, addDays, type PaceId, type ThemeKey, type Weekday } from '@hangul-route/content-schema';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import {
  CUSTOM_WEEKS_MAX,
  CUSTOM_WEEKS_MIN,
  MINUTE_CHOICES,
  PACE_IDS,
  defaultDaysFor,
  toggleDay,
  weeksOfChoice,
  withPace,
  type LengthChoice,
} from '../../logic/route/proposal-flow';
import {
  FOCUS_IDS,
  SETUP_LENGTHS,
  SETUP_STEPS,
  STARTING_POINT_IDS,
  THEMES,
  stepReady,
  toggleTheme,
  tooManyItems,
  type SetupState,
  type SetupStep,
} from '../../logic/route/setup-flow';
import type { RootStackParamList } from '../../navigation/types';
import { usePlanStore } from '../../store/plan-store';
import { RadioTile } from '../placement/parts';
import { A_SUNDAY, DayChip, StepButton, WIDE_CHIP, dayLabel } from './parts';
import { usePlanBasis } from './use-plan-basis';
import { useBackGuard } from '../use-back-guard';

/**
 * **Change the plan** (F-PLAN-002 section 3.9, wireframe console/curriculum-planner.md G1 as
 * amended by FP-B6 / FP-B13): one screen per step with large chips, the console wizard's four
 * steps with the `self` defaults. Where to start (prefilled from the plan in force or the level
 * check, else Brand new), time (pace chips with the suggested one pre-selected, days and minutes),
 * how long, what you like (focus and up to five themes in the order tapped). **See my plan**
 * opens the preview (G2). Everything is local.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'RouteSetup'>;

/** A theme chip: a checkbox with its order number when chosen, at least 64 dp. */
function ThemeChip({ label, order, onPress, testID }: { label: string; order: string | null; onPress: () => void; testID: string }): React.ReactElement {
  const checked = order !== null;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      accessibilityLabel={order ?? label}
      style={{
        minHeight: touchTarget.min,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        borderRadius: radii.lg,
        borderWidth: checked ? borderWidth.thick : borderWidth.base,
        borderColor: checked ? colors.brand.primary : colors.border.subtle,
        backgroundColor: checked ? colors.brand.primaryLight : colors.surface.paper,
      }}
    >
      {checked ? <Icon name="check" size={spacing.lg} color={colors.brand.primaryDark} /> : null}
      <Body weight="semibold">{order ?? label}</Body>
    </Pressable>
  );
}

export function RouteSetupScreen({ route, navigation }: Props): React.ReactElement {
  const { profileId, choice } = route.params;
  const m = useMessages();
  const t = m.learner.weeklyPlan.setup;
  const p = m.learner.weeklyPlan.proposal;
  const locale = useLocale();
  const { ready, basis, active } = usePlanBasis(profileId, choice);
  const othersFirst = usePlanStore((s) => (s.byLearner[profileId]?.length ?? 0) > 0);
  const [state, setState] = useState<SetupState | null>(null);
  // The plan in force when the steps began (null: none): the preview replaces that one only.
  const [replacing, setReplacing] = useState<string | null>(null);
  const [step, setStep] = useState<SetupStep>('start');

  useEffect(() => {
    if (state !== null || basis === null) return;
    setState(basis.state);
    setReplacing(active?.id ?? null);
  }, [basis, state, active]);

  const index = SETUP_STEPS.indexOf(step);
  const leave = (): void => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main', { screen: 'Home' });
  };
  // Back steps back through the setup steps, then leaves: the header's Back, the browser and the phone back alike
  // (AMENDMENTS-DISPLAY-NAV section 7.1).
  useBackGuard(navigation, () => {
    if (index === 0) return false;
    setStep(SETUP_STEPS[index - 1] as SetupStep);
    return true;
  });

  const header = (
    <>
      <Heading level="title">{t.title}</Heading>
      <Caption tone="secondary" testID="route-setup-step">
        {t.stepOf(index + 1, SETUP_STEPS.length)}
      </Caption>
      <Spacer size="md" />
    </>
  );

  if (state === null) {
    return (
      <Screen tone="canvas" scrollable>
        {header}
        {ready && basis === null ? (
          <>
            <Body testID="route-setup-nothing">{p.nothingReady}</Body>
            <Spacer size="xl" />
            <Button label={p.back.cta} tone="secondary" size="lg" fullWidth onPress={leave} testID="route-setup-done" />
          </>
        ) : null}
      </Screen>
    );
  }

  const set = (patch: Partial<SetupState>): void => setState({ ...state, ...patch });
  const maxCustom = Math.min(CUSTOM_WEEKS_MAX, Math.floor(CURRICULUM_MAX_ITEMS / PACES[state.pace]));
  const chosenDays = state.days ?? defaultDaysFor(state.startDate, state.pace);
  const canGoOn = stepReady(step, state);
  const last = index === SETUP_STEPS.length - 1;

  const startStep = (
    <>
      <Heading level="prompt">{t.start.title}</Heading>
      <Spacer size="sm" />
      <View accessibilityRole="radiogroup" accessibilityLabel={t.start.title} style={{ gap: spacing.sm }}>
        {STARTING_POINT_IDS.map((id) => (
          <RadioTile key={id} selected={state.start === id} onPress={() => set({ start: id })} accessibilityLabel={t.start.cards[id]} testID={`route-setup-start-${id}`}>
            <Body weight="semibold">{t.start.cards[id]}</Body>
          </RadioTile>
        ))}
      </View>
      {othersFirst ? (
        <>
          <Spacer size="md" />
          <Body tone="secondary" testID="route-setup-others-first">
            {t.start.othersFirst}
          </Body>
        </>
      ) : null}
    </>
  );

  const timeStep = (
    <>
      <Heading level="prompt">{t.time.title}</Heading>
      <Spacer size="sm" />
      <Body weight="semibold">{p.paceTitle}</Body>
      <Spacer size="xs" />
      <View accessibilityRole="radiogroup" accessibilityLabel={p.paceTitle} style={{ gap: spacing.sm }}>
        {PACE_IDS.map((id: PaceId) => (
          <RadioTile
            key={id}
            selected={state.pace === id}
            onPress={() => setState({ ...state, ...withPace(state, id) })}
            accessibilityLabel={p.paceLabel(p.pace[id], PACES[id])}
            testID={`route-setup-pace-${id}`}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: spacing.md }}>
              <Body weight="semibold">{p.pace[id]}</Body>
              <Caption tone="secondary">{p.paceDays(PACES[id])}</Caption>
            </View>
          </RadioTile>
        ))}
      </View>
      <Spacer size="md" />
      <Card padding="md" tone="sunken" testID="route-setup-days">
        <Body weight="semibold">{p.daysTitle}</Body>
        <Caption tone="secondary">{p.daysHint(PACES[state.pace])}</Caption>
        <Spacer size="sm" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {WEEKDAYS.map((day: Weekday, i) => (
            <DayChip
              key={day}
              label={dayLabel(locale, addDays(A_SUNDAY, i))}
              checked={chosenDays.includes(day)}
              onPress={() => setState({ ...state, ...toggleDay(state, day) })}
              testID={`route-setup-weekday-${day}`}
            />
          ))}
        </View>
      </Card>
      <Spacer size="md" />
      <Body weight="semibold">{p.minutesTitle}</Body>
      <Spacer size="xs" />
      <View accessibilityRole="radiogroup" accessibilityLabel={p.minutesTitle} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {MINUTE_CHOICES.map((minutes) => (
          <View key={minutes} style={{ flexBasis: WIDE_CHIP, flexGrow: 1 }}>
            <RadioTile selected={state.minutes === minutes} onPress={() => set({ minutes })} accessibilityLabel={p.minutesLabel(minutes)} testID={`route-setup-minutes-${minutes}`}>
              <Body weight="semibold">{p.minutes(minutes)}</Body>
            </RadioTile>
          </View>
        ))}
      </View>
    </>
  );

  const setLength = (length: LengthChoice): void => set({ length, customWeeks: length === 'custom' ? weeksOfChoice(state) : state.customWeeks });
  const lengthStep = (
    <>
      <Heading level="prompt">{t.length.title}</Heading>
      <Spacer size="sm" />
      <View accessibilityRole="radiogroup" accessibilityLabel={t.length.title} style={{ gap: spacing.sm }}>
        {SETUP_LENGTHS.map((id) => (
          <RadioTile key={id} selected={state.length === id} onPress={() => setLength(id)} accessibilityLabel={p.length[id]} testID={`route-setup-length-${id}`}>
            <Body weight="semibold">{p.length[id]}</Body>
          </RadioTile>
        ))}
      </View>
      {state.length === 'custom' ? (
        <>
          <Spacer size="sm" />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
            <StepButton
              icon="dash"
              label={p.fewerWeeks}
              disabled={state.customWeeks <= CUSTOM_WEEKS_MIN}
              onPress={() => set({ customWeeks: Math.max(CUSTOM_WEEKS_MIN, state.customWeeks - 1) })}
              testID="route-setup-weeks-less"
            />
            <Body weight="semibold" testID="route-setup-weeks" style={{ minWidth: touchTarget.hero, textAlign: 'center' }}>
              {p.weeks(state.customWeeks)}
            </Body>
            <StepButton
              icon="plus"
              label={p.moreWeeks}
              disabled={state.customWeeks >= maxCustom}
              onPress={() => set({ customWeeks: Math.min(maxCustom, state.customWeeks + 1) })}
              testID="route-setup-weeks-more"
            />
          </View>
        </>
      ) : null}
      {tooManyItems(state) ? (
        <>
          <Spacer size="sm" />
          <Body tone="secondary" testID="route-setup-too-many">
            {t.tooMany}
          </Body>
        </>
      ) : null}
    </>
  );

  const likesStep = (
    <>
      <Heading level="prompt">{t.likes.title}</Heading>
      <Spacer size="sm" />
      <Body weight="semibold">{t.likes.focusTitle}</Body>
      <Spacer size="xs" />
      <View accessibilityRole="radiogroup" accessibilityLabel={t.likes.focusTitle} style={{ gap: spacing.sm }}>
        {FOCUS_IDS.map((id) => (
          <RadioTile key={id} selected={state.focus === id} onPress={() => set({ focus: id })} accessibilityLabel={t.likes.focus[id]} testID={`route-setup-focus-${id}`}>
            <Body weight="semibold">{t.likes.focus[id]}</Body>
          </RadioTile>
        ))}
      </View>
      <Spacer size="md" />
      <Body weight="semibold">{t.likes.themesTitle}</Body>
      <Caption tone="secondary">{t.likes.themesHint}</Caption>
      <Spacer size="xs" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {THEMES.map((theme: ThemeKey) => {
          const at = state.themes.indexOf(theme);
          const name = t.likes.themeNames[theme];
          return (
            <ThemeChip
              key={theme}
              label={name}
              order={at === -1 ? null : t.likes.themeChosen(at + 1, name)}
              onPress={() => setState(toggleTheme(state, theme))}
              testID={`route-setup-theme-${theme}`}
            />
          );
        })}
      </View>
    </>
  );

  const body = step === 'start' ? startStep : step === 'time' ? timeStep : step === 'length' ? lengthStep : likesStep;

  return (
    <Screen tone="canvas" scrollable>
      {header}
      {body}
      <Spacer size="xl" />
      <Button
        label={last ? t.see.cta : t.next.cta}
        tone="primary"
        size="lg"
        fullWidth
        disabled={!canGoOn}
        onPress={() => {
          if (last) navigation.navigate('RoutePreview', { profileId, setup: state, replacing });
          else setStep(SETUP_STEPS[index + 1] as SetupStep);
        }}
        testID={last ? 'route-setup-see' : 'route-setup-next'}
      />
      <Spacer size="xl" />
    </Screen>
  );
}
