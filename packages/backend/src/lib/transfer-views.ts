import {
  rosterAlias,
  type InboxVisibleSpace,
  type LearnerSlotState,
  type Space,
  type SpaceSettings,
  type TransferBlockReason,
  type TransferEndReason,
  type TransferEndedFrom,
  type TransferInitiator,
  type TransferLearnerRoute,
  type TransferPremiumChange,
  type TransferStepState,
} from '@hangul-route/content-schema';
import type { Db, StoredTransfer, TransferEndActor } from '../db';
import { isEndedTransfer, isOpenTransfer } from '../db/transfer-rules';
import type { Learner } from '../store';
import { learnerContexts } from './access';
import { consentTermsDigest, consentTermsFor, premiumChangeFor } from './transfer';

/*
 * Class-transfer views — F-SPACE-002 section 4.2 "Views". Each party gets its
 * own view, built server-side from ids and live names (a request row stores
 * ids and hashes only). Terminal outcomes never tell a party that did not
 * decide who ended the request or why (anti-shame, CLAUDE.md section 1):
 * every ending reads `ended`, the steps are hidden, and only the decider's
 * own view carries `endedByYou` / its reason. The destination sees initials,
 * picture and level until the move has happened (T8), never the learner id.
 */

/** `ended` stands for declined, cancelled and expired alike, so the status itself never says who decided. */
export type TransferViewStatus = 'requested' | 'approved' | 'executed' | 'ended';

export function viewStatus(t: Pick<StoredTransfer, 'status'>): TransferViewStatus {
  return isEndedTransfer(t) ? 'ended' : (t.status as Exclude<StoredTransfer['status'], 'declined' | 'cancelled' | 'expired'>);
}

const stepOf = (state: string): TransferStepState => (state === 'consented' || state === 'not_required' ? 'yes' : 'waiting');

/** Each side's step as `waiting` / `yes`; null once the request ended (the steps of an ended request would hint who said no). */
export interface TransferSteps {
  learner: TransferStepState;
  source: TransferStepState;
  destination: TransferStepState;
}

function stepsOf(t: StoredTransfer): TransferSteps | null {
  if (isEndedTransfer(t)) return null;
  return { learner: stepOf(t.learner.state), source: stepOf(t.source.state), destination: stepOf(t.destination.state) };
}

/** Fields both class views share. */
interface ClassViewCommon {
  id: string;
  status: TransferViewStatus;
  steps: TransferSteps | null;
  /**
   * "Agreed by the school admin." when this class's own slot was filled through the school cascade (T11,
   * D17): never the other class's, so the destination does not learn that the source agreed (T8).
   */
  agreedBySchoolAdmin: boolean;
  /** The earliest move date, once everyone agreed (`approved`). */
  scheduledFor: string | null;
  /** Why an agreed move is waiting for room (`approved` only). */
  blockReason: TransferBlockReason | null;
  createdAt: string;
  expiresAt: string;
  executedAt: string | null;
  endedAt: string | null;
  /** True only for the side that ended the request. */
  endedByYou: boolean;
  /** The decider's own reason; null for everyone else. */
  endReason: TransferEndReason | null;
}

export interface TransferSourceView extends ClassViewCommon {
  role: 'source';
  initiator: TransferInitiator;
  /** Only on a request this class started, and only before the move. */
  learnerId: string | null;
  /** While the request is open (the learner is still in the class); null afterwards, so history keeps no name. */
  learner: { name: string; avatar: string } | null;
  /** Named only when this class started the request or the learner side chose to introduce it. */
  destination: { spaceId: string; name: string } | null;
}

export interface TransferDestinationView extends ClassViewCommon {
  role: 'destination';
  /** Initials until the move; the roster name (per this class's setting) afterwards. Never the learner id. */
  learner: { name: string; avatar: string; level: string } | null;
  /** The class the learner is coming from, only when the learner side chose to tell. */
  comingFrom: { name: string } | null;
}

