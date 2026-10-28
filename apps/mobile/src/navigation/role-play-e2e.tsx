import type { RolePlayScene } from '@hangul-route/content-schema';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { RolePlayE2eDoor } from '../screens/minigames/role-play/role-play-entry';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to Role Play (F-CURR-002 row CM-35), for fixture builds only (the switch of `story-e2e.tsx`: only
 * the e2e bundle has story fixture ids, so a real build never registers this screen or installs the hook). No shipped
 * lesson cell plays `role-play` until the Stage 4 and pack rows, so the Playwright suite hands a fixture scene to
 * `window.__hrRolePlayE2E.open(...)`; the scene travels in the route params, so no bundle carries it. The screen is
 * the Role Play chunk's (`RolePlayE2eScreen`, which adds `log()` and `events()` to the handle), so the start bundle
 * carries only this door.
 */

export interface RolePlayE2eParams {
  scene: RolePlayScene;
}

export function RolePlayE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrRolePlayE2E?: { open(params: RolePlayE2eParams): void } };
    g.__hrRolePlayE2E = { open: (params) => navigation.dispatch(StackActions.push('RolePlayE2e', params)) };
    return () => {
      delete g.__hrRolePlayE2E;
    };
  }, [navigation]);
  return null;
}

export function RolePlayE2eScreen(props: NativeStackScreenProps<RootStackParamList, 'RolePlayE2e'>): ReactElement {
  return <RolePlayE2eDoor {...props} />;
}
