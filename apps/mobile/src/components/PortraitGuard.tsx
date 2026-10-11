import { Button, Heading, Hoya, colors, layoutClassFor, spacing, useLayoutClass, z } from '@hangul-route/design-system';
import type { FormFactor } from '@hangul-route/design-system';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../i18n/use-messages';
import { guardLockAction, guardTransition, isPhoneDevice, shouldShowPortraitGuard, type GuardInput } from '../logic/layout/orientation-guard';
import {
  coarsePointer,
  currentPath,
  deviceOrientation,
  deviceScreen,
  editingText,
  subscribeDeviceOrientation,
  tryLockPortrait,
  unlock,
} from '../platform/orientation';
import { isStandalone } from '../platform/pwa';
import { track } from '../platform/telemetry';
import { useLayoutStore } from '../store/layout-store';
import { useLayoutObserved } from './use-layout-observed';

/**
 * The soft portrait guard (F-LAYOUT-001 §3.4, LD5). A touch phone held
 * sideways sees Hoya and one line, "Turn your phone upright", over the whole
 * window, with a way out: "Keep sideways" removes it and is remembered on this
 * device (`device:layout`); turning the phone upright removes it for the rest
 * of the session. Never on a tablet, with a mouse, while typing, or on the
 * presenter route. "Phone" and "on its side" come from the device (its screen
 * and orientation), not the window: a soft keyboard makes an upright phone's
 * window wider than tall, and a zoomed or windowed tablet has a phone-sized window.
 * An installed phone app also tries a runtime portrait lock, so the guard
 * rarely shows there; on iPhone (no lock API) the guard is the mechanism.
 * Also reports `layout.observed` once a session (§3.13).
 * Design reference: design/wireframes/layout/wide.md, panel E.
 */
/** The form of the physical screen (the same phone rule as the window), null when unknown. */
function screenForm(): FormFactor | null {
  const screen = deviceScreen();
  return screen ? layoutClassFor(screen).form : null;
}

export function PortraitGuard(): React.ReactElement | null {
  const layoutClass = useLayoutClass();
  const insets = useSafeAreaInsets();
  const messages = useMessages();
  const copy = messages.learner.portraitGuard;
  const hydrated = useLayoutStore((s) => s.hydrated);
  const allowedSideways = useLayoutStore((s) => s.allowedSideways);
  const allowSideways = useLayoutStore((s) => s.allowSideways);
  // The pointer type of a device does not change while the app runs (a hybrid's tablet mode shows on the next open).
  const [coarse] = useState(coarsePointer);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const wasShowing = useRef(false);
  const dialog = useRef<View>(null);
  // A turn of the device re-renders even when the window size has not caught up yet.
  const [, setTurns] = useState(0);
  useEffect(() => subscribeDeviceOrientation(() => setTurns((n) => n + 1)), []);

  useLayoutObserved(layoutClass);

  const input: GuardInput = {
    layout: layoutClass,
    device: { screenForm: screenForm(), orientation: deviceOrientation() },
    coarsePointer: coarse,
    route: currentPath(),
    allowedSideways,
    dismissedThisSession,
    editingText: editingText(),
  };
  // Nothing shows until `device:layout` is read, so a learner who said "Keep sideways" never sees a flash.
  const show = hydrated && shouldShowPortraitGuard(input);
  const latest = useRef(input);
  latest.current = input;

  useEffect(() => {
    const step = guardTransition({ wasShowing: wasShowing.current, show, input: latest.current });
    wasShowing.current = show;
    if (step.emit === 'shown') void track({ name: 'layout.guard_shown', payload: { standalone: isStandalone() } });
    if (step.emit === 'rotated') void track({ name: 'layout.guard_dismissed', payload: { via: 'rotated' } });
    if (step.dismissedThisSession) setDismissedThisSession(true);
    // Move focus into the guard so a screen reader or keyboard starts there, not on the screen under it.
    if (show) dialog.current?.focus?.();
  }, [show]);

  // Best-effort runtime lock for an installed phone app; tablets and "Keep sideways" are unlocked.
  const knownSize = layoutClass.windowWidth > 0 && layoutClass.windowHeight > 0;
  const phone = isPhoneDevice(layoutClass, input.device.screenForm);
  useEffect(() => {
    const action = guardLockAction({ hydrated, knownSize, phone, allowedSideways });
    if (action === 'lock') void tryLockPortrait('phone');
    else if (action === 'unlock') unlock();
  }, [hydrated, knownSize, phone, allowedSideways]);

  if (!show) return null;

  const keepSideways = (): void => {
    allowSideways();
    unlock();
    void track({ name: 'layout.guard_dismissed', payload: { via: 'keep_sideways' } });
  };

  return (
    <View
      ref={dialog}
      testID="portrait-guard"
      role="dialog"
      aria-modal
      aria-label={copy.title}
      accessibilityViewIsModal
      focusable
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: z.modal,
        backgroundColor: colors.surface.canvas,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.lg,
        paddingTop: insets.top + spacing.lg,
        paddingRight: insets.right + spacing.lg,
        paddingBottom: insets.bottom + spacing.lg,
        paddingLeft: insets.left + spacing.lg,
      }}
    >
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Hoya pose="thinking" size={96} accessibilityLabel={messages.a11y.hoya('thinking')} />
        <Heading level="title" align="center">
          {copy.title}
        </Heading>
      </View>
      <View style={{ alignSelf: 'center' }}>
        <Button label={copy.keepSideways.cta} tone="secondary" size="md" onPress={keepSideways} testID="portrait-guard-keep-sideways" />
      </View>
    </View>
  );
}
