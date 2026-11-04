import { StackActions, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState, type ReactElement } from 'react';
import { LessonWaiting } from '../screens/lesson-content';
import type { RootStackParamList } from './types';

/**
 * End-to-end entry to the design-system `TapBoard` (docs/specs/AMENDMENTS-TOUCH.md row KT-1), for fixture builds only
 * (the switch of `story-e2e.tsx`: a real build never registers this screen or installs the hook). No learner surface
 * uses a board until rows KT-2 to KT-7 adopt it, so the touch e2e (`e2e/web/type-hangul-tap-board.spec.ts`) opens a
 * board of four 96 x 96 targets here, 12 px apart, through `window.__hrTapBoardE2E.open(...)`, and reads what
 * committed. The screen
 * is a chunk (`./tap-board-e2e-screen.tsx`), so the start bundle carries only this hook.
 */

export interface TapBoardE2eParams {
  /** `board` or `target` (KT-D5). */
  lock: 'board' | 'target';
  /** `fit`: the board alone, the screen fits. `tall`: a tall block under the board, so the screen scrolls. */
  layout: 'fit' | 'tall';
  /** Indexes of targets drawn as locked wrong tiles (`disabled`); with `cards`, ChoiceCards drawn as an answered miss. */
  disabled?: readonly number[];
  /**
   * `targets` (default): four bare `TapTarget`s. `cards` (row KT-2): two ChoiceCards and two Tiles in the board, and a
   * Button under it, outside the board. A ChoiceCard commits as 10 + its index, a Tile as 20 + its index.
   */
  kind?: 'targets' | 'cards';
}

export interface TapBoardE2eLog {
  /** Every commit, in order: the target's index and when (`Date.now()`). */
  commits: Array<{ index: number; at: number }>;
  /** Presses of the plain control inside the board (never claimed by the board, rule 2). */
  controls: number;
  /** Presses of the Button outside the board (`cards`; the press guard, KT-2). */
  buttons: number;
}

export interface TapBoardE2eHandle {
  open(params: TapBoardE2eParams): void;
  log(): TapBoardE2eLog;
}

/** What the screen saw since it opened (the screen module writes it). */
export const e2eLog: TapBoardE2eLog = { commits: [], controls: 0, buttons: 0 };

export function TapBoardE2eHook(): null {
  const navigation = useNavigation();
  useEffect(() => {
    const g = globalThis as { __hrTapBoardE2E?: TapBoardE2eHandle };
    g.__hrTapBoardE2E = {
      open: (params) => {
        e2eLog.commits = [];
        e2eLog.controls = 0;
        e2eLog.buttons = 0;
        navigation.dispatch(StackActions.push('TapBoardE2e', params));
      },
      log: () => ({ commits: e2eLog.commits.map((c) => ({ ...c })), controls: e2eLog.controls, buttons: e2eLog.buttons }),
    };
    return () => {
      delete g.__hrTapBoardE2E;
    };
  }, [navigation]);
  return null;
}

type Body = typeof import('./tap-board-e2e-screen');
type Props = NativeStackScreenProps<RootStackParamList, 'TapBoardE2e'>;

export function TapBoardE2eScreen(props: Props): ReactElement {
  const [body, setBody] = useState<Body | null>(null);
  useEffect(() => {
    void import('./tap-board-e2e-screen').then(setBody);
  }, []);
  if (body === null) return <LessonWaiting />;
  const { TapBoardE2eBody } = body;
  return <TapBoardE2eBody {...props} />;
}
