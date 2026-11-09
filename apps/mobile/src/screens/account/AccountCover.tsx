import { colors } from '@hangul-route/design-system';
import type { ReactElement } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import splash from '../../../assets/splash.png';

/**
 * F-AUTH-004 section 7.4, design D12 and `lock.md` boards 16 and 17 (row NS-4; CS-N12): the JavaScript cover over an
 * account screen. It draws the app's own splash (`app.json` `splash.image`, contain, on `splash.backgroundColor`, which
 * is `surface.canvas`) and nothing else, over the whole screen, catching every touch, and is hidden from assistive tech
 * (never announced). `AccountGate` shows it while the app is not `active` (a second layer under the iOS native cover
 * and Android's `FLAG_SECURE`) and while a decision on focus or on the return to `active` runs over an open screen, so
 * a lock decided then never shows the content first. `image: false` draws the canvas alone (a decision on focus: a
 * frame or two, with no splash flashing on every Back).
 */
export function AccountCover({ image = true, testID = 'account-cover' }: { image?: boolean; testID?: string }): ReactElement {
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface.canvas, alignItems: 'center', justifyContent: 'center', zIndex: 10 }]}
    >
      {image ? <Image source={typeof splash === 'number' ? splash : { uri: splash }} resizeMode="contain" style={{ width: '100%', height: '100%' }} /> : null}
    </View>
  );
}
