import { Body, Button, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import type { BrowseTarget } from '@hangul-route/content-schema';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { gateLessonsStep } from '../../logic/browse/gate-entry';
import type { RootStackParamList } from '../../navigation/types';
import { openBrowseFromGate } from '../../platform/browse-handoff';
import { gateOpensDirectlyNow } from '../../store/gate-now';
import { passGate } from '../../store/gate-telemetry';

/**
 * The learner app's ways into All lessons, behind the grown-up gate (F-BROWSE-001 sections 4.3 and 4.11, BR-12a).
 * Web only (section 4.14): off web it draws nothing.
 *
 * - `kind="open"`: [ Open all lessons ] at the end of the parent dashboard (wireframe
 *   `design/wireframes/browse/entry-points.md` panel 6), a full-width secondary button; no target, so All lessons
 *   opens on its home.
 * - `kind="preview"`: [ Preview lessons ] with a stage target, the LR-D link-button (`touchTarget.min` tall, pill,
 *   `border.strong` outline on paper): under each stage row of the grown-up read-only Learning Route page (the slot
 *   of `design/screens/learning-route/stage-list.md`, drawn in `mock/stage-list-family.html`) and at the end of the
 *   in-app report's What to practice next section (`design/screens/reports/in-app-report.md`).
 *
 * These pages stay open after the 15-minute grown-up session ends, so each press asks the gate again
 * (`gateOpensDirectlyNow`, as See report and the grown-up home do). Open: `openBrowseFromGate(target)` writes the gate
 * pass and leaves in the same tab. Closed: the PIN screen for All lessons (`PinEntry { next: 'BrowseLessons' }`,
 * the same target), and nothing is written until a correct PIN. When the browser refuses this tab's storage it stays
 * here and says so under the control (section 4.3 item 4's line); `initialBlocked` shows that line on arrival, when
 * the PIN screen's hand-off was the one refused.
 */
export function GateLessonsButton({
  kind,
  target,
  testID,
  initialBlocked = false,
}: {
  kind: 'open' | 'preview';
  target?: BrowseTarget;
  testID: string;
  initialBlocked?: boolean;
}): React.ReactElement | null {
  const m = useMessages().caregiver.dashboard.browse;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [blocked, setBlocked] = useState(initialBlocked);
  if (Platform.OS !== 'web') return null;

  const open = (): void => {
    if (gateLessonsStep(passGate('BrowseLessons', gateOpensDirectlyNow())) === 'pin') {
      navigation.navigate('PinEntry', target === undefined ? { next: 'BrowseLessons' } : { next: 'BrowseLessons', browseTarget: target });
      return;
    }
    setBlocked(!openBrowseFromGate(target));
  };
  const label = kind === 'open' ? m.open.cta : m.preview.cta;

  return (
    <View style={{ gap: spacing.xs }}>
      {/* An outline button: on the dashboard See report is each learner's one filled button (owner request 2026-10-16, item 8). */}
      {kind === 'open' ? (
        <Button label={label} tone="ghost" size="md" fullWidth onPress={open} testID={testID} />
      ) : (
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={label}
          testID={testID}
          style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => ({
            minHeight: touchTarget.min,
            minWidth: touchTarget.min,
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.lg,
            borderRadius: radii.pill,
            borderWidth: borderWidth.base,
            borderColor: pressed || focused ? colors.border.focus : colors.border.strong,
            backgroundColor: colors.surface.paper,
          })}
        >
          <Body weight="bold">{label}</Body>
        </Pressable>
      )}
      <View accessibilityLiveRegion="polite" {...{ 'aria-live': 'polite' }}>
        {blocked ? (
          <Body size="sm" tone="secondary" testID={`${testID}-blocked`}>
            {m.storageBlocked}
          </Body>
        ) : null}
      </View>
    </View>
  );
}
