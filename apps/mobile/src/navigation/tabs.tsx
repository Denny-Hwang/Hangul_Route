import { createBottomTabNavigator, type BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { Icon, borderWidth, colors, spacing, tabBarMetrics, typography, useLayoutClass, KOREAN_LINE_BREAK, useCappedFont } from '@hangul-route/design-system';
import React, { useEffect } from 'react';
import { Platform, Text, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { flags } from '../config/flags';
import { useMessages } from '../i18n/use-messages';
import { FOUR_TAB_LABEL_FIT, TAB_ICON, mainTabs, tabAccessibilityLabel, type MainTabName } from '../logic/my-route/tab';
import { HomeScreen } from '../screens/home/HomeScreen';
import { JourneyScreen } from '../screens/journey/JourneyScreen';
import { LibraryScreen } from '../screens/library/LibraryScreen';
import { MyRouteTabScreen } from '../screens/my-route/MyRouteScreen';
import { useUiStore } from '../store/ui-store';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const SCREENS: Readonly<Record<MainTabName, React.ComponentType>> = {
  Home: HomeScreen,
  Route: MyRouteTabScreen,
  Journey: JourneyScreen,
  Library: LibraryScreen,
};

const LABEL_STYLE: TextStyle = { fontSize: typography.size.caption, fontWeight: typography.weight.semibold };
/** The navigator's own label offset beside the icon (wide windows), on the spacing scale. */
const LABEL_BESIDE: TextStyle = { marginLeft: spacing.lg + spacing.xs, marginTop: spacing.xxs };

/**
 * The four-tab bar's label (design/screens/learning-route/tab-bar.md, "Large text"): the navigator's
 * own label look, plus the native cap at 1.3 x caption that shrinks to fit instead of cutting off.
 */
function fittedLabel(text: string): NonNullable<BottomTabNavigationOptions['tabBarLabel']> {
  return function FittedTabLabel({ color, position }) {
    // Native: drawn at the chosen text size with the 1.3 x caption cap kept as a budget for the step
    // and the OS together (owner items 6 and 7). The web label stays at the caption size, as before.
    const capped = useCappedFont('caption', FOUR_TAB_LABEL_FIT.maxFontSizeMultiplier);
    const native = Platform.OS !== 'web';
    return (
      <Text
        {...KOREAN_LINE_BREAK}
        {...FOUR_TAB_LABEL_FIT}
        {...(native ? { maxFontSizeMultiplier: capped.maxFontSizeMultiplier } : {})}
        style={[{ textAlign: 'center', color }, position === 'beside-icon' ? LABEL_BESIDE : null, LABEL_STYLE, native ? { fontSize: capped.fontSize } : null]}
      >
        {text}
      </Text>
    );
  };
}

/**
 * The learner tab bar. Flag off: Today, Journey, Library, exactly as before. Flag on
 * (`flags.myRouteEnabled`): Today, Route, Journey, Library (AMENDMENTS-ROUTE-LEARNING-ROUTE
 * section 5.1, LR-OD-2); the Route tab draws the `route` glyph over "Route" and is announced as
 * "Learning Route". Design: design/screens/learning-route/tab-bar.md, mock/tab-bar.html.
 */
export function MainTabs(): React.ReactElement {
  const messages = useMessages();
  const tabs = messages.a11y.tabs;
  // The tab row sits above the home indicator instead of a fixed 24px pad
  // that overlapped it (audit p2-L2), clears a landscape notch, and is centred
  // inside `layout.maxWidth.full` on a wide window (F-LAYOUT-001 §3.2, LD6).
  const insets = useSafeAreaInsets();
  const { windowWidth } = useLayoutClass();
  const metrics = tabBarMetrics(insets.bottom, { left: insets.left, right: insets.right }, windowWidth);
  const { paddingTop, paddingBottom, paddingLeft, paddingRight } = metrics;
  // The top border is inside the bar's height (border-box), so it is added on
  // top: otherwise the items come out 1 px under the 64 pt floor.
  const height = metrics.height + borderWidth.thin;
  // PwaBanners (mounted beside the navigator) sit above the tab bar while it shows.
  const focused = useIsFocused();
  const setTabBarHeight = useUiStore((s) => s.setTabBarHeight);
  useEffect(() => {
    setTabBarHeight(focused ? height : 0);
    return () => setTabBarHeight(0);
  }, [focused, height, setTabBarHeight]);

  const order = mainTabs(flags.myRouteEnabled);
  // Only the four-tab bar caps its native label; the three-tab bar keeps the navigator's plain label.
  const fourTabs = order.length === 4;
  const labels: Readonly<Record<MainTabName, string>> = { Home: tabs.home, Route: tabs.route, Journey: tabs.journey, Library: tabs.library };
  // The tab says "Route" (the 12-character tab budget); it is read as the full name (LR-OD-1). The four-tab label is a
  // component, so on iOS each tab spells out its "tab, n of 4" itself (tabAccessibilityLabel).
  const spoken = { labels, routeName: messages.a11y.myRoute.tab, position: messages.a11y.tabPosition };
  const accessibilityLabelOf = (name: MainTabName): { tabBarAccessibilityLabel?: string } => {
    const said = tabAccessibilityLabel(name, order, spoken, Platform.OS);
    return said === undefined ? {} : { tabBarAccessibilityLabel: said };
  };
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: LABEL_STYLE,
        tabBarStyle: {
          backgroundColor: colors.surface.paper,
          borderTopColor: colors.border.subtle,
          borderTopWidth: borderWidth.thin,
          height,
          paddingTop,
          paddingBottom,
          paddingLeft,
          paddingRight,
        },
        tabBarIcon: ({ color, size }) => <Icon name={TAB_ICON[route.name]} size={size} color={color} />,
      })}
    >
      {order.map((name) => (
        <Tab.Screen
          key={name}
          name={name}
          component={SCREENS[name]}
          options={fourTabs ? { tabBarLabel: fittedLabel(labels[name]), ...accessibilityLabelOf(name) } : { tabBarLabel: labels[name] }}
        />
      ))}
    </Tab.Navigator>
  );
}
