import { Body, Caption, Card, colors, spacing, touchTarget } from '@hangul-route/design-system';
import React, { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { flags } from '../../config/flags';
import { useMessages } from '../../i18n/use-messages';
import { shortcutSwitch } from '../../logic/profiles/biometric-shortcut';
import { needsFreshPin } from '../../logic/profiles/session';
import { useAccountStore } from '../../store/account-store';
import { useUiStore } from '../../store/ui-store';
import { useBiometricAvailable } from './use-biometric-available';

/**
 * [OA] Face or fingerprint for grown-ups (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D10, sections 8.2 and 8.6, row OA-9;
 * mock `design/screens/profiles/people-on-device.md`, decision D18): a switch card in the Grown-up area, native
 * builds with strong face or fingerprint only (`EXPO_PUBLIC_BIOMETRIC_SHORTCUT` off hides it). Off on every device
 * until a grown-up turns it on (OQ-6). The warning is the switch's hint, so it is read before turning it on.
 *
 * - On needs a PIN entered in the last 2 minutes (`needsFreshPin`); otherwise the PIN screen asks first
 *   (destination `BiometricShortcut`) and turns it on after the PIN.
 * - Off turns it off at once and deletes the item.
 * - With no PIN the switch is disabled and the hint reads `needsPinFirst` (section 8.2).
 */
export function BiometricShortcutCard({ onNeedPin }: { onNeedPin: () => void }): React.ReactElement | null {
  const m = useMessages().caregiver.pin;
  const record = useAccountStore((s) => s.biometricShortcut);
  const pinSetAt = useAccountStore((s) => s.pinSetAt);
  const hasPin = useAccountStore((s) => s.parentPinHash !== null);
  const enable = useAccountStore((s) => s.enableBiometricShortcut);
  const disable = useAccountStore((s) => s.disableBiometricShortcut);
  const available = useBiometricAvailable();
  const [busy, setBusy] = useState(false);

  const state = shortcutSwitch({ flagOn: flags.biometricShortcutEnabled, available, record, pinSetAt, hasPin });
  if (state === 'hidden') return null;

  const on = state === 'on';
  const disabled = state === 'needsPin' || busy;
  const hint = state === 'needsPin' ? m.needsPinFirst : m.biometric.warning;

  const toggle = (next: boolean): void => {
    if (disabled) return;
    if (!next) {
      disable('user');
      return;
    }
    if (needsFreshPin('biometric_on', useUiStore.getState().lastPinVerifiedAt, Date.now())) {
      onNeedPin();
      return;
    }
    setBusy(true);
    void enable(m.biometric.cta).finally(() => setBusy(false));
  };

  return (
    <Card padding="md" style={{ marginBottom: spacing.lg }} testID="dashboard-biometric">
      {/* The whole row is the target (at least 64); the label names the switch and the hint describes it. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget.min }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => toggle(!on)}
          disabled={disabled}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Body weight="semibold">{m.biometric.toggle}</Body>
          <Caption tone="secondary" testID="dashboard-biometric-hint">
            {hint}
          </Caption>
        </Pressable>
        <Switch
          testID="dashboard-biometric-switch"
          value={on}
          disabled={disabled}
          onValueChange={toggle}
          accessibilityLabel={m.biometric.toggle}
          accessibilityHint={hint}
          trackColor={{ true: colors.brand.primary, false: colors.border.shape }}
          ios_backgroundColor={colors.border.shape}
          thumbColor={colors.surface.paper}
        />
      </View>
    </Card>
  );
}
