import type { PlacementEvent, PlacementResult, PlacementRunState, RouteCatalog } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { createContext, useCallback, useContext } from 'react';
import type { FlowCapability, FlowEvent, FlowState, ResumeOffer } from '../../logic/placement/flow';
import type { ResultView } from '../../logic/placement/result-view';
import type { PlacementStackParamList } from '../../navigation/types';
import type { PlayResult } from '../../platform/audio';

/**
 * What every screen of the level check reads (F-PLC-001 section 3.1). The
 * host (`PlacementScreen`) owns the flow state machine, the run and the
 * finished result; the screens render them and send events back.
 */

export type PlacementRoute = keyof PlacementStackParamList;

export interface FinishedCheck {
  result: PlacementResult;
  view: ResultView;
  catalog: RouteCatalog;
  placedOut: ReadonlySet<string>;
  completed: ReadonlySet<string>;
  startQuest: { questId: string; episodeId: string } | null;
}

export type ResultAction = 'start' | 'seeMap' | 'seeMyRoute' | 'openStories' | 'forGrownUps' | 'tryStandard' | 'retryHidden';

export interface PlacementContextValue {
  profileId: string;
  flow: FlowState;
  dispatch: (event: FlowEvent) => void;
  /** The messages of the test language (`getMessages(testLocale)`): the check speaks it, not the UI language. */
  m: Messages;
  screenReader: boolean;
  /** The device, read now for the given test language. */
  capability: (testLocale: FlowState['testLocale']) => FlowCapability;
  /** Speaks a line of the check in the test language (instructions, labels). */
  say: (text: string) => Promise<PlayResult>;
  run: PlacementRunState | null;
  /** Applies an engine event to the run; it is saved after every answer. */
  applyRun: (event: PlacementEvent) => void;
  finished: FinishedCheck | null;
  offer: ResumeOffer | null;
  continueRun: () => void;
  startAgain: () => void;
  /** True until a tap unlocks audio after a resume or a cold start: the first prompt then plays on a tap. */
  needsGesture: boolean;
  markGesture: () => void;
  /** "For grown-ups: finish now": behind the PIN when the device needs one. */
  finishForGrownUp: () => void;
  onResultAction: (action: ResultAction) => void;
  /** Leaves the check (nothing recorded unless a result was). */
  leave: () => void;
  target: PlacementRoute;
}

const PlacementContext = createContext<PlacementContextValue | null>(null);

export const PlacementProvider = PlacementContext.Provider;

export function usePlacement(): PlacementContextValue {
  const value = useContext(PlacementContext);
  if (value === null) throw new Error('usePlacement outside the level check');
  return value;
}

/**
 * Wraps one screen of the nested stack: it renders only while the flow is on
 * it, and replaces itself with the screen the flow moved to, so the stack
 * always holds the one screen the state machine names.
 */
export function flowRoute(name: PlacementRoute, Screen: React.ComponentType): React.ComponentType {
  function FlowRoute(): React.ReactElement | null {
    const { target } = usePlacement();
    const navigation = useNavigation<NativeStackNavigationProp<PlacementStackParamList>>();
    // On focus, not on mount: an action sent while the nested navigator is still mounting is dropped.
    useFocusEffect(
      useCallback(() => {
        if (target !== name) navigation.replace(target);
      }, [target, navigation]),
    );
    return target === name ? <Screen /> : null;
  }
  FlowRoute.displayName = `FlowRoute(${name})`;
  return FlowRoute;
}
