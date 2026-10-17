import { Body, Card, Heading, Pill, Spacer, spacing, touchTarget } from '@hangul-route/design-system';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useMessages } from '../i18n/use-messages';
import { resolveRomanizationMode } from '../logic/locale/romanization-mode';
import { useLocaleStore } from '../store/locale-store';

/**
 * "Reading practice" card on profile/settings (F-I18N-001 §3.3, decision D2): the per-profile
 * switch that hides romanization until a tap. It was the lower half of the Language card; the
 * UI language is now one per device and lives on the Display sheet (owner items 6 and 7), so
 * this card holds the reading switch alone. Not behind the grown-up gate (display only).
 */
export interface ReadingPracticeCardProps {
  profileId: string;
}

export function ReadingPracticeCard({ profileId }: ReadingPracticeCardProps): React.ReactElement {
  const m = useMessages().learner.profile;
  const settings = useLocaleStore((s) => s.byProfile[profileId]);
  const setRomanizationMode = useLocaleStore((s) => s.setRomanizationMode);
  // This card edits the profile's stored setting, so it shows that value and never an All lessons override.
  const tapMode = resolveRomanizationMode(null, settings) === 'tap';

  return (
    <Card padding="md" testID="reading-practice-card">
      <Heading level="prompt">{m.reading.title}</Heading>
      <Spacer size="xs" />
      <Pressable
        testID="reading-practice-switch"
        onPress={() => setRomanizationMode(profileId, tapMode ? 'always' : 'tap')}
        accessibilityRole="switch"
        accessibilityState={{ checked: tapMode }}
        // RN-web drops `aria-checked` when it is false; a switch must always say its state.
        aria-checked={tapMode}
        accessibilityLabel={m.reading.hideUntilTap}
        style={{ minHeight: touchTarget.min, justifyContent: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <Body style={{ flex: 1 }}>{m.reading.hideUntilTap}</Body>
          <Pill tone={tapMode ? 'success' : 'neutral'} label={tapMode ? m.reading.on : m.reading.off} size="sm" />
        </View>
      </Pressable>
    </Card>
  );
}
