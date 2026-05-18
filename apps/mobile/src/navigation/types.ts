import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  EpisodeDetail: { episodeId: string };
  QuestPlayer: { questId: string; episodeId: string };
  Results: { questId: string; episodeId: string; stars: 0 | 1 | 2 | 3; correct: number; total: number };
  CardDetail: { cardId: string };
  ParentGate: { next: 'ParentDashboard' };
  ParentDashboard: undefined;
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
  Homework: undefined;
  Profile: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
