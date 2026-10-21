import { Body, Button, Caption, Card, colors, layout, spacing, touchTarget, useLayoutClass } from '@hangul-route/design-system';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../i18n/use-messages';
import { bannerFrame } from '../logic/layout/overlay-frame';
import { OFFLINE_READY_MS, onPwaBanner, visibleBanner, type BannerState, type PwaBanner } from '../logic/pwa/banners';
import { applyUpdate, subscribePwa, type PwaEvent } from '../platform/pwa';
import { useProfileStore } from '../store/profile-store';
import { useUiStore } from '../store/ui-store';

/**
 * Non-modal PWA banners (wireframe pwa/system-banners): offline-ready toast,
 * update-available bar, and an offline chip. Native builds never receive
 * events, so this renders nothing there. Copy is Hoya-toned and never
 * interrupts a quest — the update only applies when the child taps.
 * They sit in a centred `maxWidth.reading` column, clear the side insets, and
 * sit above the tab bar when it shows (F-LAYOUT-001 §3.3, audit UX-26). A screen
 * with no tab bar keeps its primary action at the bottom, so there they hang
 * from the top instead, below the header row ("Leave quest", the PIN pad's
 * close X, Back), and never cover that CTA (`bannerFrame`). The toast and the
 * chip only inform, so they never take a tap: a control under them still
 * works. The update bar waits for a tab screen (wireframe: queued during a
 * quest, a game, results or the PIN pad), so a refresh never lands mid-quest.
 * On a first visit the offline-ready toast waits too: it arrives while the
 * learner reads Welcome and Steps 1 to 3, so it is held until the first Home
 * and shown there once, for four seconds (`logic/pwa/banners`).
 */
type Banner = PwaBanner | null;

export function PwaBanners(): React.ReactElement | null {
  const m = useMessages().learner.pwa;
  const [state, setState] = useState<BannerState>({ banner: null, waitForHome: false });
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useUiStore((s) => s.tabBarHeight);
  const { width: widthClass } = useLayoutClass();
  // The header row of a screen with no tab bar: Screen's top gutter plus one touch target.
  const headerClearance = layout.gutter[widthClass] + touchTarget.min;
  const frame = bannerFrame({ insets, tabBarHeight, gap: spacing.md, bottomGap: spacing.xl, headerClearance });
  const onTabScreen = tabBarHeight > 0;
  const hasProfile = useProfileStore((s) => s.profiles.length > 0);

  useEffect(() => {
    const off = subscribePwa((event: PwaEvent) => {
      if (event === 'offline-ready' || event === 'update-ready') {
        // Read when the event arrives: a toast that comes before any profile waits for the first Home.
        const profileNow = useProfileStore.getState().profiles.length > 0;
        setState((prev) => onPwaBanner(prev, event, { hasProfile: profileNow }));
      } else if (event === 'went-offline') setOffline(true);
      else if (event === 'back-online') setOffline(false);
    });
    return off;
  }, []);

  // The update bar stays queued until a tab screen shows; a first-visit toast until the first Home.
  const shown: Banner = visibleBanner(state, { hasProfile, onTabScreen });

  // The toast's four seconds start when it shows, not when it was queued.
  useEffect(() => {
    if (shown !== 'offline-ready') return;
    const id = setTimeout(() => setState((prev) => (prev.banner === 'offline-ready' ? { banner: null, waitForHome: false } : prev)), OFFLINE_READY_MS);
    return () => clearTimeout(id);
  }, [shown]);

  if (!shown && !offline) return null;

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
          <View pointerEvents="none" style={{ alignSelf: 'center' }}>
            <Card padding="sm" tone="sunken">
              <Caption tone="muted">{m.offline}</Caption>
            </Card>
          </View>
        ) : null}
        {shown === 'offline-ready' ? (
          <View pointerEvents="none">
            <Card padding="md" tone="success">
              <Body weight="semibold">{m.offlineReady}</Body>
            </Card>
          </View>
        ) : null}
        {shown === 'update-ready' ? (
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
