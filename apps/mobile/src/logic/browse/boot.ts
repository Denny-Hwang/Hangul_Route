import {
  APP_ROUTES,
  decodeBrowseFragment,
  type AdultPersona,
  type BrowsePass,
  type BrowseSource,
  type BrowseTarget,
  type StageKey,
} from '@hangul-route/content-schema';
import { passActive, refreshSeen, type AccessSource, type PassFrom, type ResolvedPass } from './pass';
import type { BrowseEntry, BrowseNote } from './target';

/**
 * What the All lessons root (`/browse`) does with its address, its pass and
 * its first event (F-BROWSE-001 sections 4.1, 4.3, 4.4 and 9). Pure: the
 * caller reads the fragment, the pass and the clock, and acts on the answer
 * (`BrowseApp.tsx`, `platform/browse-env(.web).ts`).
 */

/** The routes of the browse stack (`navigation/browse.tsx`, `BrowseStackParamList`). */
export type BrowseRouteName =
  | 'BrowseHome'
  | 'BrowseEpisode'
  | 'BrowseItem'
  | 'PreviewQuest'
  | 'Minigame'
  | 'StoryReader'
  | 'StorySources'
  | 'CardDetail'
  | 'PreviewEnd'
  | 'BrowseAccess';

export type BrowseSection = 'route' | 'journey' | 'library';

/** Home's params: the section to show, the Journey stage row to scroll to, and the note a deep link may leave. */
export interface BrowseHomeParams {
  section?: BrowseSection;
  stage?: StageKey;
  note?: BrowseNote;
}

/** The routes a deep link or a pass can land on (section 4.4). */
export type BrowseEntryRoute =
  | { name: 'BrowseHome'; params: BrowseHomeParams }
  | { name: 'BrowseEpisode'; params: { episodeId: string } }
  | { name: 'BrowseItem'; params: { kind: 'quest' | 'story' | 'vocab-topic'; id: string; focusJamoId?: string } }
  | { name: 'CardDetail'; params: { cardId: string } }
  | { name: 'BrowseAccess'; params: { reason: 'none' | 'expired'; source: AccessSource } };

export interface BootFragment {
  target: BrowseTarget | null;
  source: BrowseSource;
}

/**
 * The fragment a link carried (`#t=<target>&s=<source>`). A missing or bad
 * fragment opens home as a direct visit: nothing else is logged (section 4.4).
 */
export function readBootFragment(raw: string): BootFragment {
  const decoded = decodeBrowseFragment(raw);
  return decoded.ok ? { target: decoded.target, source: decoded.source } : { target: null, source: 'direct' };
}

export interface BrowseOpenedEvent {
  name: 'browse.opened';
  payload: { source: BrowseSource; scope: 'full' | 'sampler' | 'none'; passFrom: PassFrom | 'none'; offlineReady: boolean };
}

/** `browse.opened` once the root resolved its pass (section 9). It never names a person: no `profileId`, no account. */
export function openedEvent(i: { source: BrowseSource; pass: ResolvedPass; offlineReady: boolean }): BrowseOpenedEvent {
  const { pass } = i;
  const scope = pass.status === 'active' ? pass.scope : 'none';
  const passFrom = pass.status === 'active' ? pass.from : 'none';
  return { name: 'browse.opened', payload: { source: i.source, scope, passFrom, offlineReady: i.offlineReady } };
}

function homeRoute(params: BrowseHomeParams): BrowseEntryRoute {
  return { name: 'BrowseHome', params };
}

/**
 * The stack a resolved entry opens. A page opens over home (so its back goes
 * home), a card over the Library, and the Access screen alone (nothing of a
 * lesson under it). A route this build does not register yet is left out, so
 * the stack never names a missing screen (BR-7 registers the pages).
 */
export function entryStack(entry: BrowseEntry, registered: ReadonlySet<BrowseRouteName>): BrowseEntryRoute[] {
  switch (entry.screen) {
    case 'access':
      return [{ name: 'BrowseAccess', params: { reason: entry.reason, source: entry.source } }];
    case 'home': {
      const params: BrowseHomeParams = {
        ...(entry.section !== null ? { section: entry.section } : {}),
        ...(entry.stage !== undefined ? { stage: entry.stage } : {}),
        ...(entry.note !== undefined ? { note: entry.note } : {}),
      };
      return [homeRoute(params)];
    }
    case 'episode':
      return withPage(homeRoute({}), { name: 'BrowseEpisode', params: { episodeId: entry.episodeId } }, registered);
    case 'item': {
      const params = { kind: entry.kind, id: entry.id, ...(entry.focusJamoId !== undefined ? { focusJamoId: entry.focusJamoId } : {}) };
      return withPage(homeRoute({}), { name: 'BrowseItem', params }, registered);
    }
    case 'card':
      return withPage(homeRoute({ section: 'library' }), { name: 'CardDetail', params: { cardId: entry.cardId } }, registered);
  }
}

function withPage(home: BrowseEntryRoute, page: BrowseEntryRoute, registered: ReadonlySet<BrowseRouteName>): BrowseEntryRoute[] {
  return registered.has(page.name) ? [home, page] : [home];
}