export interface DestinationFacts {
  ownerName: string | null;
  schoolName: string | null;
  ageBucket: string | null;
  learnerCount: number;
}

/** What the learner side needs to judge a move (the consent sheet's flags plus `visibleToday`). */
export interface LearnerSideTerms {
  premiumChange: TransferPremiumChange;
  destinationConsentMode: SpaceSettings['consentMode'];
  relinkAffected: boolean;
  sourcePlansAffected: boolean;
  visibleToday: InboxVisibleSpace[];
}

export interface TransferLearnerSideView extends LearnerSideTerms {
  id: string;
  role: 'learner_side';
  status: TransferViewStatus;
  initiator: TransferInitiator;
  learner: { id: string; name: string };
  from: { spaceId: string; name: string };
  to: { spaceId: string; name: string } & DestinationFacts;
  learnerState: LearnerSlotState;
  /** `waiting` on an ended request, so who ended it stays hidden. */
  sourceState: TransferStepState;
  destinationState: TransferStepState;
  introduce: boolean;
  blockReason: TransferBlockReason | null;
  executeAfter: string | null;
  createdAt: string;
  expiresAt: string;
  executedAt: string | null;
  endedAt: string | null;
  learnerRoute: TransferLearnerRoute;
  /** Set only when this side (a guardian or the learner's device) ended it. */
  endedFrom: TransferEndedFrom | null;
  /**
   * The digest of the sheet this view shows (section 4.11), while the learner slot is still to be filled on an
   * open request; an approve of the learner slot sends it back and is refused (`409 terms_changed`) when the
   * live terms moved on. Null once there is nothing left to agree to.
   */
  termsDigest: string | null;
}

/**
 * The class's age, coarse: `days` under a week, `weeks` under two months,
 * `months` under a year, then `years`. Shown with the owner name and learner
 * count so a free-text class name is not the only identity (section 4.11).
 */
export function ageBucket(createdAt: string, now: Date): string | null {
  const ms = now.getTime() - Date.parse(createdAt);
  if (!Number.isFinite(ms)) return null;
  const days = ms / (24 * 60 * 60 * 1000);
  if (days < 7) return 'days';
  if (days < 60) return 'weeks';
  if (days < 365) return 'months';
  return 'years';
}

/** Display names of accounts, never emails; one read per distinct account. */
export async function accountNames(db: Db, ids: Iterable<string>): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (const id of new Set(ids)) out.set(id, (await db.getAccount(id))?.displayName ?? null);
  return out;
}

/** Owner name, school name, class age and learner count of a destination (the learner side only). */
export async function destinationFacts(db: Db, dest: Space, now: Date): Promise<DestinationFacts> {
  const [owner, parent, members] = await Promise.all([db.getAccount(dest.ownerAccountId), dest.parentSpaceId ? db.getSpace(dest.parentSpaceId) : Promise.resolve(null), db.membersOf(dest.id)]);
  return {
    ownerName: owner?.displayName ?? null,
    schoolName: parent?.kind === 'school' ? parent.name : null,
    ageBucket: ageBucket(dest.createdAt, now),
    learnerCount: members.filter((m) => m.memberKind === 'learner').length,
  };
}

/** Every live space that can see the learner today, schools above classes included (section 4.2 `visibleToday`). */
export async function visibleToday(db: Db, learnerId: string): Promise<InboxVisibleSpace[]> {
  const seen = new Set<string>();
  const spaces: Space[] = [];
  for (const ctx of await learnerContexts(db, learnerId)) {
    for (const s of [ctx.space, ctx.parent]) {
      if (s && !s.archivedAt && !seen.has(s.id)) {
        seen.add(s.id);
        spaces.push(s);
      }
    }
  }
  const owners = await accountNames(
    db,
    spaces.map((s) => s.ownerAccountId),
  );
  return spaces.map((s) => ({ kind: s.kind, name: s.name, ownerName: owners.get(s.ownerAccountId) ?? null }));
}

