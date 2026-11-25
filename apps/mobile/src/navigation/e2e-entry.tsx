import type { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReactElement } from 'react';
import { LessonWaiting } from '../screens/lesson-content';
import { useClozePickChunk } from '../screens/minigames/cloze-pick-entry';
import { HiddenHeritageE2eHook, HiddenHeritageE2eScreen } from './hidden-heritage-e2e';
import { PlacementE2eHook } from './placement-e2e';
import { RealiaE2eHook, RealiaReadE2eScreen } from './realia-read-e2e';
import { RolePlayE2eHook, RolePlayE2eScreen } from './role-play-e2e';
import { SentenceBuilderE2eScreen, SentenceE2eHook } from './sentence-builder-e2e';
import { StoryE2eHook } from './story-e2e';
import { StoryOrderE2eHook, StoryOrderE2eScreen } from './story-order-e2e';
import { TapBoardE2eHook, TapBoardE2eScreen } from './tap-board-e2e';
import { TraceWordE2eHook, TraceWordE2eScreen } from './trace-word-e2e';
import { TypeHangulE2eHook, TypeHangulE2eScreen } from './type-hangul-e2e';
import type { RootStackParamList } from './types';
import { VocabE2eHook, VocabQuestionE2eScreen } from './vocab-question-e2e';
import { WriteFrameE2eHook, WriteFrameE2eScreen } from './write-frame-e2e';

/**
 * The fixture build's e2e entry (AMENDMENTS-START-BUNDLE-2026-11 SB-2; F-STORY-002 §5): every `window.__hr*E2E` hook
 * and every e2e screen of the root stack. Only the generated `content/__generated__/e2e-registry.ts` imports this
 * module, and only the fixture build writes that import (`build-stories.mjs --include-fixtures`, run by
 * `build:web:fixtures`, which restores the plain registry after). A plain run writes `E2E_ENTRY = null` with no import,
 * so a release build carries none of this code (it was about 27 KB of the start bundle while `navigation/root.tsx`
 * imported it and switched it off at run time).
 */

type RootStack = ReturnType<typeof createNativeStackNavigator<RootStackParamList>>;

export interface E2eEntry {
  /** Mounted beside the root navigator: installs the hooks. */
  Hooks: () => ReactElement;
  /** The e2e screens, as children of the root navigator. */
  screens: (stack: RootStack) => ReactElement;
}

/** The `window.__hrClozePickE2E` hook, in the Cloze Pick chunk (`navigation/cloze-pick-e2e.tsx`), loaded at once. */
function ClozePickE2eHook(): ReactElement | null {
  const { chunk } = useClozePickChunk(true);
  if (chunk === null) return null;
  const { ClozePickE2eHookBody } = chunk;
  return <ClozePickE2eHookBody />;
}

/** A Cloze Pick step on the fixture rounds, from the chunk. */
function ClozePickE2eScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ClozePickE2e'>): ReactElement {
  const { chunk } = useClozePickChunk(true);
  if (chunk === null) return <LessonWaiting />;
  const { ClozePickE2eBody } = chunk;
  return <ClozePickE2eBody key={route.key} rounds={route.params.rounds} onBack={() => navigation.goBack()} />;
}

function Hooks(): ReactElement {
  return (
    <>
      <StoryE2eHook />
      <PlacementE2eHook />
      <VocabE2eHook />
      <SentenceE2eHook />
      <RealiaE2eHook />
      <TypeHangulE2eHook />
      <TraceWordE2eHook />
      <WriteFrameE2eHook />
      <ClozePickE2eHook />
      <StoryOrderE2eHook />
      <RolePlayE2eHook />
      <HiddenHeritageE2eHook />
      <TapBoardE2eHook />
    </>
  );
}

function screens(Stack: RootStack): ReactElement {
  return (
    <>
      <Stack.Screen name="VocabQuestionE2e" component={VocabQuestionE2eScreen} />
      <Stack.Screen name="SentenceBuilderE2e" component={SentenceBuilderE2eScreen} />
      <Stack.Screen name="RealiaReadE2e" component={RealiaReadE2eScreen} />
      <Stack.Screen name="TypeHangulE2e" component={TypeHangulE2eScreen} />
      <Stack.Screen name="TraceWordE2e" component={TraceWordE2eScreen} />
      <Stack.Screen name="WriteFrameE2e" component={WriteFrameE2eScreen} />
      <Stack.Screen name="ClozePickE2e" component={ClozePickE2eScreen} />
      <Stack.Screen name="StoryOrderE2e" component={StoryOrderE2eScreen} />
      <Stack.Screen name="RolePlayE2e" component={RolePlayE2eScreen} />
      <Stack.Screen name="HiddenHeritageE2e" component={HiddenHeritageE2eScreen} />
      <Stack.Screen name="TapBoardE2e" component={TapBoardE2eScreen} />
    </>
  );
}

export const e2eEntry: E2eEntry = { Hooks, screens };
