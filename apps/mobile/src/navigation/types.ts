import type { PlacementSource, StageKey, StoryLevel, ThemeKey } from '@hangul-route/content-schema';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { AskFrom } from '../logic/access-copy';
import type { PreviewFrom } from '../logic/episode-access';
import type { PinResetMethod } from '../logic/profiles/pin-flow';
import type { PlanChoice, ProposalSource } from '../logic/route/proposal-flow';
import type { SetupState } from '../logic/route/setup-flow';
import type { GrownUpVia } from '../logic/shell/handoff-rules';
import type { CellStoriesSource } from '../logic/story/cell-stories';
import type { LibrarySectionId } from '../logic/story/library-sections';
import type { SourcesRouteParams } from '../logic/story/source-link';
import type { VocabQuestionE2eParams } from './vocab-question-e2e';

/**
 * Where a grown-up action continues once the gate (or a new PIN) is through. `ExternalLink`
 * (F-STORY-002 §3.1, §3.8): back to Sources, which opens the waiting source link (native) or asks for one more tap (web).
 * `PlacementFinish`: back to the level check, which then ends the run for the grown-up (F-PLC-001
 * section 3.1 step 6, stop reason `grown-up`). `GrownUpArea` (F-APP-001 section 3.9, web only): the
 * grown-up pages on the app host; its PIN screen only verifies, never creates or resets a PIN.
 * `Billing` (F-BILL-002 §4.7, web only): back to the Plan screen, which opens the billing page for
 * the press that waited on the gate.
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
  | 'GrownUpArea'
  | 'Billing'
  /** F-FEEDBACK-001 section 6.10 (types from FB-7; the screens arrive with FB-9): a learner's notes in the grown-up zone, and the report sheet for one note (`PinEntry.noteId`). */
  | 'NotesGrownUp'
  | 'NoteReport'
  /** F-REPORT-001 section 3.9 (RP-9): one learner's in-app report (`PinEntry.profileId`). */
  | 'LearnerReport'
  /** F-PLAN-002 section 3.9 (P2-7a): a child profile's "Make a weekly plan" row, through the gate when the device needs it (`PinEntry.profileId`). */
  | 'RouteProposal'
  /** F-PLAN-002 section 3.9 (P2-7b): a child's **Change the plan** when the gate is closed (`PinEntry.profileId`). */
  | 'RouteSetup';

