import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState, type ReactElement } from 'react';
import { LessonWaiting } from '../screens/lesson-content';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to Hidden Heritage (F-CURR-002 row CM-36), for fixture builds only (the switch of `story-e2e.tsx`:
 * a real build never registers this screen or installs the hook). No lesson cell plays the game until the Food
 * Volume 2 cell ships, so its e2e opens the step on the Food market scene's reference round through
 * `window.__hrHiddenHeritageE2E.open(...)`. The screen itself is a chunk (`./hidden-heritage-e2e-screen.tsx`), so the
 * start bundle carries only this hook. `game.hidden-heritage` comes from the stored remote copy the spec seeds.
 */

export interface HiddenHeritageE2eParams {
  missing?: boolean;
  /** The scene whose reference round opens (row CM-37); the Food market when absent. */
  sceneId?: string;
}

export interface HiddenHeritageE2eHandle {
  open(params: HiddenHeritageE2eParams): void;
  log(): { answers: Array<{ key: string; correct: boolean }>; completed: number };
}

/** What the e2e host saw since the screen opened (the screen module writes it). */
export const e2eLog: { answers: Array<{ key: string; correct: boolean }>; completed: number } = { answers: [], completed: 0 };

export function HiddenHeritageE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrHiddenHeritageE2E?: HiddenHeritageE2eHandle };
    g.__hrHiddenHeritageE2E = {
      open: (params) => navigation.dispatch(StackActions.push('HiddenHeritageE2e', params)),
      log: () => ({ answers: e2eLog.answers.map((a) => ({ ...a })), completed: e2eLog.completed }),
    };
    return () => {
      delete g.__hrHiddenHeritageE2E;
    };
  }, [navigation]);
  return null;
}

type Body = typeof import('./hidden-heritage-e2e-screen');
type Props = NativeStackScreenProps<RootStackParamList, 'HiddenHeritageE2e'>;

export function HiddenHeritageE2eScreen(props: Props): ReactElement {
  const [body, setBody] = useState<Body | null>(null);
  useEffect(() => {
    void import('./hidden-heritage-e2e-screen').then(setBody);
  }, []);
  if (body === null) return <LessonWaiting />;
  const { HiddenHeritageE2eBody } = body;
  return <HiddenHeritageE2eBody {...props} />;
}
