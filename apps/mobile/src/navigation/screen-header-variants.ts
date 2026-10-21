import type { ScreenHeaderOptions } from '@hangul-route/design-system';
import type { ScreenHeaderVariant } from '../logic/navigation/screen-header';
import type { BrowseStackParamList } from './browse';
import type { MainTabParamList, OnboardingStackParamList, PlacementStackParamList, RootStackParamList } from './types';

/**
 * The way back of every route (AMENDMENTS-DISPLAY-NAV section 7.1, row DN-4; wireframe
 * `design/wireframes/shell/screen-header.md`): `back` for stack screens, `close` for modals and
 * the flows that ask before leaving (the quest player, a game, the level check, Stage review, the
 * story reader, the flashcards, the Speed Round), `none` for roots. The record is keyed by every
 * route name of every navigator's param list, so a route added without a variant does not compile.
 * Route names shared by the learner stack and All lessons (`Minigame`, `StoryReader`,
 * `StorySources`, `CardDetail`) mean the same screen in both.
 */
export type ScreenHeaderRouteName =
  | keyof RootStackParamList
  | keyof OnboardingStackParamList
  | keyof MainTabParamList
  | keyof BrowseStackParamList
  | keyof PlacementStackParamList;

/**
 * A non-root screen without Back: the end of first-run setup. CreateProfile reaches both with
 * `navigation.reset`, so the onboarding stack holds that screen alone and a Back would have nowhere to go.
 * None is drawn: setup is over once a profile is saved, and going back toward Welcome would lead into a
 * second profile. After the level check the stack is `[FirstQuestPreview]` alone.
 */
export const SCREEN_HEADER_EXCEPTIONS = ['PlacementInvite', 'FirstQuestPreview'] as const satisfies readonly ScreenHeaderRouteName[];
export type ScreenHeaderException = (typeof SCREEN_HEADER_EXCEPTIONS)[number];

/**
 * The roots: no leading control (Welcome, the tab navigator and its four tabs, All lessons home, BrowseAccess, the onboarding stack).
 * [OA] `WhoIsUsing` (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 6.1, CS-5): the chooser has no Back, even pushed over a screen.
 */
export const SCREEN_HEADER_ROOTS = ['Onboarding', 'Main', 'Welcome', 'Home', 'Route', 'Journey', 'Library', 'BrowseHome', 'BrowseAccess', 'WhoIsUsing'] as const satisfies readonly ScreenHeaderRouteName[];

export const SCREEN_HEADER_VARIANTS: Readonly<Record<ScreenHeaderRouteName, ScreenHeaderVariant>> = {
  // Containers and roots.
  Onboarding: 'none',
  Main: 'none',
  Welcome: 'none',
  Home: 'none',
  Route: 'none',
  Journey: 'none',
  Library: 'none',
  BrowseHome: 'none',
  BrowseAccess: 'none',
  // [OA] "Who is using this?": no Back, the Android back swallowed (CS-5).
  WhoIsUsing: 'none',
  // The end of first-run setup (the exception list).
  PlacementInvite: 'none',
  FirstQuestPreview: 'none',
  // First-run setup: CreateProfile's Back steps back through its steps (its `beforeRemove` guard), then to Welcome.
  CreateProfile: 'back',
  // Learning.
  EpisodeDetail: 'back',
  CellStories: 'back',
  MyRoute: 'back',
  QuestPlayer: 'close',
  Minigame: 'close',
  Results: 'back',
  StageComplete: 'back',
  StageReview: 'close',
  CardDetail: 'close',
  StoryReader: 'close',
  StorySources: 'back',
  CultureNotes: 'back',
  Homework: 'back',
  VocabTopics: 'back',
  VocabTopic: 'back',
  VocabCards: 'close',
  VocabMatch: 'close',
  VocabSpeedRound: 'close',
  VocabResults: 'back',
  Notes: 'back',
  NoteDetail: 'back',
  // The level check: one root route and the screens of its nested stack, all one flow that asks before leaving.
  Placement: 'close',
  PlacementBoot: 'close',
  PlacementResume: 'close',
  PlacementLanguage: 'close',
  PlacementOptions: 'close',
  PlacementHandoff: 'close',
  PlacementWarmup: 'close',
  PlacementSoundNeeded: 'close',
  PlacementItem: 'close',
  PlacementResult: 'close',
  // The weekly plan.
  RouteProposal: 'back',
  RouteSetup: 'back',
  RoutePreview: 'back',
  RouteOverview: 'back',
  // Profile, the grown-up area and its screens.
  Profile: 'back',
  EditProfile: 'back',
  ParentDashboard: 'back',
  PinEntry: 'close',
  // Forgot PIN replaced the PIN screen: its Back returns there (a guard in the screen).
  PinReset: 'back',
  PlacementReport: 'back',
  LearnerReport: 'back',
  NotesGrownUp: 'back',
  NoteReport: 'close',
  Restore: 'back',
  SaveProgress: 'back',
  JoinSpace: 'back',
  MoveClass: 'back',
  ApproveTransfer: 'back',
  ClassScope: 'back',
  Paywall: 'back',
  // All lessons.
  BrowseEpisode: 'back',
  BrowseItem: 'back',
  PreviewQuest: 'close',
  PreviewFlashcards: 'close',
  PreviewEnd: 'back',
  // Fixture screens of the e2e build only (never in a release bundle).
  VocabQuestionE2e: 'close',
  SentenceBuilderE2e: 'close',
  RealiaReadE2e: 'close',
  TypeHangulE2e: 'close',
  TraceWordE2e: 'close',
  WriteFrameE2e: 'close',
};

const EXCEPTIONS: ReadonlySet<string> = new Set(SCREEN_HEADER_EXCEPTIONS);

/** The variant of a route name (`undefined` for a name no navigator declares). */
export function screenHeaderVariant(name: string): ScreenHeaderVariant | undefined {
  return Object.prototype.hasOwnProperty.call(SCREEN_HEADER_VARIANTS, name) ? SCREEN_HEADER_VARIANTS[name as ScreenHeaderRouteName] : undefined;
}

/** Whether a route name is in the exception list. */
export function isScreenHeaderException(name: string): boolean {
  return EXCEPTIONS.has(name);
}

/**
 * What a root passes as its `Screen` header to draw its header row with no title (no leading
 * control, the Display (Aa) control at the top right). The tabs pass their name with it instead
 * (`{ title, titleInline: true }`). A root that passes nothing draws no header (Welcome, Home with
 * its own row, BrowseAccess).
 */
export const ROOT_HEADER: ScreenHeaderOptions = Object.freeze({});