/** A tablet bound through the source's re-link, or a re-link still pending there, would lose its class at the move (section 4.6). */
export async function relinkAffected(db: Db, sourceSpaceId: string, learnerId: string): Promise<boolean> {
  for (const r of await db.relinksOf(sourceSpaceId)) {
    if (r.learnerId !== learnerId) continue;
    if (r.status === 'pending') return true;
    if (r.status === 'approved' && (await db.getDevice(learnerId, r.deviceId))?.scope === 'class') return true;
  }
  return false;
}

/** The source has a live, published plan that reaches this learner: unfinished homework from it goes away. */
export async function sourcePlansAffected(db: Db, sourceSpaceId: string, learnerId: string): Promise<boolean> {
  return (await db.plansOf(sourceSpaceId)).some((p) => p.publishedAt !== null && p.archivedAt === null && (p.targetLearnerIds === null || p.targetLearnerIds.includes(learnerId)));
}

export async function learnerSideTerms(db: Db, learnerId: string, source: Space, dest: Space, now: Date): Promise<LearnerSideTerms> {
  const [premiumChange, relink, plans, visible] = await Promise.all([
    premiumChangeFor(db, learnerId, source.id, dest.id, now),
    relinkAffected(db, source.id, learnerId),
    sourcePlansAffected(db, source.id, learnerId),
    visibleToday(db, learnerId),
  ]);
  return { premiumChange, destinationConsentMode: dest.settings.consentMode, relinkAffected: relink, sourcePlansAffected: plans, visibleToday: visible };
}

const NEUTRAL_TERMS = (dest: Space | undefined): LearnerSideTerms => ({
  premiumChange: 'none',
  destinationConsentMode: dest?.settings.consentMode ?? 'parent',
  relinkAffected: false,
  sourcePlansAffected: false,
  visibleToday: [],
});

/**
 * Whether a live family space with an owner/caregiver account holds the
 * learner: the caregiver route exists (section 4.2, `family_needed`,
 * `learnerRoute`). Says nothing about whether that account may consent.
 */
export async function hasCaregiverRoute(db: Db, learnerId: string): Promise<boolean> {
  for (const m of await db.membershipsOf('learner', learnerId)) {
    const space = await db.getSpace(m.spaceId);
    if (!space || space.kind !== 'family' || space.archivedAt) continue;
    if ((await db.membersOf(space.id)).some((x) => x.memberKind === 'account' && (x.role === 'owner' || x.role === 'caregiver'))) return true;
  }
  return false;
}

/**
 * Who can fill the learner slot right now (section 4.4 `learnerRoute`): the
 * console caregiver route unless the learner manages their own classes or
 * has no caregiver account; the device route only for a learner-started
 * request while device consent is on; `none` when neither can answer.
 */
export function learnerRouteFor(input: { initiator: TransferInitiator; selfManaged: boolean; caregiverRoute: boolean; deviceConsent: boolean }): TransferLearnerRoute {
  if (input.caregiverRoute && !input.selfManaged) return 'caregiver';
  if (input.initiator === 'learner_side' && input.deviceConsent) return 'device';
  return 'none';
}

const endedFromOf = (actor: TransferEndActor | null): TransferEndedFrom | null => (actor === 'family' || actor === 'device' ? actor : null);

/** The shared tail of both class views; `mine` is this class's slot, which is also the end actor that means "this class decided". */
function classCommon(t: StoredTransfer, mine: 'source' | 'destination'): ClassViewCommon {
  const approved = t.status === 'approved';
  const byYou = isEndedTransfer(t) && t.endActor === mine;
  return {
    id: t.id,
    status: viewStatus(t),
    steps: stepsOf(t),
    agreedBySchoolAdmin: t[mine].via === 'school_admin',
    scheduledFor: approved ? t.executeAfter : null,
    blockReason: approved ? t.blockReason : null,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    executedAt: t.executedAt,
    endedAt: t.endedAt,
    endedByYou: byYou,
    endReason: byYou ? t.endReason : null,
  };
}