/**
 * The lesson screens of a preview (section 4.7). A pass that runs out while
 * one of them is shown lets the lesson continue to its end screen; the first
 * navigation after that (or into a new lesson) shows the Access screen
 * (section 4.3, gate hand-off step 2).
 */
export const BROWSE_LESSON_ROUTES = ['PreviewQuest', 'Minigame', 'StoryReader', 'StorySources', 'PreviewEnd'] as const satisfies readonly BrowseRouteName[];

/** The screens that are always a step of a lesson under way. */
const LESSON_STEPS: ReadonlySet<string> = new Set<string>(['PreviewQuest', 'Minigame', 'StoryReader']);
const LESSON: ReadonlySet<string> = new Set<string>(BROWSE_LESSON_ROUTES);

/**
 * Whether the visit is inside a lesson that already started once it shows
 * `to`, given whether it was before. The quest, game and story screens are
 * lesson steps. The story sources page is one only when a lesson step opened
 * it: opened from the item page ([ See the sources ], section 4.6) it is a
 * catalogue page, not a preview. Every other screen (the end screen included)
 * ends the lesson. Decided by how the visit got there, not by the route name.
 */
export function lessonAfter(inLesson: boolean, to: BrowseRouteName): boolean {
  if (LESSON_STEPS.has(to)) return true;
  return to === 'StorySources' && inLesson;
}

export interface NavigationCheck {
  /** The session pass with a fresh `seen`, to write back; `null` when nothing needs writing. */
  write: BrowsePass | null;
  /** The pass ran out: resolve again (an active kept pass may take over), else show the Access screen. */
  expired: boolean;
}

/**
 * Every browse navigation (section 4.3): an active session pass gets a fresh
 * `seen` at most once a minute; a session pass that ran out ends the visit at
 * the next navigation, except a step inside a lesson that already started
 * (`inLesson`, from `lessonAfter`) to another lesson screen or its end screen.
 * Only a navigation is activity (`activity`): the first screen of a page load
 * (a reload) and a tab shown again check the pass but refresh no `seen`. A
 * kept pass holds for the tab (it was active when the tab resolved it, and
 * turning the keep switch off keeps it in memory too).
 */
export function navigationCheck(i: {
  resolved: ResolvedPass;
  session: BrowsePass | null;
  now: number;
  inLesson: boolean;
  to: BrowseRouteName;
  activity: boolean;
}): NavigationCheck {
  const { resolved, session, now } = i;
  if (resolved.status !== 'active' || resolved.from === 'kept' || session === null) return { write: null, expired: false };
  if (passActive(session, now)) return { write: i.activity ? refreshSeen(session, now) : null, expired: false };
  return { write: null, expired: !(i.inLesson && LESSON.has(i.to)) };
}

/**
 * A later link (`hashchange`) while the boot still reads the kept pass is left
 * for the boot, which reads the latest fragment when it resolves (nothing is
 * mounted to reset yet); once the pass is resolved, the link resolves again.
 */
export function linkStep(booted: boolean): 'reenter' | 'boot-reads-it' {
  return booted ? 'reenter' : 'boot-reads-it';
}

/**
 * Why the root resolves its pass again: a later link, a session pass that ran
 * out (at a navigation or when the tab is shown), or a page restored from the
 * back/forward cache (a learner page in this tab may have removed the pass).
 */
export type Reentry = 'link' | 'expired' | 'restored';

/**
 * Whether resolving again replaces the stack on screen. A later link always
 * opens its own target. Otherwise the screen stays while a pass is still
 * active (an active kept pass took over from a session pass that ran out, so
 * the destination just tapped stays; or a restored tab's pass still holds),
 * and the Access screen replaces it when none is (section 4.3).
 */
export function reentryResets(why: Reentry, fresh: ResolvedPass): boolean {
  return why === 'link' || fresh.status !== 'active';
}

export type CloseAction = { kind: 'back'; fallbackUrl: string } | { kind: 'assign'; url: string };

const PERSONA_HOME: Readonly<Record<AdultPersona, string>> = {
  parent: APP_ROUTES.parentHome,
  teacher: APP_ROUTES.teacherHome,
};

/** The persona home (`/parent`, `/teach/home`) for the last grown-up persona, else sign-in. Never a learner id. */
export function accountHomeUrl(lastPersona: AdultPersona | null): string {
  return lastPersona ? PERSONA_HOME[lastPersona] : APP_ROUTES.signIn;
}

/**
 * [ Close ] on the catalogue (section 4.1): back to the page the tab came from
 * when it is on this origin and the tab's history has it (`canGoBack`, from
 * `platform/browse-env`); else the persona home for an account pass (sign-in
 * when the persona is not known), and the learner app for a gate or kept pass,
 * which reach no account page (section 8). A back that goes nowhere falls back
 * to the same address (`fallbackUrl`).
 */
export function closeAction(i: { canGoBack: boolean; from: PassFrom; lastPersona: AdultPersona | null }): CloseAction {
  const url = i.from === 'account' ? accountHomeUrl(i.lastPersona) : APP_ROUTES.learn;
  return i.canGoBack ? { kind: 'back', fallbackUrl: url } : { kind: 'assign', url };
}
