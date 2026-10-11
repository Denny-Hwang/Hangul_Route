import { Body, Button, Caption, borderWidth, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { CREATE_PROFILE_COPY } from '../logic/onboarding/create-profile-copy';
import {
  PIN_SETUP_MISMATCH,
  pinSetupChange,
  pinSetupRedo,
  type PinSetupState,
} from '../logic/onboarding/pin-setup';
import { PIN_LENGTH } from '../logic/profiles/pin-hash';
import { pinPadLayout } from '../logic/profiles/pin-pad-layout';
import { PIN_PAD_GAP, PinPad } from './PinPad';

const DOT_SIZE = spacing.lg + spacing.xs;
/** The web build centres a 480 dp column on wide screens (pwa-postbuild). */
const WEB_COLUMN_MAX = 480;

interface PinSetupFieldProps {
  /** "Create a grown-up PIN" (family) or "Create a PIN" (self). */
  heading: string;
  state: PinSetupState;
  onChange: (next: PinSetupState) => void;
  /** Shown under the pad, calm, when the PIN could not be hashed (§3.13). */
  error?: string | null;
  /** Keys stop responding while Continue is working. */
  disabled?: boolean;
}

/**
 * The create-and-confirm PIN field inside the first-run card (F-LEARN-001 §3.4):
 * the key grid of `PinEntryScreen` (`PinPad`), dots only, 4 digits entered
 * twice. The card scrolls, so the pad uses the 64 dp floor (a 3-column grid)
 * instead of the height budget of the full-screen PIN screen. A mismatch is a
 * calm amber line, never red. Design reference:
 * design/wireframes/onboarding/all-ages-onboarding.md, section D.
 */
export function PinSetupField({ heading, state, onChange, error = null, disabled = false }: PinSetupFieldProps): React.ReactElement {
  const screen = useWindowDimensions();
  // The card's padding comes off both sides of the screen padding until it is measured.
  const [width, setWidth] = useState(() => Math.min(screen.width, WEB_COLUMN_MAX) - 4 * spacing.lg);
  const layout = pinPadLayout({
    width,
    height: Number.POSITIVE_INFINITY,
    minKey: touchTarget.min,
    maxKey: touchTarget.min,
    gap: PIN_PAD_GAP,
  });

  if (state.stage === 'set') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget.min }}>
        <View style={{ flex: 1 }}>
          <Body weight="semibold" size="sm">
            {CREATE_PROFILE_COPY.pin.set}
          </Body>
        </View>
        <Button label={CREATE_PROFILE_COPY.pin.change} tone="ghost" size="md" onPress={() => onChange(pinSetupRedo())} />
      </View>
    );
  }

  const title = state.stage === 'create' ? heading : CREATE_PROFILE_COPY.pin.again;
  return (
    <View>
      <Body weight="semibold" size="sm">
        {title}
      </Body>
      <View
        accessibilityLabel={`${state.entry.length} of ${PIN_LENGTH} digits entered`}
        style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginVertical: spacing.md }}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: radii.circle,
              borderWidth: borderWidth.base,
              borderColor: colors.brand.primary,
              backgroundColor: i < state.entry.length ? colors.brand.primary : colors.surface.paper,
            }}
          />
        ))}
      </View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ alignItems: 'center' }}>
        <PinPad
          value={state.entry}
          onChange={(next) => onChange(pinSetupChange(state, next))}
          disabled={disabled}
          layout={layout}
          testID="onboarding-pin-pad"
        />
      </View>
      {state.mismatch ? (
        <View
          accessibilityLiveRegion="polite"
          style={{
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radii.md,
            borderWidth: borderWidth.base,
            borderColor: colors.feedback.nudge,
            backgroundColor: colors.feedback.nudgeLight,
          }}
        >
          <Caption>{PIN_SETUP_MISMATCH}</Caption>
        </View>
      ) : null}
      {error ? (
        <View accessibilityLiveRegion="polite" style={{ marginTop: spacing.md }}>
          <Caption tone="secondary">{error}</Caption>
        </View>
      ) : null}
    </View>
  );
}
