import type { RomanizationChoice } from '@hangul-route/content-schema';
import {
  Body,
  Caption,
  Card,
  Heading,
  Spacer,
  borderWidth,
  colors,
  pressTransform,
  radii,
  spacing,
  touchTarget,
  typography,
  usePressLook,
  useTypeScale,
} from '@hangul-route/design-system';
import { useRef } from 'react';
import type { ReactElement } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useMessages } from '../i18n/use-messages';
import { romanizationChoiceOf } from '../logic/locale/romanization-mode';
import { READING_CHOICES, readingChoiceForKey } from '../logic/locale/reading-practice-keys';
import { useLocaleStore } from '../store/locale-store';

/**
 * "Reading practice" card on profile/settings (AMENDMENTS-ROMANIZATION-FADE section 3.10, mock
 * `design/screens/profile/reading-practice.md` Panel A; F-I18N-001 section 3.3, decision D2): the per-profile choice of how
 * romanization shows, as three radios, **As I learn** (`auto`), **Always** and **Only when I tap**. It shows the stored
 * choice, never the resolved mode and never an All lessons override. A choice is stored at once (display only,
 * reversible), not behind the grown-up gate.
 *
 * Look: LessonDisplaySheet's radio (a 24 ring with a 12 dot) on the label's first line, the checked label semibold, the
 * hint in `Caption` under As I learn only and the radio's accessible description (the name is the label alone). On the web
 * the group has one Tab stop and the arrows, Home and End move focus and the choice (RF-0b Q3); on native no `tabIndex` and
 * no key handler, so every row stays focusable and pressable (React Native maps `tabIndex={-1}` to `focusable={false}` on
 * Android, as DisplaySheet's DN-2b fix recorded).
 */
export interface ReadingPracticeCardProps {
  profileId: string;
}

const RING = spacing.xl;
const DOT = spacing.md;
const LABEL_ID = 'reading-practice-label';
const hintId = (choice: RomanizationChoice): string => `reading-practice-hint-${choice}`;

type Focusable = { focus?: () => void } | null;

export function ReadingPracticeCard({ profileId }: ReadingPracticeCardProps): ReactElement {
  const m = useMessages().learner.profile.reading;
  const settings = useLocaleStore((s) => s.byProfile[profileId]);
  const setChoice = useLocaleStore((s) => s.setRomanizationChoice);
  const press = usePressLook();
  const bodySize = useTypeScale().size.body;
  const refs = useRef(new Map<RomanizationChoice, Focusable>());
  // This card edits the profile's stored setting, so it shows that value and never an All lessons override.
  const choice = romanizationChoiceOf(settings);
  const web = Platform.OS === 'web';
  const labels: Record<RomanizationChoice, string> = { auto: m.auto.label, always: m.always.label, tap: m.tap.label };
  // The ring sits in a slot one label line high, so it stays on the label's first line when a label or the hint wraps.
  const lineHeight = bodySize * typography.leading.normal;

  const onKey = (row: RomanizationChoice) => (event: { key: string; preventDefault?: () => void }): void => {
    const next = readingChoiceForKey(row, event.key);
    if (next === null) return;
    // Arrows and Home / End never scroll in a radio group; Space does, so it is the one the handler holds back.
    event.preventDefault?.();
    if (next !== choice) setChoice(profileId, next);
    refs.current.get(next)?.focus?.();
  };

  return (
    <Card padding="md" testID="reading-practice-card">
      <Heading level="prompt">{m.title}</Heading>
      <Spacer size="xs" />
      <View nativeID={LABEL_ID}>
        <Body tone="secondary">{m.groupLabel}</Body>
      </View>
      <Spacer size="sm" />
      <View role="radiogroup" aria-labelledby={LABEL_ID} accessibilityLabel={m.groupLabel} testID="reading-practice-group">
        {READING_CHOICES.map((value) => {
          const checked = choice === value;
          const hint = value === 'auto' ? m.auto.hint : undefined;
          return (
            <Pressable
              key={value}
              ref={(node: unknown) => {
                refs.current.set(value, node as Focusable);
              }}
              role="radio"
              accessibilityRole="radio"
              aria-checked={checked}
              accessibilityState={{ checked }}
              accessibilityLabel={labels[value]}
              {...(hint === undefined ? {} : { accessibilityHint: hint, 'aria-describedby': hintId(value) })}
              {...(web ? { tabIndex: checked ? 0 : -1, onKeyDown: onKey(value) } : {})}
              testID={`reading-practice-${value}`}
              onPress={() => setChoice(profileId, value)}
              style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => ({
                minHeight: touchTarget.min,
                justifyContent: 'center',
                paddingHorizontal: spacing.xs,
                borderRadius: radii.md,
                // The press look wins while a finger is down (a web tap focuses the row too); the focus ring shows after.
                borderWidth: pressed ? press.borderWidth : borderWidth.thick,
                borderColor: pressed ? press.borderColor : focused === true ? colors.border.focus : 'transparent',
              })}
            >
              {({ pressed }: { pressed: boolean }) => (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, transform: pressTransform(pressed ? press : null) }}>
                  <View style={{ height: lineHeight, justifyContent: 'center' }}>
                    <View
                      style={{
                        width: RING,
                        height: RING,
                        borderRadius: radii.circle,
                        borderWidth: borderWidth.base,
                        borderColor: colors.text.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {checked ? <View style={{ width: DOT, height: DOT, borderRadius: radii.circle, backgroundColor: colors.text.primary }} /> : null}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Body weight={checked ? 'semibold' : 'regular'}>{labels[value]}</Body>
                    {hint === undefined ? null : (
                      <View nativeID={hintId(value)}>
                        <Caption tone="muted">{hint}</Caption>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
