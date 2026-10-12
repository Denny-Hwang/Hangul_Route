import type { Episode, FreeLessonsFacts, LearnerMembership, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { CursorContext } from './cursor-context';
import type { Tier } from './entitlement';
import { nextQuestAfter, offerableQuests } from './next-quest';
import type { PaywallState } from './paywall';
import type { DeviceAudience } from './profiles/learner-type';

/**
 * The lines F-ENT-003 adds to F-BILL-002's learner Plan screen (F-ENT-003 section 3.9.1, row E3-8;
 * wireframe billing/plan-status-free-lessons; slots of design/screens/billing/plan-status.md).
 * Words only: no price, no offer, no button, no link. Everything here shows only while the
 * effective switch (`gatingActive`) is on; with it off the screen is F-BILL-002's, unchanged
 * (OD-2, D5). Every figure comes from `freeLessonsFacts` and the build's bundle, never typed.
 */

/** What the screen reads for these lines, gathered by the screen from the stores. */
export interface FreePlanContext {
  /** `gatingActive(flags, bundleOs())`: the web app with the switch on. */
  gatingActive: boolean;
  /** `freeLessonsFacts(CATALOG)`; null when it could not be read (the line is hidden). */
  facts: Pick<FreeLessonsFacts, 'lessons' | 'letters' | 'minutes'> | null;
  /** Sampler stories in this build's bundle (`freeExtrasCount`). */
  stories: number;
  /** Free word topics this build lists (`freeExtrasCount`). */
  topics: number;
  /** The learner's only space memberships are classes or schools (`classOnlyMember`). */
  classOnly: boolean;
  /** The learner finished everything open on the free plan (`freeEndOnCursor`). */
  freeEnd: boolean;
  /** The learner has a plan to follow: an inbox plan or an active self plan (`sourcesOf`). */
  hasPlan: boolean;
}

export interface PlanFreeLinesInput {
  state: PaywallState;
  audience: DeviceAudience;
  /** The learner's name as the title shows it (the fallback already applied). */
  name: string;
  /** `Platform.OS`: only `web` gets the grown-up page line. */
  platform: string;
  /** Null: no F-ENT-003 data (today's screen). */
  context: FreePlanContext | null;
}

/** The free slot under the free title: the main line, the What is free list and one situation line. */
export interface FreeSlot {
  line: string | null;
  list: readonly string[];
  extra: string | null;
}

export interface PlanFreeLines {
  /** Null outside the free state. */
  free: FreeSlot | null;
  /** The guidance slot under the full-route lines; empty unless the switch is on and no plan exists. */
  guidance: readonly string[];
}

export function planFreeLines(input: PlanFreeLinesInput, m: Messages['caregiver']['plan']): PlanFreeLines {
  const ctx = input.context;
  const on = ctx !== null && ctx.gatingActive;
  const family = input.audience === 'family';
  const guidance =
    on && input.state === 'premium' && !ctx.hasPlan ? [m.freePlan.setPlan, ...(input.platform === 'web' ? [m.freePlan.setPlanWeb] : [])] : [];
  if (input.state !== 'free') return { free: null, guidance };
  if (!on) return { free: { line: m.free.open, list: [], extra: null }, guidance };

  const facts = ctx.facts;
  const line =
    facts === null || facts.lessons <= 0
      ? null
      : facts.letters > 0
        ? m.freePlan.line(facts.lessons, facts.letters, facts.minutes)
        : m.freePlan.lineNoLetters(facts.lessons, facts.minutes);
  const list = [...(ctx.stories > 0 ? [m.freePlan.stories(ctx.stories)] : []), ...(ctx.topics > 0 ? [m.freePlan.topics(ctx.topics)] : [])];
  const extra = ctx.classOnly
    ? family
      ? m.freePlan.classLine.family(input.name)
      : m.freePlan.classLine.self
    : ctx.freeEnd
      ? family
        ? m.freePlan.freeEnd.family(input.name)
        : m.freePlan.freeEnd.self
      : null;
  return { free: { line, list, extra }, guidance };
}

/** `freeLessonsFacts` read safely: a read that throws hides the line (the wireframe's Error state). */
export function readFreeFacts(read: () => FreeLessonsFacts): FreeLessonsFacts | null {
  try {
    return read();
  } catch {
    return null;
  }
}

/** The learner's only space memberships are classes or schools (no family space, at least one space). */
export function classOnlyMember(memberships: readonly Pick<LearnerMembership, 'kind'>[] | undefined): boolean {
  return memberships !== undefined && memberships.length > 0 && memberships.every((ms) => ms.kind !== 'family');
}

export interface FreeEndInput {
  gatingActive: boolean;
  /** The access tier (`accessTier`), never a billing tier. */
  tier: Tier;
  snapshot: ProgressSnapshot;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  /** `cursorContext(...)` with the learner's `isQuestOpen`. */
  cursor: CursorContext;
}

/**
 * F-ENT-003 section 3.5 steps 3 and 4, on the one cursor: with the switch on and a free access
 * tier, the cursor has nothing new left that is open (placed-out quests skipped, as step 3 sends a
 * placed-out free learner to free-end) and some playable grid lesson is closed. `routeNext` (row
 * E3-4, not on main yet) owns the full rule with plan sources; once it lands the screen reads
 * `routeNext(...).kind === 'free-end'` instead and this helper goes.
 */
export function freeEndOnCursor(input: FreeEndInput): boolean {
  if (!input.gatingActive || input.tier !== 'free') return false;
  const open = input.cursor.isQuestOpen;
  if (!open) return false;
  const next = nextQuestAfter({ snapshot: input.snapshot, quests: input.quests, episodes: input.episodes, ...input.cursor });
  if (next) return false;
  return offerableQuests(input.quests, input.episodes, input.cursor.isEntitled).some((q) => !open(q.id));
}