/**
 * Live names a batch of views needs, read set-based (one call per table, not one per row), and the
 * destination facts of the learner-side views, read once per distinct destination as the views ask.
 */
export interface ViewLookups {
  learners: Map<string, Learner>;
  spaces: Map<string, Space>;
  facts: Map<string, Promise<DestinationFacts>>;
}

export async function viewLookups(db: Db, rows: readonly StoredTransfer[]): Promise<ViewLookups> {
  const learnerIds = new Set(rows.map((t) => t.learnerId));
  const spaceIds = new Set(rows.flatMap((t) => [t.sourceSpaceId, t.destSpaceId]));
  const [learners, spaces] = await Promise.all([db.getLearners([...learnerIds]), db.getSpaces([...spaceIds])]);
  return { learners: new Map(learners.map((l) => [l.id, l])), spaces: new Map(spaces.map((s) => [s.id, s])), facts: new Map() };
}

/**
 * The destination facts of every learner-side view in this batch, read
 * set-wise: three reads (owners, parents, members) whatever the number of
 * distinct destinations, so a long history cannot spend the D1 per-invocation
 * statement budget (T-5c review). `factsOnce` then finds them all.
 */
export async function primeDestinationFacts(db: Db, look: ViewLookups, rows: readonly StoredTransfer[], now: Date): Promise<void> {
  const dests = [...new Set(rows.map((t) => t.destSpaceId))].flatMap((id) => {
    const s = look.spaces.get(id);
    return s && !look.facts.has(id) ? [s] : [];
  });
  if (dests.length === 0) return;
  const parentIds = dests.flatMap((d) => (d.parentSpaceId ? [d.parentSpaceId] : []));
  const [owners, parents, members] = await Promise.all([
    db.getAccounts(dests.map((d) => d.ownerAccountId)),
    db.getSpaces(parentIds),
    db.membersOfSpaces(dests.map((d) => d.id)),
  ]);
  const ownerById = new Map(owners.map((a) => [a.id, a]));
  const parentById = new Map(parents.map((s) => [s.id, s]));
  for (const dest of dests) {
    const parent = dest.parentSpaceId ? parentById.get(dest.parentSpaceId) : undefined;
    look.facts.set(
      dest.id,
      Promise.resolve({
        ownerName: ownerById.get(dest.ownerAccountId)?.displayName ?? null,
        schoolName: parent?.kind === 'school' ? parent.name : null,
        ageBucket: ageBucket(dest.createdAt, now),
        learnerCount: members.filter((m) => m.spaceId === dest.id && m.memberKind === 'learner').length,
      }),
    );
  }
}

/** `destinationFacts` once per destination per batch of views. */
function factsOnce(db: Db, dest: Space, look: ViewLookups, now: Date): Promise<DestinationFacts> {
  const known = look.facts.get(dest.id);
  if (known) return known;
  const facts = destinationFacts(db, dest, now);
  look.facts.set(dest.id, facts);
  return facts;
}

/** The roster name a space shows (F-TCH-001 section 10.3 anonymize). */
const shownName = (space: Space | undefined, displayName: string): string => (space?.settings.anonymizeRoster ? rosterAlias(displayName) : displayName);

export function sourceView(t: StoredTransfer, look: ViewLookups): TransferSourceView {
  const open = isOpenTransfer(t);
  const learner = look.learners.get(t.learnerId);
  const source = look.spaces.get(t.sourceSpaceId);
  const dest = look.spaces.get(t.destSpaceId);
  return {
    ...classCommon(t, 'source'),
    role: 'source',
    initiator: t.initiator,
    learnerId: open && t.initiator === 'source' ? t.learnerId : null,
    learner: open && learner ? { name: shownName(source, learner.displayName), avatar: learner.avatar } : null,
    destination: dest && (t.initiator === 'source' || t.introduce) ? { spaceId: dest.id, name: dest.name } : null,
  };
}

