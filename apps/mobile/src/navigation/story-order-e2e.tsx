import type { RomanizationMode } from '@hangul-route/content-schema';
import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import type { ReactElement } from 'react';
import { RomanizationModeOverride } from '../i18n/use-romanization-mode';
import type { MinigameHost } from '../screens/minigames/host';
import type { MinigameScope } from '../logic/minigame-config';
import { StoryOrderStep } from '../screens/minigames/story-order/StoryOrderStep';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to Story Order (F-CURR-002 row CM-34), for fixture builds only (the same switch as
 * `story-e2e.tsx`). No lesson cell plays Story Order until the Check rotation rows author it, so its e2e opens the
 * step on a scope the spec passes (`story-order-e2e-fixture.ts`, which the spec imports, so the fixture lines never
 * ride in the start bundle) through `window.__hrStoryOrderE2E.open(...)`, through the real `game.story-order` door:
 * the stored remote copy decides between the game's chunk and its Story Sequence fallback.
 */

export interface StoryOrderE2eParams {
  scope: MinigameScope;
  romanization?: RomanizationMode;
}

interface Log {
  answers: Array<{ key: string; correct: boolean; hinted: boolean }>;
  completed: number;
  /** The fallback ended the step (Story Sequence). */
  fallbackFinished: number;
}

const log: Log = { answers: [], completed: 0, fallbackFinished: 0 };

export function StoryOrderE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrStoryOrderE2E?: { open(p: StoryOrderE2eParams): void; log(): Log } };
    g.__hrStoryOrderE2E = {
      open: (params) => navigation.dispatch(StackActions.push('StoryOrderE2e', params)),
      log: () => ({ ...log, answers: log.answers.map((a) => ({ ...a })) }),
    };
    return () => {
      delete g.__hrStoryOrderE2E;
    };
  }, [navigation]);
  return null;
}

export function StoryOrderE2eScreen({ route }: NativeStackScreenProps<RootStackParamList, 'StoryOrderE2e'>): ReactElement {
  const { scope, romanization = 'always' } = route.params;
  useEffect(() => {
    log.answers = [];
    log.completed = 0;
    log.fallbackFinished = 0;
  }, [route.params]);
  const host: MinigameHost = {
    mode: 'quest',
    answer: (key, correct, meta) => log.answers.push({ key: String(key), correct, hinted: meta?.hinted === true }),
    complete: () => {
      log.completed += 1;
    },
  };
  return (
    <RomanizationModeOverride mode={romanization}>
      <StoryOrderStep scope={scope} host={host} sequenceId="minigame:e2e-story-order" onFallbackFinish={() => (log.fallbackFinished += 1)} />
    </RomanizationModeOverride>
  );
}
