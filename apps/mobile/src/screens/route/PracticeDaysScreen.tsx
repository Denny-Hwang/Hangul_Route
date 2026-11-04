import { Body, Caption, Card, Heading, Icon, Screen, Spacer, TapBoard, TapTarget, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import { addDays, type Weekday } from '@hangul-route/content-schema';
import { formatDate } from '@hangul-route/i18n';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, type ReactElement, type ReactNode } from 'react';
import { View } from 'react-native';
import { useLocale, useMessages } from '../../i18n/use-messages';
import { sourcesOf } from '../../logic/homework/plan-derivation';
import { effectiveLearnerType } from '../../logic/profiles/learner-type';
import { blendWeekOf } from '../../logic/route/blend-view';
import { leadingBlended } from '../../logic/route/layer';
import { CHIP_DAYS, daysForCount, learnerDaysOf, practiceDaysChangedEvent, toggleDay } from '../../logic/route/practice-days';
import type { RootStackParamList } from '../../navigation/types';
import { track } from '../../platform/telemetry';
import { usePlanStore } from '../../store/plan-store';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { A_SUNDAY, dayLabel } from './parts';
import { usePlanChangesOpen } from './use-plan-gate';
import { useToday } from './use-today';

/**
 * My practice days (AMENDMENTS-ROUTE-CLASS-BLEND sections 7, 9.4 and 13, row BL-8, BL-OD-7; wireframe
 * design/wireframes/journey/route-class-blend.md B7, mock design/screens/route-blend/mock/profile.html panel 3).
 * Profile -> weekly plan, while the class plan with practice days leads and `flags.routeBlendEnabled` is on. Count
 * chips 1 to 7 and weekday chips (Sunday first, the class day marked by the class glyph and allowed); each chip is a
 * KT-1 `TapTarget` on one board. A self learner changes the days here; a child's change goes through the grown-up
 * gate (`planChangesOpen`, OD-17): on a gated device every control is named "(PIN required)" and a tap opens the gate,
 * which comes back here as the grown-up's view. The lessons never change; the class never sees the days. Part of
 * the practice-days chunk.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'PracticeDays'>;

/** A chip at least 64 x 64 (`touchTarget.min`), its states in tokens; the press look is the KT-1 one. */
function Chip({ role, label, on, testID, onPress, children }: { role: 'radio' | 'checkbox'; label: string; on: boolean; testID: string; onPress: () => void; children: ReactNode }): ReactElement {
  return (
    <TapTarget
      onCommit={onPress}
      accessibilityLabel={label}
      accessibilityRole={role}
      accessibilityState={{ checked: on }}
      testID={testID}
      style={({ pressed }) => ({
        minWidth: touchTarget.min,
        minHeight: touchTarget.min,
        paddingHorizontal: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xxs,
        borderRadius: radii.lg,
        borderWidth: pressed || on ? borderWidth.thick : borderWidth.base,
        borderColor: pressed ? colors.border.shape : on ? colors.brand.primary : colors.border.subtle,
        backgroundColor: on ? colors.brand.primaryLight : colors.surface.paper,
        transform: pressed ? [{ scale: 0.97 }] : [],
      })}
    >
      {() => children}
    </TapTarget>
  );
}

export function PracticeDaysScreen({ navigation, route }: Props): ReactElement {
  const { profileId, viewer } = route.params;
  const m = useMessages();
  const locale = useLocale();
  const words = m.learner.route.blend.practiceDays;
  const profile = useProfileStore((s) => s.profiles.find((p) => p.id === profileId) ?? null);
  const plans = usePlanStore((s) => s.byLearner[profileId]);
  const snapshot = useProgressStore((s) => s.byProfile[profileId]);
  const today = useToday();
  const changesOpen = usePlanChangesOpen(profile);
  const editable = viewer === 'grownup' || changesOpen;
  const by = profile !== null && effectiveLearnerType(profile) === 'self' && viewer !== 'grownup' ? 'self' : 'grownup';

  const view = useMemo(() => {
    const sources = sourcesOf(plans ?? [], null);
    const lead = leadingBlended(sources, today);
    const blend = lead?.meta?.params.blend;
    if (lead === null || blend === undefined) return null;
    const defaults = blendWeekOf([lead], today)?.practiceDays ?? [];
    const own = learnerDaysOf(snapshot?.practiceDays, lead.id);
    return { planId: lead.id, classDays: blend.lecture.days, defaults, days: own ?? defaults, planIds: sources.map((s) => s.id) };
  }, [plans, snapshot?.practiceDays, today]);

  const change = (next: Weekday[]): void => {
    if (view === null) return;
    if (!editable) {
      navigation.navigate('PinEntry', { next: 'PracticeDays', profileId });
      return;
    }
    if (next.length === view.days.length && next.every((day) => view.days.includes(day))) return;
    const stored = useProgressStore.getState().setPracticeDays(profileId, { planId: view.planId, days: next, updatedAt: new Date().toISOString() }, view.planIds);
    if (!stored) return;
    void track(practiceDaysChangedEvent(next, by));
    void usePlanStore.getState().rederive(profileId);
  };

  const gated = (name: string): string => m.caregiver.audience.gated(name, !editable);
  const dayName = (day: Weekday): string => formatDate(locale, `${addDays(A_SUNDAY, CHIP_DAYS.indexOf(day))}T00:00:00Z`, 'weekdayLong', { utc: true });

  return (
    <Screen tone="canvas" scrollable>
      <Heading level="title">{words.title}</Heading>
      <Spacer size="sm" />
      <Body tone="secondary">{words.hint}</Body>
      {view === null ? null : (
        <>
          <Spacer size="md" />
          <Card padding="md" testID="practice-days">
            {editable ? null : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }} testID="practice-days-gate">
                  <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                    <Icon name="lock" size={spacing.lg} color={colors.text.secondary} />
                  </View>
                  <Body tone="secondary">{words.gate}</Body>
                </View>
                <Spacer size="sm" />
              </>
            )}
            <TapBoard lock="target" testID="practice-days-board">
              <Caption tone="secondary">
                {words.count}
              </Caption>
              <Spacer size="xs" />
              <View accessibilityRole="radiogroup" accessibilityLabel={words.count} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <Chip key={n} role="radio" label={gated(String(n))} on={view.days.length === n} testID={`practice-days-count-${n}`} onPress={() => change(daysForCount(view.days, n, view.defaults, view.classDays))}>
                    <Body weight="semibold">{String(n)}</Body>
                  </Chip>
                ))}
              </View>
              <Spacer size="md" />
              <View role="group" aria-label={words.title} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {CHIP_DAYS.map((day, i) => (
                  <Chip key={day} role="checkbox" label={gated(m.a11y.route.blend.practiceDay(dayName(day)))} on={view.days.includes(day)} testID={`practice-days-day-${day}`} onPress={() => change(toggleDay(view.days, day))}>
                    {view.classDays.includes(day) ? (
                      <View aria-hidden importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID={`practice-days-class-${day}`}>
                        <Icon name="class" size={spacing.lg} color={colors.text.secondary} />
                      </View>
                    ) : null}
                    <Body weight="semibold">{dayLabel(locale, addDays(A_SUNDAY, i))}</Body>
                  </Chip>
                ))}
              </View>
            </TapBoard>
          </Card>
        </>
      )}
    </Screen>
  );
}
