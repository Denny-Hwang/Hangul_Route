import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, colors, typography } from '@hangul-route/design-system';
import React from 'react';
import { HomeScreen } from '../screens/home/HomeScreen';
import { JourneyScreen } from '../screens/journey/JourneyScreen';
import { LibraryScreen } from '../screens/library/LibraryScreen';
import { HomeworkScreen } from '../screens/homework/HomeworkScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs(): React.ReactElement {
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
          height: 84,
          paddingTop: 6,
          paddingBottom: 24,
        },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, 'home' | 'journey' | 'library' | 'card' | 'profile'> = {
            Home: 'home',
            Journey: 'journey',
            Library: 'library',
            Homework: 'card',
            Profile: 'profile',
          };
          return <Icon name={map[route.name] ?? 'home'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Today' }} />
      <Tab.Screen name="Journey" component={JourneyScreen} options={{ tabBarLabel: 'Journey' }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ tabBarLabel: 'Library' }} />
      <Tab.Screen name="Homework" component={HomeworkScreen} options={{ tabBarLabel: 'Homework' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Me' }} />
    </Tab.Navigator>
  );
}
