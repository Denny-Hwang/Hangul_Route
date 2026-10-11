import { Body, Button, Caption, Card, Heading, Hoya, Icon, colors, radii, spacing, touchTarget } from '@hangul-route/design-system';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { overlayFrame } from '../logic/layout/overlay-frame';
import { installGuideVariant, shouldShowInstallGuide, type InstallGuideVariant } from '../logic/pwa/install-guide';
import { appUrl, copyText, installEnv, isOfflineReady, promptInstall } from '../platform/pwa';
import { useAudience } from '../store/audience';
import { usePwaStore } from '../store/pwa-store';

/**
 * Install guide bottom sheet — F-PWA-001 §3.1, wireframe pwa/install-guide.
 * Renders nothing on native and when the rules say no. Home stays tappable
 * underneath (no backdrop that swallows taps; a tap outside dismisses).
 * The card sits in a centred `maxWidth.reading` column and clears the side
 * insets (F-LAYOUT-001 §3.3). Home is a tab screen: its scene already ends at
 * the top of the tab bar, which owns the bottom inset, so the sheet adds no
 * bottom inset of its own.
 */
export interface InstallGuideSheetProps {
  /** The URL to copy for the in-app-browser fallback. */
  shareUrl?: string;
}

export function InstallGuideSheet({ shareUrl }: InstallGuideSheetProps): React.ReactElement | null {
  const { copy } = useAudience();
  const visits = usePwaStore((s) => s.visits);
  const snoozedUntilVisit = usePwaStore((s) => s.snoozedUntilVisit);
  const installed = usePwaStore((s) => s.installed);
  const forced = usePwaStore((s) => s.forced);
  const hydrated = usePwaStore((s) => s.hydrated);
  const dismiss = usePwaStore((s) => s.dismiss);
  const markInstalled = usePwaStore((s) => s.markInstalled);
  const [copied, setCopied] = useState(false);
  const insets = useSafeAreaInsets();
  const [promptTick, setPromptTick] = useState(0);

  // The browser may hand us the install prompt after first paint.
  useEffect(() => {
    const w = globalThis as unknown as Window | undefined;
    if (!w || typeof w.addEventListener !== 'function') return;
    const bump = (): void => setPromptTick((t) => t + 1);
    w.addEventListener('hr:install-available', bump);
    return () => w.removeEventListener('hr:install-available', bump);
  }, []);

  const variant: InstallGuideVariant = useMemo(() => installGuideVariant(installEnv()), [promptTick]);
  const visible =
    hydrated &&
    shouldShowInstallGuide({
      variant,
      offlineReady: isOfflineReady(),
      visits,
      snoozedUntilVisit,
      installed,
      forced,
    });

  if (!visible) return null;

  const frame = overlayFrame({ insets: { ...insets, bottom: 0 }, tabBarHeight: 0, gap: spacing.md });

  const onInstall = async (): Promise<void> => {
    const accepted = await promptInstall();
    if (accepted) markInstalled();
    else dismiss();
  };

  const onCopy = async (): Promise<void> => {
    setCopied(await copyText(shareUrl ?? appUrl()));
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: spacing.md,
        paddingLeft: frame.left,
        paddingRight: frame.right,
        paddingBottom: frame.bottom,
        alignItems: 'center',
      }}
      testID="install-guide"
    >
      <View pointerEvents="box-none" testID="install-guide-column" style={{ width: '100%', maxWidth: frame.maxWidth }}>
        <Card padding="md" tone="paper" style={{ borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radii.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
            <Hoya pose="waving" size={56} />
            <View style={{ flex: 1 }}>
              <Heading level="prompt">{copy.installGuideLine}</Heading>
              {copy.installGuideHelp ? <Caption tone="secondary">{copy.installGuideHelp}</Caption> : null}
              <Caption tone="muted">Then Hangul Route opens like an app and your cards stay safe, even without Wi-Fi.</Caption>
            </View>
            <Pressable
              onPress={dismiss}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ minWidth: touchTarget.min, minHeight: touchTarget.min, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="close" size={22} color={colors.text.muted} />
            </Pressable>
          </View>

          <View style={{ marginTop: spacing.md }}>
            {variant === 'ios-safari' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Step icon="arrow-right" label="Tap Share" />
                <Icon name="arrow-right" size={16} color={colors.text.muted} />
                <Step icon="plus" label="Add to Home Screen" />
              </View>
            ) : null}
            {variant === 'prompt' ? (
              <Button label="Install" tone="primary" size="lg" fullWidth onPress={() => void onInstall()} />
            ) : null}
            {variant === 'desktop-hint' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Step icon="home" label="Browser menu" />
                <Icon name="arrow-right" size={16} color={colors.text.muted} />
                <Step icon="plus" label="Install app / Add to Home screen" />
              </View>
            ) : null}
            {variant === 'in-app-browser' ? (
              <View style={{ gap: spacing.sm }}>
                <Body size="sm">Open this page in Safari or Chrome first.</Body>
                <Button
                  label={copied ? 'Link copied' : 'Copy link'}
                  tone="secondary"
                  size="md"
                  onPress={() => void onCopy()}
                />
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: spacing.sm, alignItems: 'flex-end' }}>
            <Button label="Not now" tone="ghost" size="sm" onPress={dismiss} />
          </View>
        </Card>
      </View>
    </View>
  );
}

function Step({ icon, label }: { icon: 'arrow-right' | 'plus' | 'home'; label: string }): React.ReactElement {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radii.pill,
        backgroundColor: colors.surface.sunken,
      }}
    >
      <Icon name={icon} size={16} color={colors.brand.primary} />
      <Caption tone="secondary">{label}</Caption>
    </View>
  );
}
