import { Button, Heading, Hoya, colors, spacing, useLayoutClass, z } from '@hangul-route/design-system';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../i18n/use-messages';
import { guardDismissal, shouldShowPortraitGuard } from '../logic/layout/orientation-guard';
import { coarsePointer, currentPath, tryLockPortrait, unlock } from '../platform/orientation';
import { isStandalone } from '../platform/pwa';
import { track } from '../platform/telemetry';
import { useLayoutStore } from '../store/layout-store';
import { useLayoutObserved } from './use-layout-observed';

/**
 * The soft portrait guard (F-LAYOUT-001 §3.4, LD5). A touch phone held
 * sideways sees Hoya and one line, "Turn your phone upright", over the whole
 * window, with a way out: "Keep sideways" removes it and is remembered on this
 * device (`device:layout`); turning the phone upright removes it for the rest
 * of the session. Never on a tablet, with a mouse, or on the presenter route.
 * An installed phone app also tries a runtime portrait lock, so the guard
 * rarely shows there; on iPhone (no lock API) the guard is the mechanism.
 * Also reports `layout.observed` once a session (§3.13).
 * Design reference: design/wireframes/layout/wide.md, panel E.
 */
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

  useLayoutObserved(layoutClass);

  // Nothing shows until `device:layout` is read, so a learner who said "Keep sideways" never sees a flash.
  const show =
    hydrated &&
    shouldShowPortraitGuard({
      layout: layoutClass,
      coarsePointer: coarse,
      route: currentPath(),
      allowedSideways,
      dismissedThisSession,
    });

  useEffect(() => {
    if (show && !wasShowing.current) {
      void track({ name: 'layout.guard_shown', payload: { standalone: isStandalone() } });
    } else if (!show && wasShowing.current && guardDismissal({ wasShowing: true, layout: layoutClass }) === 'rotated') {
      setDismissedThisSession(true);
      void track({ name: 'layout.guard_dismissed', payload: { via: 'rotated' } });
    }
    wasShowing.current = show;
  }, [show, layoutClass]);

  // Best-effort runtime lock for an installed phone app; tablets and "Keep sideways" are unlocked.
  const knownSize = layoutClass.windowWidth > 0 && layoutClass.windowHeight > 0;
  useEffect(() => {
    if (!hydrated || !knownSize) return;
    if (layoutClass.form === 'phone' && !allowedSideways) void tryLockPortrait(layoutClass.form);
    else unlock();
  }, [hydrated, knownSize, layoutClass.form, allowedSideways]);

  if (!show) return null;

  const keepSideways = (): void => {
    allowSideways();
    unlock();
    void track({ name: 'layout.guard_dismissed', payload: { via: 'keep_sideways' } });
  };

  return (
    <View
      testID="portrait-guard"
      accessibilityViewIsModal
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
      <View role="status" accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: spacing.md }}>
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