export function destinationView(t: StoredTransfer, look: ViewLookups): TransferDestinationView {
  const learner = look.learners.get(t.learnerId);
  const dest = look.spaces.get(t.destSpaceId);
  const source = look.spaces.get(t.sourceSpaceId);
  const name = learner ? (t.status === 'executed' ? shownName(dest, learner.displayName) : rosterAlias(learner.displayName)) : null;
  return {
    ...classCommon(t, 'destination'),
    role: 'destination',
    learner: learner && name !== null ? { name, avatar: learner.avatar, level: learner.ageGroup } : null,
    comingFrom: t.introduce && source ? { name: source.name } : null,
  };
}

/** Per-learner facts the learner-side view needs besides the row. */
export interface LearnerSideContext {
  /** The family the view is built for (its roster setting names the learner). */
  family: Space | null;
  selfManaged: boolean;
  caregiverRoute: boolean;
  deviceConsent: boolean;
  now: Date;
}

/**
 * The learner side's view (a guardian in the console; T-5c reuses it for the
 * inbox). Open requests carry the live terms of the consent sheet; an ended
 * or executed one carries neutral terms, since nothing is left to agree to.
 */
export async function learnerSideView(db: Db, t: StoredTransfer, look: ViewLookups, ctx: LearnerSideContext): Promise<TransferLearnerSideView> {
  const learner = look.learners.get(t.learnerId);
  const source = look.spaces.get(t.sourceSpaceId);
  const dest = look.spaces.get(t.destSpaceId);
  const ended = isEndedTransfer(t);
  const live = isOpenTransfer(t) && source && dest ? { source, dest } : null;
  const terms = live ? await learnerSideTerms(db, t.learnerId, live.source, live.dest, ctx.now) : NEUTRAL_TERMS(dest);
  const termsDigest = live && t.learner.state === 'pending' ? await learnerSheetDigest(db, t.learnerId, live.source, live.dest, terms, ctx.now) : null;
  const facts: DestinationFacts = dest ? await factsOnce(db, dest, look, ctx.now) : { ownerName: null, schoolName: null, ageBucket: null, learnerCount: 0 };
  return {
    id: t.id,
    role: 'learner_side',
    status: viewStatus(t),
    initiator: t.initiator,
    learner: { id: t.learnerId, name: learner ? shownName(ctx.family ?? undefined, learner.displayName) : '?' },
    from: { spaceId: t.sourceSpaceId, name: source?.name ?? '?' },
    to: { spaceId: t.destSpaceId, name: dest?.name ?? '?', ...facts },
    learnerState: t.learner.state,
    sourceState: ended ? 'waiting' : stepOf(t.source.state),
    destinationState: ended ? 'waiting' : stepOf(t.destination.state),
    introduce: t.introduce,
    ...terms,
    blockReason: t.status === 'approved' ? t.blockReason : null,
    executeAfter: ended ? null : t.executeAfter,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    executedAt: t.executedAt,
    endedAt: t.endedAt,
    learnerRoute: learnerRouteFor({ initiator: t.initiator, selfManaged: ctx.selfManaged, caregiverRoute: ctx.caregiverRoute, deviceConsent: ctx.deviceConsent }),
    endedFrom: ended ? endedFromOf(t.endActor) : null,
    termsDigest,
  };
}

/** The digest of a learner-side sheet, from the same terms the sheet shows (`premiumChange` computed once). */
export async function learnerSheetDigest(db: Db, learnerId: string, source: Space, dest: Space, sheet: LearnerSideTerms, now: Date): Promise<string> {
  const terms = await consentTermsFor(db, learnerId, source, dest, now, sheet.premiumChange);
  return consentTermsDigest(terms, { premiumChange: sheet.premiumChange, destinationConsentMode: sheet.destinationConsentMode, relinkAffected: sheet.relinkAffected, sourcePlansAffected: sheet.sourcePlansAffected });
}
