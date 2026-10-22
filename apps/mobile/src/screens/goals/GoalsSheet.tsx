import { Body, Button, Heading, Icon, Spacer, borderWidth, colors, layout, radii, shadows, spacing, touchTarget, useLayoutClass } from '@hangul-route/design-system';
import React, { useEffect, useId, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { DAILY_TIERS, WEEKLY_DAYS, type DailyGoal, type WeeklyDays } from '../../logic/goals/points';
import { tierLabelOf } from '../../logic/goals/strip-view';
import { useHistorySheet } from '../../platform/history-bridge';

/**
 * The goals sheet (F-CURR-002 section 7.4, row CM-17; design/wireframes/home/goal-ring-weekly-dots.md C and C2):
 * a bottom sheet on a phone, a centred dialog from the regular class. "Every day": three radio cards in plain
 * time words (no points shown). "Every week": 3, 5 or 7 days; while a weekly plan is on, its days a week read
 * only, with See my plan. Done, the close button, the scrim, Escape and the system back all save the choice and
 * close. Changeable any time; a latched week is never judged again.
 */

export interface GoalsSheetProps {
  visible: boolean;
  daily: DailyGoal;
  weeklyGoal: WeeklyDays;
  /** A weekly plan's days a week while one is on (C2); null otherwise. */
  planDays: number | null;
  onSave: (choice: { daily: DailyGoal; weeklyDays: WeeklyDays }) => void;
  onSeePlan: () => void;
}

type Focusable = { focus?: () => void } | null;

function Radio({
  selected,
  label,
  onPress,
  testID,
  children,
  refFn,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
  testID: string;
  children: React.ReactNode;
  refFn?: (node: Focusable) => void;
}): React.ReactElement {
  return (
    <Pressable
      ref={refFn ? (node: unknown) => refFn(node as Focusable) : undefined}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: touchTarget.min,
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radii.md,
        borderWidth: selected ? borderWidth.base : borderWidth.thin,
        borderColor: selected ? colors.brand.primary : colors.border.subtle,
        backgroundColor: selected ? colors.brand.primaryLight : pressed ? colors.surface.sunken : colors.surface.paper,
      })}
    >
      {children}
    </Pressable>
  );
}

