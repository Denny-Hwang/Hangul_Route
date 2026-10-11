import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { Icon, colors, tabBarMetrics, typography, useLayoutClass } from '@hangul-route/design-system';
import React, { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../i18n/use-messages';
import { HomeScreen } from '../screens/home/HomeScreen';
import { JourneyScreen } from '../screens/journey/JourneyScreen';
import { LibraryScreen } from '../screens/library/LibraryScreen';
import { useUiStore } from '../store/ui-store';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs(): React.ReactElement {
  const tabs = useMessages().a11y.tabs;
  // The tab row sits above the home indicator instead of a fixed 24px pad
  // that overlapped it (audit p2-L2), clears a landscape notch, and is centred
  // inside `layout.maxWidth.full` on a wide window (F-LAYOUT-001 §3.2, LD6).
  const insets = useSafeAreaInsets();
  const { windowWidth } = useLayoutClass();
  const { height, paddingTop, paddingBottom, paddingLeft, paddingRight } = tabBarMetrics(
    insets.bottom,
    { left: insets.left, right: insets.right },
    windowWidth,
  );
  // PwaBanners (mounted beside the navigator) sit above the tab bar while it shows.
  const focused = useIsFocused();
  const setTabBarHeight = useUiStore((s) => s.setTabBarHeight);
  useEffect(() => {
    setTabBarHeight(focused ? height : 0);
    return () => setTabBarHeight(0);
  }, [focused, height, setTabBarHeight]);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: { fontSize: typography.size.caption, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.surface.paper,
          borderTopColor: colors.border.subtle,
          height,
          paddingTop,
          paddingBottom,
          paddingLeft,
          paddingRight,
        },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, 'home' | 'journey' | 'library'> = {
            Home: 'home',
            Journey: 'journey',
            Library: 'library',
          };
          return <Icon name={map[route.name] ?? 'home'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: tabs.home }} />
      <Tab.Screen name="Journey" component={JourneyScreen} options={{ tabBarLabel: tabs.journey }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ tabBarLabel: tabs.library }} />
    </Tab.Navigator>
  );
}
