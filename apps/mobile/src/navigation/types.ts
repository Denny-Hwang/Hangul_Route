import type { StoryLevel } from '@hangul-route/content-schema';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { PinResetMethod } from '../logic/profiles/pin-flow';

/** Where a grown-up action continues once the gate (or a new PIN) is through. */
export type GrownUpDestination = 'ParentDashboard' | 'AddProfile' | 'Restore' | 'SaveProgress' | 'Paywall';

export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  EpisodeDetail: { episodeId: string };
  QuestPlayer: { questId: string; episodeId: string };
  Results: {
    questId: string;
    episodeId: string;
    stars: 0 | 1 | 2 | 3;
    /** Rounds right on the first try / rounds scored (logic/first-try). */
    correct: number;
    total: number;
    /** Answers after a round's first one — telemetry only, never scored. */
    retries?: number;
  };
  CardDetail: { cardId: string };
  /** Grown-up gate (PIN). `AddProfile` continues into Onboarding/CreateProfile. */
  PinEntry: {
    next: GrownUpDestination;
    /** `'setup'` opens PIN creation even when one is stored (Forgot PIN, F-LEARN-001 §3.5). */
    mode?: 'setup';
    /** Which Forgot PIN path led here (telemetry only). */
    via?: PinResetMethod;
  };
  /** Forgot PIN: Rescue Code or a 24-hour wait, then a new PIN (F-LEARN-001 §3.5). `next` is kept for the PIN screen. */
  PinReset: { next: GrownUpDestination };
  /** sync/restore — rescue code / sign-in / file (F-RESTORE-001, F-SYNC-002). */
  Restore: { from: 'welcome' | 'settings' } | undefined;
  /** sync/save-progress — the Rescue Code, PIN-gated (F-RESTORE-001 §3.3). */
  SaveProgress: undefined;
  /** sync/join-space — enter a class or family code (F-SPACE-001 §3.5). Not PIN-gated. */
  JoinSpace: undefined;
  /** paywall/upgrade — PIN-gated premium explainer (F-ENT-001 §3.5). */
  Paywall: { from: 'journey' | 'settings' } | undefined;
  ParentDashboard: undefined;
  Profile: undefined;
  Homework: undefined;
  Minigame: {
    questId: string;
    episodeId: string;
    stepIndex: number;
  };
  /**
   * The story reader outside a quest (F-STORY-002 §3.1): unscored, writes nothing. "Read it again"
   * from Results (F-STORY-003) and the shelf / episode page (F-STORY-004) open it.
   */
  StoryReader: { storyId: string; level: StoryLevel; mode: 'replay'; sceneIndex?: number };
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  CreateProfile: { firstRun: boolean };
  FirstQuestPreview: { profileId: string };
};

export type MainTabParamList = {
  Home: undefined;
  /**
   * `episodeId`: select this episode in the two-pane Journey (back from a quest or from Results,
   * F-LAYOUT-001 §3.7). Read once, then cleared; on one pane it only seeds the remembered selection
   * (shown if the window widens to two panes). An id the catalogue does not have is ignored.
   */
  Journey: { episodeId?: string } | undefined;
  Library: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