/** The radio mark: a ring, filled with a dot when chosen (the outline and the dot, never colour alone). */
function Mark({ selected }: { selected: boolean }): React.ReactElement {
  return (
    <View
      aria-hidden
      style={{
        width: spacing.xl,
        height: spacing.xl,
        borderRadius: radii.circle,
        borderWidth: borderWidth.base,
        borderColor: selected ? colors.brand.primary : colors.border.shape,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {selected ? <View style={{ width: spacing.md, height: spacing.md, borderRadius: radii.circle, backgroundColor: colors.brand.primary }} /> : null}
    </View>
  );
}

export function GoalsSheet({ visible, daily, weeklyGoal, planDays, onSave, onSeePlan }: GoalsSheetProps): React.ReactElement {
  const messages = useMessages();
  const g = messages.learner.goals;
  const dialog = useLayoutClass().width !== 'compact';
  const titleId = `goals-sheet-title-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [choice, setChoice] = useState({ daily, weeklyDays: weeklyGoal });
  // Each opening starts from the goals in force.
  useEffect(() => {
    if (visible) setChoice({ daily, weeklyDays: weeklyGoal });
  }, [visible, daily, weeklyGoal]);
  const close = (): void => onSave(choice);
  useHistorySheet(visible, close);
  // Focus starts on the chosen daily goal (web; native screen readers start at the dialog).
  const selectedRef = useRef<Focusable>(null);
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return undefined;
    const timer = setTimeout(() => selectedRef.current?.focus?.(), 0);
    return () => clearTimeout(timer);
  }, [visible]);
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return undefined;
    type KeyEvent = { key?: string; stopPropagation?: () => void };
    const doc = (globalThis as { document?: { addEventListener: (t: string, f: (e: KeyEvent) => void) => void; removeEventListener: (t: string, f: (e: KeyEvent) => void) => void } }).document;
    if (!doc) return undefined;
    const onKey = (event: KeyEvent): void => {
      if (event.key !== 'Escape') return;
      event.stopPropagation?.();
      close();
    };
    doc.addEventListener('keydown', onKey);
    return () => doc.removeEventListener('keydown', onKey);
  });

  return (
    <Modal visible={visible} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: dialog ? 'center' : 'flex-end', alignItems: dialog ? 'center' : 'stretch', backgroundColor: colors.surface.overlay }}>
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={messages.a11y.goals.close}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          testID="goals-sheet-scrim"
        />
        <View
          role="dialog"
          aria-modal
          aria-labelledby={titleId}
          testID="goals-sheet"
          style={{
            width: '100%',
            maxWidth: dialog ? layout.maxWidth.reading : undefined,
            maxHeight: '90%',
            backgroundColor: colors.surface.paper,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            borderBottomLeftRadius: dialog ? radii.xl : 0,
            borderBottomRightRadius: dialog ? radii.xl : 0,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
            paddingHorizontal: spacing.lg,
            ...shadows.modal,
          }}
        >
          <ScrollView style={{ flexShrink: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View nativeID={titleId} {...{ id: titleId }} style={{ flex: 1 }}>
                <Heading level="prompt">{g.sheet.title}</Heading>
              </View>
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel={messages.a11y.goals.close}
                testID="goals-sheet-close"
                style={{ minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="close" size={spacing.xl} color={colors.text.primary} />
              </Pressable>
            </View>
            <Spacer size="sm" />
            <Body weight="bold">{g.sheet.everyDay}</Body>
            <Spacer size="xs" />
            <View accessibilityRole="radiogroup" aria-label={g.sheet.everyDay} style={{ gap: spacing.sm }}>
              {DAILY_TIERS.map(({ tier, points }) => {
                const selected = choice.daily === points;
                return (
                  <Radio
                    key={tier}
                    selected={selected}
                    label={tierLabelOf(tier, g)}
                    onPress={() => setChoice((c) => ({ ...c, daily: points }))}
                    testID={`goals-daily-${tier}`}
                    refFn={selected ? (node) => (selectedRef.current = node) : undefined}
                  >
                    <Mark selected={selected} />
                    <Body weight="semibold">{g.daily[tier]}</Body>
                    <Body size="sm" tone="secondary">
                      {g.daily.time[tier]}
                    </Body>
                  </Radio>
                );
              })}
            </View>
            <Spacer size="md" />
            <Body weight="bold">{g.sheet.everyWeek}</Body>
            <Spacer size="xs" />
            {planDays !== null ? (
              <View style={{ gap: spacing.sm }} testID="goals-weekly-plan">
                <Body size="sm">{g.sheet.fromPlan(planDays)}</Body>
                <Button label={g.sheet.seePlan.cta} tone="ghost" size="md" onPress={onSeePlan} testID="goals-see-plan" />
              </View>
            ) : (
              <View accessibilityRole="radiogroup" aria-label={g.sheet.everyWeek} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {WEEKLY_DAYS.map((days) => {
                  const selected = choice.weeklyDays === days;
                  return (
                    <Radio key={days} selected={selected} label={g.weekly.days(days)} onPress={() => setChoice((c) => ({ ...c, weeklyDays: days }))} testID={`goals-weekly-${days}`}>
                      <Mark selected={selected} />
                      <Body weight="semibold">{g.weekly.days(days)}</Body>
                    </Radio>
                  );
                })}
              </View>
            )}
            <Spacer size="md" />
            <Body size="sm" tone="secondary">
              {g.sheet.steadyHelp}
            </Body>
            <Spacer size="sm" />
            <Body size="sm" tone="secondary">
              {g.sheet.restHelp}
            </Body>
            <Spacer size="lg" />
            <Button label={g.sheet.done.cta} tone="primary" size="md" fullWidth onPress={close} testID="goals-sheet-done" />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