export type RootStackParamList = {
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  /**
   * `from`: the surface that opened the lesson page, for `access.preview_opened` (F-ENT-003 section
   * 3.12); absent reads `journey` (the grid, its two panes and the cell pages). `player` is the quest
   * player's guard, which sends a closed quest here (section 3.6).
   */
  EpisodeDetail: { episodeId: string; from?: PreviewFrom };
  /**
   * The heritage stories of one grid cell (F-STORY-005 §3.6): its lesson first, then its stories.
   * `source` is the door that opened it, for `journey.cell_stories_opened`.
   */
  CellStories: { stage: StageKey; theme: ThemeKey; source: CellStoriesSource };
  /**
   * The Learning Route of one learner, for a grown-up (AMENDMENTS-ROUTE-LEARNING-ROUTE section 5.1, LR-4):
   * the parent dashboard row (R-9b) and the PIN screen it passes through. Both params are required. Always
   * read-only, also for the active profile, and only while the grown-up gate is open; otherwise the screen
   * replaces itself with `PinEntry`. A learner's own page is the Route tab (`MainTabParamList.Route`).
   */
  MyRoute: { profileId: string; viewer: 'grownup' };
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
  /**
   * The weekly plan proposal (F-PLAN-002 section 3.9, wireframe journey/my-route-overview.md K1):
   * Hoya's recommended plan for `profileId`, with pace, length, start day and days to change, then
   * Start this plan or Not now. `source` is the door that opened it (`route.proposed.source`). The
   * update after a retake (`mode: 'update'`, K3) arrives with F-PLC-001 P-7b.
   */
  RouteProposal: { source: ProposalSource; profileId: string };
  /**
   * **Change the plan** (F-PLAN-002 section 3.9, wireframe console/curriculum-planner.md G1): four
   * steps with large chips, prefilled from the plan in force, else from the proposal and the
   * `choice` made on it.
   */
  RouteSetup: { profileId: string; choice?: PlanChoice };
  /** The new plan before it starts (G2): the first four weeks, the stats and the learner notices. */
  RoutePreview: { profileId: string; setup: SetupState };
  /** "Your weekly plan" (G3): this week first, later weeks folded, Move my plan along, Change, Stop. */
  RouteOverview: { profileId: string };
  /** The Stage 1 prize ceremony (F-QUEST-002 §3.8), opened from Results on the run that completed the stage. */
  StageComplete: { stageKey: StageKey };
  /** The Hangul Check (F-QUEST-002 §3.9), from the ceremony and the Journey Stage 1 header; never gates anything. */
  StageReview: { stageKey: StageKey };
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
    /**
     * `next: 'Paywall'`: the surface that opened it, passed on to the paywall (default `'journey'`).
     * F-ENT-003's ask button adds `episode`, `home` and `results` (section 3.7, `AskFrom`).
     */
    from?: 'journey' | AskFrom;
    /** `next: 'EditProfile'`: the profile to edit (F-LEARN-001 §3.11); `next: 'MyRoute'`: the profile whose page opens read-only; `next: 'PlacementReport'`: whose report opens (F-PLC-001 section 3.9); `next: 'LearnerReport'`: whose progress report opens (F-REPORT-001 section 3.9). */
    profileId?: string;
    /** `next: 'NoteReport'`: the note the report sheet opens for ("Tell a grown-up", F-FEEDBACK-001 section 6.10 item 4). */
    noteId?: string;
  };
  /** Forgot PIN: Rescue Code or a 24-hour wait, then a new PIN (F-LEARN-001 §3.5). `next` is kept for the PIN screen. */
  PinReset: { next: GrownUpDestination; profileId?: string };
  /** sync/restore — rescue code / sign-in / file (F-RESTORE-001, F-SYNC-002). */
  Restore: { from: 'welcome' | 'settings' } | undefined;
  /** sync/save-progress — the Rescue Code, PIN-gated (F-RESTORE-001 §3.3). */
  SaveProgress: undefined;
  /** sync/join-space — enter a class or family code (F-SPACE-001 §3.5). Not PIN-gated. */
  JoinSpace: undefined;
  /** billing/plan-status — the learner Plan screen: status only, no PIN (F-BILL-002 §4.7; F-ENT-003's "Ask a grown-up" still arrives through the gate). */
  Paywall: { from: 'journey' | 'settings' | AskFrom } | undefined;
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
  /**
   * reports/in-app-report — one learner's progress report behind the grown-up gate (F-REPORT-001 section 3.9, RP-9).
   * Registered only while `flags.reportsEnabled` is on. Read-only; with the gate closed the PIN screen replaces it.
   */
  LearnerReport: { profileId: string };
  /** vocab/topics — the Words topic picker (F-VOC-003 section 3.3). */
  VocabTopics: undefined;
  /** vocab/topic — a Words topic page (F-VOC-003 section 3.4). A key the picker does not show is "Topic not found". */
  VocabTopic: { topicKey: string };
  /**
   * vocab/cards — flashcards (F-VOC-003 section 3.5; C-5 registers the screen). `chunk` is 0-based, absent = the
   * suggested chunk; `startId` opens the chunk at that word on its back face (a collected word wall tile).
   */
  VocabCards: { topicKey: string; chunk?: number; startId?: string };
  /** vocab/match — Pic-Word Match on the topic's collected words (F-VOC-003 section 3.9; C-6 registers the screen). */
  VocabMatch: { topicKey: string };
  /** vocab/speed-start — the Speed Round (F-VOC-004 section 3.1; S-5 registers the screen). The topic page launches it. */
  VocabSpeedRound: { topicKey: string; mode?: 'relaxed' | 'challenge' };
  /**
   * notes/list — My notes (F-FEEDBACK-001 section 6.5 item 2, FB-8): the active profile's notes, New then
   * Earlier. Registered only while `flags.notesEnabled` is on. `notice: 'putAway'`: the note page just put a
   * note away, so the list says so once (section 6.10 item 3).
   */
  Notes: { notice?: 'putAway' } | undefined;
  /** notes/detail — one note of the active profile (section 6.5 item 3, FB-8). Opening it marks it read. */
  NoteDetail: { noteId: string };
  /**
   * parent/note-report — the report sheet of one note (section 6.10 item 4). Reached through the gate
   * (`PinEntry { next: 'NoteReport', noteId, profileId }`), or directly from "Report this note" on a
   * self-managed profile. FB-9 registers the screen.
   */
  NoteReport: { noteId: string; profileId: string };
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
   * The learner's Learning Route (AMENDMENTS-ROUTE-LEARNING-ROUTE section 5.1, LR-4): the active profile's
   * page, second in the bar. Mounted only while `flags.myRouteEnabled` is on (`mainTabs`).
   */
  Route: undefined;
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
