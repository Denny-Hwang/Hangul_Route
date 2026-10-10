import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, colors, tabBarMetrics, typography } from '@hangul-route/design-system';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/home/HomeScreen';
import { JourneyScreen } from '../screens/journey/JourneyScreen';
import { LibraryScreen } from '../screens/library/LibraryScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs(): React.ReactElement {
  // The tab row sits above the home indicator instead of a fixed 24px pad
  // that overlapped it (audit p2-L2).
  const { height, paddingTop, paddingBottom } = tabBarMetrics(useSafeAreaInsets().bottom);
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Today' }} />
      <Tab.Screen name="Journey" component={JourneyScreen} options={{ tabBarLabel: 'Journey' }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ tabBarLabel: 'Library' }} />
    </Tab.Navigator>
  );
}
