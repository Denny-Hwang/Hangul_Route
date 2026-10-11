import { Body, Button, Caption, Card, colors, spacing } from '@hangul-route/design-system';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { overlayFrame } from '../logic/layout/overlay-frame';
import { applyUpdate, subscribePwa, type PwaEvent } from '../platform/pwa';
import { useUiStore } from '../store/ui-store';

/**
 * Non-modal PWA banners (wireframe pwa/system-banners): offline-ready toast,
 * update-available bar, and an offline chip. Native builds never receive
 * events, so this renders nothing there. Copy is Hoya-toned and never
 * interrupts a quest — the update only applies when the child taps.
 * They sit in a centred `maxWidth.reading` column, clear the side insets, and
 * sit above the home indicator, or above the tab bar when it shows
 * (F-LAYOUT-001 §3.3, audit UX-26).
 */
type Banner = 'offline-ready' | 'update-ready' | null;

export function PwaBanners(): React.ReactElement | null {
  const [banner, setBanner] = useState<Banner>(null);
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useUiStore((s) => s.tabBarHeight);
  const frame = overlayFrame({ insets, tabBarHeight, gap: spacing.md });

  useEffect(() => {
    const off = subscribePwa((event: PwaEvent) => {
      if (event === 'offline-ready') setBanner('offline-ready');
      else if (event === 'update-ready') setBanner('update-ready');
      else if (event === 'went-offline') setOffline(true);
      else if (event === 'back-online') setOffline(false);
    });
    return off;
  }, []);

  useEffect(() => {
    if (banner !== 'offline-ready') return;
    const id = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(id);
  }, [banner]);

  if (!banner && !offline) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: frame.left, right: frame.right, bottom: frame.bottom, alignItems: 'center' }}
    >
      <View pointerEvents="box-none" testID="pwa-banners" style={{ width: '100%', maxWidth: frame.maxWidth, gap: spacing.sm }}>
        {offline ? (
          <View style={{ alignSelf: 'center' }}>
            <Card padding="sm" tone="sunken">
              <Caption tone="muted">Offline — everything still works</Caption>
            </Card>
          </View>
        ) : null}
        {banner === 'offline-ready' ? (
          <Card padding="md" tone="success">
            <Body weight="semibold">All set! You can play without Wi-Fi now.</Body>
          </Card>
        ) : null}
        {banner === 'update-ready' ? (
          <Card padding="md" tone="brand" style={{ borderColor: colors.brand.primary, borderWidth: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Body weight="semibold">New lessons are ready.</Body>
                <Caption tone="muted">Tap when you finish what you are doing.</Caption>
              </View>
              <Button label="Refresh" tone="primary" size="sm" onPress={applyUpdate} />
            </View>
          </Card>
        ) : null}
      </View>
    </View>
  );
}
