import {
  Body,
  Button,
  Caption,
  Heading,
  Icon,
  Pill,
  borderWidth,
  colors,
  radii,
  spacing,
  touchTarget,
  typography,
} from '@hangul-route/design-system';
import type { ClockScale } from '@hangul-route/content-schema';
import React, { useEffect, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { scaleOptions, type ChallengeCopy, type ClockView } from '../../logic/vocab/challenge';
import { focusForScreenReader } from '../../platform/screen-reader';

/**
 * The Challenge mode pieces shared by the Speed Round and the Profile card
 * (F-VOC-004 S-6; design/screens/vocab/speed-round.md "Challenge mode"):
 * radio chips, the opt-in switch row, the clock row and the paused panel.
 * Decisions live in `logic/vocab/challenge.ts`; these only render them.
 */

export interface Choice<T extends string | number> {
  value: T;
  label: string;
}

/** A radiogroup of chips (the LanguageChips pattern): a check mark and a border, never colour alone. */
export function ChoiceChips<T extends string | number>({
  choices,
  selected,
  onSelect,
  groupLabel,
  testID,
}: {
  choices: ReadonlyArray<Choice<T>>;
  selected: T;
  onSelect: (value: T) => void;
  groupLabel: string;
  testID: string;
}): React.ReactElement {
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={groupLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {choices.map((c) => {
        const active = c.value === selected;
        return (
          <Pressable
            key={String(c.value)}
            testID={`${testID}-${String(c.value)}`}
            onPress={() => {
              if (!active) onSelect(c.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            // RN-web drops `aria-checked` for an unchecked radio; a radio must always say its state.
            aria-checked={active}
            accessibilityLabel={c.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              minHeight: touchTarget.min,
              paddingHorizontal: spacing.lg,
              backgroundColor: active ? colors.brand.primaryLight : colors.surface.paper,
              borderColor: active ? colors.brand.primary : colors.border.subtle,
              borderWidth: borderWidth.base,
              borderRadius: radii.lg,
            }}
          >
            {active ? <Icon name="check" size={spacing.lg} color={colors.brand.primary} /> : null}
            <Body weight="semibold">{c.label}</Body>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The three clock lengths (Normal / A bit longer / Twice as long). */
export function ScaleChips({
  scale,
  onSelect,
  copy,
  groupLabel,
  testID,
}: {
  scale: ClockScale;
  onSelect: (scale: ClockScale) => void;
  copy: ChallengeCopy;
  groupLabel: string;
  testID: string;
}): React.ReactElement {
  const choices = scaleOptions(copy).map((o) => ({ value: o.scale, label: o.label }));
  return <ChoiceChips choices={choices} selected={scale} onSelect={onSelect} groupLabel={groupLabel} testID={testID} />;
}

/** One switch row: title, a line and an On / Off pill (the Profile Sound card's pattern). */
export function SwitchRow({
  title,
  line,
  on,
  onLabel,
  offLabel,
  onToggle,
  testID,
}: {
  title: string;
  line: string;
  on: boolean;
  onLabel: string;
  offLabel: string;
  onToggle: () => void;
  testID: string;
}): React.ReactElement {
  return (
    <Pressable
      testID={testID}
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      aria-checked={on}
      accessibilityLabel={`${title}. ${line}`}
      style={{ minHeight: touchTarget.min, justifyContent: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Body weight="semibold">{title}</Body>
          <Caption tone="muted">{line}</Caption>
        </View>
        <Pill tone={on ? 'success' : 'neutral'} label={on ? onLabel : offLabel} size="sm" />
      </View>
    </Pressable>
  );
}

/**
 * The Challenge clock (frame G): the digits as one `timer` element named
 * "Time left: N seconds", read on focus only (a timer's implicit `aria-live`
 * is off, and nothing here sets one), a bar in 1/60 steps in
 * `brand.secondary` that never changes colour, and the static words of the
 * last ten seconds. The digits are plain text at the title size, not a
 * heading, so heading navigation never lands on a ticking clock.
 */
export function ClockDigits({ view }: { view: ClockView }): React.ReactElement {
  return (
    <View accessible accessibilityRole="timer" accessibilityLabel={view.label} testID="vocab-speed-clock">
      <Body
        weight="bold"
        style={{ fontSize: typography.size.title, lineHeight: typography.size.title * typography.leading.tight }}
      >
        {view.digits}
      </Body>
    </View>
  );
}

export function ClockBar({ view }: { view: ClockView }): React.ReactElement {
  return (
    <View style={{ gap: spacing.xs }}>
      <View
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        testID="vocab-speed-clock-bar"
        style={{ height: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.surface.sunken, overflow: 'hidden' }}
      >
        <View style={{ width: `${view.fill * 100}%`, height: '100%', borderRadius: radii.pill, backgroundColor: colors.brand.secondary }} />
      </View>
      {view.fewSeconds ? (
        <Caption tone="muted" testID="vocab-speed-few-seconds">
          {view.fewSeconds}
        </Caption>
      ) : null}
    </View>
  );
}

/**
 * Frame G': the question is replaced, so a pause cannot be used to study the answer. Pause unmounts the
 * control that was tapped, so focus moves to Resume (web: the DOM focus; native: the screen reader's) and
 * is never lost; `focusResume` is false while the "Stop for now?" sheet is over the panel, and Keep playing
 * lands on Resume when it closes (§3.8). A change of `focusKey` moves focus there again: the web modal gives
 * focus back to the control that opened it when it finishes closing, so the round bumps it on the sheet's
 * dismiss.
 */
export function PausedPanel({
  copy,
  focusResume,
  focusKey,
  onResume,
  onStop,
}: {
  copy: ChallengeCopy;
  focusResume: boolean;
  focusKey: number;
  onResume: () => void;
  onStop: () => void;
}): React.ReactElement {
  const resumeRef = useRef<View>(null);
  useEffect(() => {
    if (focusResume) focusForScreenReader(resumeRef.current);
  }, [focusResume, focusKey]);
  return (
    <View style={{ alignItems: 'stretch', gap: spacing.md, paddingVertical: spacing.xl }} testID="vocab-speed-paused">
      <Heading level="title" align="center">
        {copy.paused}
      </Heading>
      <Button
        label={copy.resume}
        tone="primary"
        size="lg"
        fullWidth
        onPress={onResume}
        pressableRef={resumeRef}
        testID="vocab-speed-resume"
      />
      <Button label={copy.stop} tone="ghost" size="md" fullWidth onPress={onStop} testID="vocab-speed-paused-stop" />
    </View>
  );
}
