import { Body, Button, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import type { BrowseTarget } from '@hangul-route/content-schema';
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { openBrowseFromGate } from '../../platform/browse-handoff';

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
 * Each press calls `openBrowseFromGate(target)`, which writes the gate pass and leaves in the same tab. When the
 * browser refuses this tab's storage it stays here and says so under the control (the console's line).
 */
export function GateLessonsButton({ kind, target, testID }: { kind: 'open' | 'preview'; target?: BrowseTarget; testID: string }): React.ReactElement | null {
  const m = useMessages().caregiver.dashboard.browse;
  const [blocked, setBlocked] = useState(false);
  if (Platform.OS !== 'web') return null;

  const open = (): void => {
    setBlocked(!openBrowseFromGate(target));
  };
  const label = kind === 'open' ? m.open.cta : m.preview.cta;

  return (
    <View style={{ gap: spacing.xs }}>
      {kind === 'open' ? (
        <Button label={label} tone="secondary" size="md" fullWidth onPress={open} testID={testID} />
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
