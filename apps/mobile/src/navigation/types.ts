import type { PlacementSource, StoryLevel } from '@hangul-route/content-schema';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { MyRouteSource } from '../logic/my-route/telemetry';
import type { PinResetMethod } from '../logic/profiles/pin-flow';
import type { GrownUpVia } from '../logic/shell/handoff-rules';
import type { LibrarySectionId } from '../logic/story/library-sections';
import type { SourcesRouteParams } from '../logic/story/source-link';
import type { VocabQuestionE2eParams } from './vocab-question-e2e';

/**
 * Where a grown-up action continues once the gate (or a new PIN) is through. `ExternalLink`
 * (F-STORY-002 §3.1, §3.8): back to Sources, which opens the waiting source link (native) or asks for one more tap (web).
 * `PlacementFinish`: back to the level check, which then ends the run for the grown-up (F-PLC-001
 * section 3.1 step 6, stop reason `grown-up`). `GrownUpArea` (F-APP-001 section 3.9, web only): the
 * grown-up pages on the app host; its PIN screen only verifies, never creates or resets a PIN.
 */
export type GrownUpDestination =
  | 'ParentDashboard'
  | 'AddProfile'
  | 'Restore'
  | 'SaveProgress'
  | 'Paywall'
  | 'ExternalLink'
  | 'PlacementFinish'
  | 'EditProfile'
  | 'MyRoute'
  | 'PlacementReport'
  | 'GrownUpArea';

export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  EpisodeDetail: { episodeId: string };
  /**
   * My route (F-ROUTE-001 section 3.1): the whole journey at a glance. `profileId` absent = the
   * active profile. Another profile opens read-only only while the grown-up gate is open; otherwise
   * the screen replaces itself with `PinEntry`. `source` is the entry, for `route_map.viewed`.
   */
  /** `viewer: 'grownup'`: opened by a grown-up (the parent dashboard row, R-9b), always read-only, also for the active profile (amendment section 5.1). */
  MyRoute: { source: MyRouteSource; profileId?: string; viewer?: 'grownup' };
  /**
   * `resume`: open a story quest on its `story-read` step when the learner has a
   * bookmark for it at the quest's level (F-STORY-004 §3.8); otherwise step 0.
   */
  QuestPlayer: { questId: string; episodeId: string; resume?: boolean };
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
    /**
     * `next: 'ExternalLink'`: the source link waiting on the gate (Sources holds it until the return).
     * `next: 'GrownUpArea'`: the grown-up page to open after the PIN (a path `safeNextPath` accepts); absent opens the sign-in router.
     */
    url?: string;
    /** `next: 'GrownUpArea'`: the entry that asked for the PIN (`shell.grown_up_handoff` `via`); the lock's PIN path passes `lock`. */
    grownUpVia?: GrownUpVia;
    /** `next: 'Paywall'`: the surface that opened it, passed on to the paywall (default `'journey'`). */
    from?: 'journey' | 'library';
    /** `next: 'EditProfile'`: the profile to edit (F-LEARN-001 §3.11); `next: 'MyRoute'`: the profile whose page opens read-only; `next: 'PlacementReport'`: whose report opens (F-PLC-001 section 3.9). */
    profileId?: string;
  };
  /** Forgot PIN: Rescue Code or a 24-hour wait, then a new PIN (F-LEARN-001 §3.5). `next` is kept for the PIN screen. */
  PinReset: { next: GrownUpDestination; profileId?: string };
  /** sync/restore — rescue code / sign-in / file (F-RESTORE-001, F-SYNC-002). */
  Restore: { from: 'welcome' | 'settings' } | undefined;
  /** sync/save-progress — the Rescue Code, PIN-gated (F-RESTORE-001 §3.3). */
  SaveProgress: undefined;
  /** sync/join-space — enter a class or family code (F-SPACE-001 §3.5). Not PIN-gated. */
  JoinSpace: undefined;
  /** paywall/upgrade — PIN-gated premium explainer (F-ENT-001 §3.5). */
  Paywall: { from: 'journey' | 'settings' | 'library' } | undefined;
  ParentDashboard: undefined;
  Profile: undefined;
  /** profile/edit — name, level, cub, who is learning (F-LEARN-001 §3.11). Behind the PIN when the gate is required. */
  EditProfile: { profileId: string };
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
  /**
   * Sources (F-STORY-002 §3.8): every fact of a story with its citations. `factId` scrolls to and
   * highlights that card, `sceneIndex` scrolls to that scene; `from` is for telemetry only.
   */
  StorySources: SourcesRouteParams;
  /**
   * Culture notes (F-STORY-004 §3.5): every note the learner has found, by theme. `storyId` shows
   * only that story's notes; `noteId` scrolls to that note and opens its sources. `from: 'quest'`:
   * opened by the reader inside a running quest, so the screen offers Back only.
   */
  CultureNotes: { storyId?: string; noteId?: string; from?: 'quest' } | undefined;
  /**
   * The level check (F-PLC-001 section 3.10): a nested stack of its screens.
   * `retakeMode`: "Try it with the sound guide hidden" on the result opens the
   * options with that length and the guide hidden.
   */
  Placement: { source: PlacementSource; retakeMode?: 'standard' | 'deep' };
  /** parent/placement-report — the grown-up report of the level check, behind the PIN gate (F-PLC-001 section 3.9). */
  PlacementReport: { profileId: string };
  /** Fixture builds only (`navigation/vocab-question-e2e.tsx`): the shared vocabulary question view on catalogue words. */
  VocabQuestionE2e: VocabQuestionE2eParams;
};

/** The level check's screens (F-PLC-001 section 3.1); the flow state machine decides which one shows. */
export type PlacementStackParamList = {
  PlacementBoot: undefined;
  PlacementResume: undefined;
  PlacementLanguage: undefined;
  PlacementOptions: undefined;
  PlacementHandoff: undefined;
  PlacementWarmup: undefined;
  PlacementSoundNeeded: undefined;
  PlacementItem: undefined;
  PlacementResult: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  CreateProfile: { firstRun: boolean };
  FirstQuestPreview: { profileId: string };
  /** The level check's fork (F-PLC-001 section 3.1 step 1), between CreateProfile and FirstQuestPreview. */
  PlacementInvite: { profileId: string };
};

export type MainTabParamList = {
  Home: undefined;
  /**
   * `episodeId`: select this episode in the two-pane Journey (back from a quest or from Results,
   * F-LAYOUT-001 §3.7). Read once, then cleared; on one pane it only seeds the remembered selection
   * (shown if the window widens to two panes). An id the catalogue does not have is ignored.
   */
  Journey: { episodeId?: string } | undefined;
  /**
   * `section`: open the Library on this section (F-STORY-004 §3.3), e.g.
   * `navigate('Main', { screen: 'Library', params: { section: 'story-time' } })`. Read once, then
   * cleared; a section that is not offered opens Cards.
   */
  Library: { section?: LibrarySectionId } | undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
