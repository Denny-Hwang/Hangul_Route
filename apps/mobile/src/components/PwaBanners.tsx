import { Body, Button, Caption, Card, colors, layout, spacing } from '@hangul-route/design-system';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../i18n/use-messages';
import { bannerFrame } from '../logic/layout/overlay-frame';
import { applyUpdate, subscribePwa, type PwaEvent } from '../platform/pwa';
import { useUiStore } from '../store/ui-store';

/**
 * Non-modal PWA banners (wireframe pwa/system-banners): offline-ready toast,
 * update-available bar, and an offline chip. Native builds never receive
 * events, so this renders nothing there. Copy is Hoya-toned and never
 * interrupts a quest — the update only applies when the child taps.
 * They sit in a centred `maxWidth.reading` column, clear the side insets, and
 * sit above the tab bar when it shows (F-LAYOUT-001 §3.3, audit UX-26). A screen
 * with no tab bar keeps its primary action at the bottom, so there they hang
 * from the top instead and never cover that CTA (`bannerFrame`).
 */
type Banner = 'offline-ready' | 'update-ready' | null;

export function PwaBanners(): React.ReactElement | null {
  const m = useMessages().learner.pwa;
  const [banner, setBanner] = useState<Banner>(null);
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useUiStore((s) => s.tabBarHeight);
  const frame = bannerFrame({ insets, tabBarHeight, gap: spacing.md, bottomGap: spacing.xl });

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
      style={{ position: 'absolute', left: frame.left, right: frame.right, [frame.edge]: frame.offset, alignItems: 'center' }}
    >
      <View
        pointerEvents="box-none"
        testID="pwa-banners"
        style={{ width: '100%', maxWidth: layout.maxWidth.reading, gap: spacing.sm }}
      >
        {offline ? (
          <View style={{ alignSelf: 'center' }}>
            <Card padding="sm" tone="sunken">
              <Caption tone="muted">{m.offline}</Caption>
            </Card>
          </View>
        ) : null}
        {banner === 'offline-ready' ? (
          <Card padding="md" tone="success">
            <Body weight="semibold">{m.offlineReady}</Body>
          </Card>
        ) : null}
        {banner === 'update-ready' ? (
          <Card padding="md" tone="brand" style={{ borderColor: colors.brand.primary, borderWidth: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Body weight="semibold">{m.update.title}</Body>
                <Caption tone="muted">{m.update.hint}</Caption>
              </View>
              <Button label={m.update.refresh.cta} tone="primary" size="sm" onPress={applyUpdate} />
            </View>
          </Card>
        ) : null}
      </View>
    </View>
  );
}
