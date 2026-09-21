import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  EpisodeDetail: { episodeId: string };
  QuestPlayer: { questId: string; episodeId: string };
  Results: { questId: string; episodeId: string; stars: 0 | 1 | 2 | 3; correct: number; total: number };
  CardDetail: { cardId: string };
  /** Grown-up gate (PIN). `AddProfile` continues into Onboarding/CreateProfile. */
  PinEntry: { next: 'ParentDashboard' | 'AddProfile' | 'Restore' | 'SaveProgress' | 'Paywall' };
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
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  CreateProfile: { firstRun: boolean };
  FirstQuestPreview: { profileId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Journey: undefined;
  Library: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
