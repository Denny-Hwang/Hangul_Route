import type { DeviceTransferConsent, DeviceTransferCreateBody, InboxTransfer, LearnerMembership, SyncInbox } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { flags } from '../config/flags';
import { routeGoalInputsChanged } from '../logic/my-route/summary';
import type { JoinErrorCode } from '../logic/spaces/join-code';
import type { RestorePlan } from '../logic/sync/restore';
import { getDeviceId } from '../platform/device';
import { readJson, writeJson } from '../platform/storage';
import { TRANSFER_SCOPE_KEY, classScopeMarker, deviceScopeOf } from '../logic/transfers/device-scope';
import { validateDisplayName } from '../logic/profiles/profile-model';
import type { DeviceCredentials, DeviceTransferPreview, RosterName, SyncApiClient, TransferCallError } from '../platform/sync-api';
import { track } from '../platform/telemetry';
import { useAccountStore } from './account-store';
import { useNotesStore } from './notes-store';
import { usePlanStore } from './plan-store';
import { useProfileStore } from './profile-store';
import { useRouteStore } from './route-store';
import { useClassUpdateStore } from './class-update-store';
import { useTierStore } from './tier-store';
import { onSynced, syncApi, useSyncStore } from './sync-store';

/**
 * A learner's spaces on this device — F-SPACE-001 §3.5. Cached locally,
 * refreshed from the sync inbox; join / leave go through the device
 * principal, so a learner that never synced is registered first.
 */
interface State {
  byLearner: Record<string, LearnerMembership[]>;
  /**
   * Class moves from the last inbox (F-SPACE-002 section 4.12). In memory only, never persisted: an
   * offline device cannot show a stale prompt it could answer. Executed moves are left out.
   */
  transfersByLearner: Record<string, LearnerTransfers>;
  /** A move this device saw happen, for the one-off "Moved." line (`app-sheets.md`); null once shown. */
  movedByLearner: Record<string, InboxTransfer | null>;
  /** The class tablet of the old class lost its classes (a 401 after the move): "Join your new class again." */
  rejoinByLearner: Record<string, boolean>;
  /** Executed moves already handled in this session, keyed `learnerId|transferId`. */
  executedSeen: Record<string, true>;
}

/** The inbox's transfer fields for one learner, plus this device's scope (section 4.4, T15). */
export interface LearnerTransfers {
  enabled: boolean;
  deviceConsent: boolean;
  selfManaged: boolean;
  scope: 'full' | 'class';
  requests: InboxTransfer[];
}

/** A class-move call's answer; refusals keep the Worker's code (`off` = no API in this build, `network` = no credentials or no network). */
export type TransferFailure = { ok: false; error: string; startedBy?: 'class' | 'learner_side'; retryAfterSeconds?: number };
export type TransferPreviewOutcome = { ok: true; preview: DeviceTransferPreview } | TransferFailure;
export type TransferRequestOutcome = { ok: true; request: InboxTransfer } | TransferFailure;

/** The device's scope marker for a learner (`logic/transfers/device-scope.ts`). */
export { TRANSFER_SCOPE_KEY };
/**
 * Whether the last inbox said moves are on for this learner. Only this switch is kept across restarts (no request,
 * no prompt): a class tablet revoked while the app was closed still learns on its first read that it must join again.
 */
export const TRANSFERS_ON_KEY = (learnerId: string): string => `transfers-on:${learnerId}`;
/**
 * Set when this device turned the learner switch on (guard 13). Only that device turns it off again, when its
 * profile is no longer a consented self profile, so two devices with different profile types never flip it back and forth.
 */
export const TRANSFER_SELF_SET_KEY = (learnerId: string): string => `transfer-self-set:${learnerId}`;

export type LookupOutcome =
  | { ok: true; space: { id: string; kind: LearnerMembership['kind']; name: string }; full: boolean; roster: RosterName[] }
  | { ok: false; error: JoinErrorCode };

export type RelinkError = 'code_not_found' | 'code_expired' | 'learner_not_found' | 'already_bound' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown' | 'off';
export type RelinkOutcome = { ok: true; requestId: string; expiresAt: string } | { ok: false; error: RelinkError };
export type RelinkPoll =
  | { state: 'pending' | 'denied' | 'expired' }
  | { state: 'approved'; plan: RestorePlan }
  | { state: 'error'; error: 'network' | 'not_found' | 'unknown' | 'off' };

export type JoinOutcome = { ok: true; alreadyMember: boolean; membership: LearnerMembership } | { ok: false; error: JoinErrorCode };

interface Actions {
  hydrate: (learnerId: string) => Promise<LearnerMembership[]>;
  /** Pull the learner's memberships from the inbox; null when offline / never synced / no API. */
  refresh: (learnerId: string) => Promise<LearnerMembership[] | null>;
  lookup: (code: string) => Promise<LookupOutcome>;
  join: (learnerId: string, spaceId: string, code: string, displayName?: string) => Promise<JoinOutcome>;
  leave: (learnerId: string, spaceId: string) => Promise<boolean>;
  /** Ask the teacher to bind this device to an existing roster learner (F-TCH-001 §10.1). */
  requestRelink: (spaceId: string, code: string, learnerId: string) => Promise<RelinkOutcome>;
  /** Poll the request; on approval the learner is adopted on this device. */
  pollRelink: (spaceId: string, requestId: string) => Promise<RelinkPoll>;
  // Class moves from this device (F-SPACE-002 sections 4.4, 4.12). Online only: consent is never queued.
  previewMove: (learnerId: string, fromSpaceId: string, code: string) => Promise<TransferPreviewOutcome>;
  startMove: (learnerId: string, body: DeviceTransferCreateBody) => Promise<TransferRequestOutcome>;
  approveMove: (learnerId: string, transferId: string, consent: DeviceTransferConsent) => Promise<TransferRequestOutcome>;
  declineMove: (learnerId: string, transferId: string) => Promise<TransferRequestOutcome>;
  cancelMove: (learnerId: string, transferId: string) => Promise<TransferRequestOutcome>;
  /** The one-off "Moved." line was shown. */
  clearMoved: (learnerId: string) => void;
  /** The one-off "Join your new class again." line was shown. */
  clearRejoin: (learnerId: string) => void;
  /**
   * Whether this device holds the learner's class-scoped credential (a class tablet after a re-link): there the server
   * refuses profile edits, so Edit profile keeps the name, level and cub as they are (F-LEARN-001 section 3.11).
   */
  deviceScope: (learnerId: string) => Promise<'full' | 'class'>;
}

const key = (learnerId: string): string => `memberships:${learnerId}`;

async function credentialsFor(learnerId: string, registerIfNeeded: boolean): Promise<DeviceCredentials | null> {
  const sync = useSyncStore.getState();
  let state = await sync.hydrate(learnerId);
  if (!state.secret && registerIfNeeded) state = await sync.syncNow(learnerId);
  return state.secret ? { deviceId: await getDeviceId(), secret: state.secret } : null;
}

function failure(r: TransferCallError): TransferFailure {
  const out: TransferFailure = { ok: false, error: r.code };
  if (r.startedBy) out.startedBy = r.startedBy;
  if (r.retryAfterSeconds !== undefined) out.retryAfterSeconds = r.retryAfterSeconds;
  return out;
}

/**
 * The profile name is the learner's one name (F-LEARN-001 section 3.11): the Worker writes the join name over the
 * learner's name for the family and every class, so a join under a changed name changes the profile too, and the
 * edit goes to the server the way any profile edit does. A name the profile rule refuses, or the same name, changes nothing.
 */
function adoptJoinName(learnerId: string, displayName: string | undefined): void {
  if (displayName === undefined || validateDisplayName(displayName) !== null) return;
  const name = displayName.trim();
  const profile = useProfileStore.getState().profiles.find((p) => p.id === learnerId);
  if (!profile || profile.displayName === name) return;
  useProfileStore.getState().updateProfile(learnerId, { displayName: name });
}

const OFF: TransferFailure = { ok: false, error: 'off' };
const NO_CREDENTIALS: TransferFailure = { ok: false, error: 'network' };

/** The device's scope for this learner, from the marker tied to its current secret. */
async function scopeOf(learnerId: string, creds: DeviceCredentials): Promise<'full' | 'class'> {
  return deviceScopeOf(await readJson<unknown>(TRANSFER_SCOPE_KEY(learnerId)), creds.secret);
}

/**
 * An executed move whose memberships in the same answer still show the old class: an older Worker moved the learner
 * after reading them (the current one settles first). After the swap the learner is never in the source, so a move this
 * device saw open is stale whenever the source is still there, even if the learner had also joined the destination by
 * code meanwhile (behaviour 25); for a move never seen open, only when the destination is missing too.
 */
const membershipsBeforeMove = (t: InboxTransfer, rows: readonly LearnerMembership[], seenOpen: boolean): boolean =>
  rows.some((m) => m.spaceId === t.from.spaceId) && (seenOpen || !rows.some((m) => m.spaceId === t.to.spaceId));

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _drop, ...rest } = record;
  return rest;
}

export const useMembershipStore = create<State & Actions>((set, get) => {
  const put = (learnerId: string, rows: LearnerMembership[]): LearnerMembership[] => {
    const sorted = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: sorted } }));
    void writeJson(key(learnerId), sorted);
    // Access fails open for a member the server has not answered for yet (F-ENT-003 section 3.4 rule 3).
    useTierStore.getState().noteSpaces(learnerId, sorted.length);
    return sorted;
  };


  /**
   * The inbox read behind `refresh`. `again` is the one extra read after a move the Worker made while
   * answering (its memberships, plans and tier were read before the move), so it never loops.
   */
  async function refreshInbox(learnerId: string, again: boolean): Promise<LearnerMembership[] | null> {
    const client: SyncApiClient | null = syncApi();
    // No inbox this time: the horizon still moves with the calendar, from the cached plans (F-PLAN-002 section 3.6).
    const offline = async (): Promise<null> => {
      await rederiveLocal(learnerId);
      return null;
    };
    if (!client) return offline();
    const creds = await credentialsFor(learnerId, false);
    if (!creds) return offline();
    // Queued note reads, reactions and reports go first, so this inbox already reflects them (F-FEEDBACK-001 section 6.9).
    // A notes problem never holds up the inbox: tier, memberships and plans still apply.
    if (flags.notesEnabled) await useNotesStore.getState().flush(learnerId, client, creds).catch(() => undefined);
    const result = await client.getInbox(learnerId, creds);
    if (result.status !== 'ok') {
      // After a move the old class's tablet is revoked (section 4.6): its classes are gone until it joins again.
      // Only while the inbox says moves are on, so nothing changes for a learner while transfers are locked.
      if (result.code === 'http_401' && (await transfersWereOn(learnerId)) && (await scopeOf(learnerId, creds)) === 'class') {
        // Only the transition is news: once the classes and plans are gone, later 401s change nothing and the
        // one-off "Join your new class again." line stays dismissed.
        const held = (get().byLearner[learnerId] ?? (await readJson<LearnerMembership[]>(key(learnerId))) ?? []).length > 0 || (usePlanStore.getState().byLearner[learnerId] ?? []).length > 0;
        if (held) {
          put(learnerId, []);
          // Its class plans go with the classes: this device gets no other inbox to clear them.
          await usePlanStore.getState().applyPlans(learnerId, []);
          set((s) => ({ rejoinByLearner: { ...s.rejoinByLearner, [learnerId]: true } }));
        }
        set((s) => ({ transfersByLearner: withoutKey(s.transfersByLearner, learnerId) }));
      }
      return offline();
    }
    const rows = put(learnerId, result.inbox.memberships);
    // The server decides premium from memberships (F-ENT-001 §3.4); cache it with its grace window.
    useTierStore.getState().applyInbox(learnerId, result.inbox);
    // [TV] The class update and the move notices ride the same inbox (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.3).
    useClassUpdateStore.getState().applyInbox(learnerId, result.inbox);
    // Plans ride the same inbox (F-PLAN-001 §3.3): derive homework, then push the change back.
    const before = usePlanStore.getState().byLearner[learnerId];
    const applied = await usePlanStore.getState().applyPlans(learnerId, result.inbox.plans);
    // A plan change that moves only the Learning Route goal (or the first inbox, before which the goal is left out) is sent too.
    if (applied.changed || routeGoalInputsChanged(before, result.inbox.plans)) useSyncStore.getState().requestSync(learnerId);
    // Notes from grown-ups ride the same inbox, which is authoritative for which notes exist.
    if (flags.notesEnabled) await useNotesStore.getState().applyInbox(learnerId, { notes: result.inbox.notes, notePrefs: result.inbox.notePrefs });
    const reread = await applyTransfers(learnerId, result.inbox, rows, client, creds, again);
    return reread ?? rows;
  }

  /**
   * The transfer fields of an inbox (section 4.12): kept in memory, executed moves handled once, and the
   * learner switch sent when a self profile and the server disagree. Answers the memberships of an extra
   * read when the move happened during this one; null otherwise.
   */
  async function applyTransfers(learnerId: string, inbox: SyncInbox, rows: LearnerMembership[], client: SyncApiClient, creds: DeviceCredentials, again: boolean): Promise<LearnerMembership[] | null> {
    // An older Worker (or a test double) may send none of these fields; read them as off and empty.
    const raw = inbox as Partial<Pick<SyncInbox, 'transfers' | 'transfersEnabled' | 'transferDeviceConsent' | 'selfManaged' | 'deviceScope'>>;
    const all: readonly InboxTransfer[] = raw.transfers ?? [];
    const enabled = raw.transfersEnabled ?? false;
    const deviceConsent = raw.transferDeviceConsent ?? false;
    let selfManaged = raw.selfManaged ?? false;
    // The Worker says which credential this is (T-5c), so a tablet a class relinked before this build is known as one.
    // An older Worker sends nothing (null): the marker stands as it is.
    const marked = await scopeOf(learnerId, creds);
    if (raw.deviceScope === 'class' && marked !== 'class') await writeJson(TRANSFER_SCOPE_KEY(learnerId), classScopeMarker(creds.secret));
    if (raw.deviceScope === 'full' && marked === 'class') await writeJson(TRANSFER_SCOPE_KEY(learnerId), null);
    const scope = raw.deviceScope ?? marked;
    const previous = get().transfersByLearner[learnerId];
    const before = previous?.requests ?? [];
    if (previous?.enabled !== enabled) await writeJson(TRANSFERS_ON_KEY(learnerId), enabled);
    set((s) => ({
      transfersByLearner: {
        ...s.transfersByLearner,
        [learnerId]: { enabled, deviceConsent, selfManaged, scope, requests: all.filter((t) => t.status !== 'executed') },
      },
    }));

    let reread = false;
    for (const t of all) {
      const seenKey = `${learnerId}|${t.id}`;
      if (t.status !== 'executed' || get().executedSeen[seenKey]) continue;
      set((s) => ({ executedSeen: { ...s.executedSeen, [seenKey]: true } }));
      const seenOpen = before.some((b) => b.id === t.id);
      const stale = membershipsBeforeMove(t, rows, seenOpen);
      // A move done long ago (already in the memberships, never seen open here) is not news.
      if (!stale && !seenOpen) continue;
      set((s) => ({ movedByLearner: { ...s.movedByLearner, [learnerId]: t } }));
      void track({ name: 'space.transfer.completed', payload: {} });
      if (stale) reread = true;
    }

    // The learner's own switch (guard 13, sections 4.2 and 4.11): sent on only for a self profile whose self consent
    // was given on this device (spec A11). It is sent off only by the device that turned it on, once its profile is no
    // longer a consented self profile; any other device (a family tablet with a child profile, a relinked profile with
    // no type) leaves the learner's own choice alone, so two devices never flip it back and forth.
    const profile = useProfileStore.getState().profiles.find((p) => p.id === learnerId);
    const consentedSelf = profile?.learnerType === 'self' && useAccountStore.getState().selfConsentAcceptedAt !== null;
    const setHere = (await readJson<unknown>(TRANSFER_SELF_SET_KEY(learnerId))) === true;
    const wanted = consentedSelf ? true : setHere && profile !== undefined && profile.learnerType !== undefined ? false : null;
    // The mark is written before the on switch is sent (and when the server already has it on for this consented self
    // profile), so a lost answer never leaves this device unable to turn it off later.
    if (enabled && scope === 'full' && consentedSelf && !setHere && (selfManaged || deviceConsent)) await writeJson(TRANSFER_SELF_SET_KEY(learnerId), true);
    // On is accepted only while moves can be agreed on a device (T-5c); off always is.
    const sendable = wanted === false || deviceConsent;
    if (enabled && scope === 'full' && wanted !== null && wanted !== selfManaged && sendable) {
      const sent = await client.putTransferPrefs(learnerId, { selfManaged: wanted }, creds);
      if (sent.status === 'ok') {
        selfManaged = sent.selfManaged;
        if (!wanted) await writeJson(TRANSFER_SELF_SET_KEY(learnerId), false);
        set((s) => {
          const current = s.transfersByLearner[learnerId];
          return current ? { transfersByLearner: { ...s.transfersByLearner, [learnerId]: { ...current, selfManaged } } } : {};
        });
      } else {
        await noteScopeLimited(learnerId, creds, sent);
      }
    }

    if (!reread || again) return null;
    // Plans and access switch at once: read the inbox again and send the snapshot.
    useSyncStore.getState().requestSync(learnerId);
    return refreshInbox(learnerId, true);
  }

  /** Moves were on at the last inbox: in this session, or as the last session left it. */
  async function transfersWereOn(learnerId: string): Promise<boolean> {
    const known = get().transfersByLearner[learnerId];
    if (known) return known.enabled;
    return (await readJson<unknown>(TRANSFERS_ON_KEY(learnerId))) === true;
  }

  /** The API and this device's credentials for a move call, or why there are none (never registers: a move needs a synced learner). */
  async function moveClient(learnerId: string): Promise<{ client: SyncApiClient; creds: DeviceCredentials } | TransferFailure> {
    const client = syncApi();
    if (!client) return OFF;
    const creds = await credentialsFor(learnerId, false);
    return creds ? { client, creds } : NO_CREDENTIALS;
  }

  /** A route that answers `scope_limited` proves this device is class-scoped. */
  async function noteScopeLimited(learnerId: string, creds: DeviceCredentials, r: TransferCallError): Promise<void> {
    if (r.code === 'scope_limited') await writeJson(TRANSFER_SCOPE_KEY(learnerId), classScopeMarker(creds.secret));
  }

  /** Approve, decline or cancel a request, report it without a profile id, then read the inbox again. */
  async function answerMove(
    learnerId: string,
    send: (client: SyncApiClient, creds: DeviceCredentials) => ReturnType<SyncApiClient['cancelTransfer']>,
    event: Parameters<typeof track>[0] | ((request: InboxTransfer) => Parameters<typeof track>[0] | null),
  ): Promise<TransferRequestOutcome> {
    const ready = await moveClient(learnerId);
    if ('ok' in ready) return ready;
    const result = await send(ready.client, ready.creds);
    if (result.status !== 'ok') {
      await noteScopeLimited(learnerId, ready.creds, result);
      return failure(result);
    }
    const report = typeof event === 'function' ? event(result.request) : event;
    if (report) void track(report);
    await get().refresh(learnerId);
    return { ok: true, request: result.request };
  }

  return {
    byLearner: {},
    transfersByLearner: {},
    movedByLearner: {},
    rejoinByLearner: {},
    executedSeen: {},

    hydrate: async (learnerId) => {
      const existing = get().byLearner[learnerId];
      if (existing) return existing;
      const saved = (await readJson<LearnerMembership[]>(key(learnerId))) ?? [];
      // Rows a refresh or a join put while the read was pending are newer than the saved copy.
      const arrived = get().byLearner[learnerId];
      if (arrived) return arrived;
      set((s) => ({ byLearner: { ...s.byLearner, [learnerId]: saved } }));
      useTierStore.getState().noteSpaces(learnerId, saved.length);
      return saved;
    },

    refresh: (learnerId) => refreshInbox(learnerId, false),

    previewMove: async (learnerId, fromSpaceId, code) => {
      const ready = await moveClient(learnerId);
      if ('ok' in ready) return ready;
      const result = await ready.client.previewTransfer(learnerId, { fromSpaceId, code }, ready.creds);
      if (result.status === 'ok') return { ok: true, preview: result.preview };
      await noteScopeLimited(learnerId, ready.creds, result);
      return failure(result);
    },

    startMove: async (learnerId, body) => {
      const ready = await moveClient(learnerId);
      if ('ok' in ready) return ready;
      const result = await ready.client.createTransfer(learnerId, body, ready.creds);
      if (result.status !== 'ok') {
        await noteScopeLimited(learnerId, ready.creds, result);
        return failure(result);
      }
      // A repeated create (a lost answer) returns the same request: it is reported once.
      if (result.created) {
        void track({ name: 'space.transfer.requested', payload: { initiator: 'learner_side' } });
        void track({ name: 'space.transfer.consented', payload: { slot: 'learner', basis: 'device_attested' } });
      }
      await get().refresh(learnerId);
      return { ok: true, request: result.request };
    },

    approveMove: (learnerId, transferId, consent) => {
      // Tie the record to the sheet the device showed (4.11): the inbox row carries its digest while the slot is pending.
      const row = get().transfersByLearner[learnerId]?.requests.find((t) => t.id === transferId);
      const shown = row?.termsDigest ?? null;
      const tied: DeviceTransferConsent = consent.termsDigest === undefined && shown !== null ? { ...consent, termsDigest: shown } : consent;
      // The Worker answers a resent approve unchanged (200, section 4.4): reported only when this call filled the slot.
      const wasPending = row?.learnerState === 'pending';
      return answerMove(learnerId, (client, creds) => client.approveTransfer(learnerId, transferId, { consent: tied }, creds), (request) =>
        wasPending && request.learnerState === 'consented' ? { name: 'space.transfer.consented', payload: { slot: 'learner', basis: 'device_attested' } } : null,
      );
    },

    declineMove: (learnerId, transferId) => answerMove(learnerId, (client, creds) => client.declineTransfer(learnerId, transferId, creds), { name: 'space.transfer.declined', payload: { slot: 'learner' } }),

    cancelMove: (learnerId, transferId) => answerMove(learnerId, (client, creds) => client.cancelTransfer(learnerId, transferId, creds), { name: 'space.transfer.cancelled', payload: {} }),

    clearMoved: (learnerId) => set((s) => ({ movedByLearner: { ...s.movedByLearner, [learnerId]: null } })),

    clearRejoin: (learnerId) => set((s) => ({ rejoinByLearner: { ...s.rejoinByLearner, [learnerId]: false } })),

    deviceScope: async (learnerId) => {
      const creds = await credentialsFor(learnerId, false);
      return creds ? scopeOf(learnerId, creds) : 'full';
    },

    lookup: async (code) => {
      const client = syncApi();
      if (!client) return { ok: false, error: 'off' };
      const result = await client.lookupSpace(code);
      return result.status === 'ok' ? { ok: true, space: result.space, full: result.full, roster: result.roster } : { ok: false, error: result.code };
    },

    join: async (learnerId, spaceId, code, displayName) => {
      const client = syncApi();
      if (!client) return { ok: false, error: 'off' };
      void track({ name: 'space.join.attempted', profileId: learnerId });
      const creds = await credentialsFor(learnerId, true);
      if (!creds) {
        void track({ name: 'space.join.failed', profileId: learnerId, payload: { reason: 'network' } });
        return { ok: false, error: 'network' };
      }
      const result = await client.joinSpace(spaceId, { code, learnerId, displayName }, creds);
      if (result.status !== 'ok') {
        void track({ name: 'space.join.failed', profileId: learnerId, payload: { reason: result.code } });
        return { ok: false, error: result.code };
      }
      const current = await get().hydrate(learnerId);
      put(learnerId, [...current.filter((m) => m.spaceId !== result.membership.spaceId), result.membership]);
      void track({ name: 'space.join.succeeded', profileId: learnerId, payload: { kind: result.membership.kind, alreadyMember: result.alreadyMember } });
      adoptJoinName(learnerId, displayName);
      // The join changes the server's tier and plans for this learner: read them now, not at the next sync
      // (F-ENT-003 section 3.4). A failed read leaves the join as it is; the next sync tries again.
      await get().refresh(learnerId);
      return { ok: true, alreadyMember: result.alreadyMember, membership: result.membership };
    },

    requestRelink: async (spaceId, code, learnerId) => {
      const client = syncApi();
      if (!client) return { ok: false, error: 'off' };
      void track({ name: 'space.relink.requested', profileId: learnerId });
      const result = await client.createRelink(spaceId, { code, learnerId, deviceId: await getDeviceId() });
      return result.status === 'ok' ? { ok: true, requestId: result.requestId, expiresAt: result.expiresAt } : { ok: false, error: result.code };
    },

    pollRelink: async (spaceId, requestId) => {
      const client = syncApi();
      if (!client) return { state: 'error', error: 'off' };
      const result = await client.pollRelink(spaceId, requestId, await getDeviceId());
      if (result.status !== 'ok') return { state: 'error', error: result.code };
      if (result.state !== 'approved') {
        if (result.state === 'denied') void track({ name: 'space.relink.denied', profileId: undefined });
        return { state: result.state };
      }
      const plan = await useSyncStore.getState().adoptServerLearner({ learner: result.learner, secret: result.secret, snapshot: result.snapshot });
      // A class re-link mints a class-scoped device (F-TCH-001 section 10.1): it can never start or answer a move.
      await writeJson(TRANSFER_SCOPE_KEY(result.learner.id), classScopeMarker(result.secret));
      void track({ name: 'space.relink.approved', profileId: result.learner.id });
      await get().refresh(result.learner.id);
      return { state: 'approved', plan };
    },

    leave: async (learnerId, spaceId) => {
      const client = syncApi();
      const creds = client ? await credentialsFor(learnerId, false) : null;
      if (!client || !creds) return false;
      const result = await client.leaveSpace(spaceId, learnerId, creds);
      if (result.status !== 'ok') return false;
      const current = await get().hydrate(learnerId);
      put(learnerId, current.filter((m) => m.spaceId !== spaceId));
      void track({ name: 'space.left', profileId: learnerId });
      return true;
    },
  };
});

/**
 * Derive a learner's homework again from the cached plans and the self-route,
 * with no network, and push the change when there is one. The horizon of a
 * curriculum moves with the calendar, so a device that is offline, cannot
 * sync or has no account still gets each new week (F-PLAN-002 section 3.6
 * rule 1, section 3.11).
 */
export async function rederiveLocal(learnerId: string): Promise<boolean> {
  const outcome = await usePlanStore.getState().rederive(learnerId);
  if (outcome?.changed) useSyncStore.getState().requestSync(learnerId);
  return outcome?.changed ?? false;
}

/**
 * The automatic re-pace of a learner's own weekly plan (F-PLAN-002 section 3.7: at most once a
 * UTC day, never during a session), only while `flags.routeEnabled` is on. It runs on the newest
 * copy: after a successful sync merged the server's plan (a stale device never brings back a plan
 * stopped or replaced on another one), or straight away on a build without sync. A moved plan is
 * pushed. True when it moved.
 */
export async function repaceAfterSync(learnerId: string): Promise<boolean> {
  if (!flags.routeEnabled) return false;
  const moved = await useRouteStore
    .getState()
    .autoRepace(learnerId)
    .catch(() => false);
  if (moved && syncApi()) useSyncStore.getState().requestSync(learnerId);
  return moved;
}

/**
 * `rederiveLocal` for every learner on the device: app start and back in the foreground. When a
 * learner's own weekly plan is due to move along, it syncs first and the re-pace runs once the sync
 * merged (`repaceAfterSync` from `onSynced`). A sync that does not get through (offline, an error,
 * a conflict to retry later) never holds the plan back: the re-pace runs on this copy, and the
 * stopped-or-replaced rule of the merge keeps a later sync right (section 3.7). Without sync it
 * runs here.
 */
export async function rederiveAllLocal(): Promise<void> {
  const learners = useProfileStore.getState().profiles.filter((p) => p.role === 'learner');
  for (const p of learners) {
    await rederiveLocal(p.id);
    if (!flags.routeEnabled) continue;
    if (!syncApi()) {
      await repaceAfterSync(p.id);
      continue;
    }
    const due = await useRouteStore
      .getState()
      .repaceDue(p.id)
      .catch(() => false);
    if (!due) continue;
    const synced = await useSyncStore
      .getState()
      .syncNow(p.id)
      .then((r) => r.status === 'synced')
      .catch(() => false);
    if (!synced) await repaceAfterSync(p.id);
  }
}

/** After every successful sync (call once at app start; returns the unsubscribe): refresh the inbox, then move an own weekly plan along when due. */
export function registerInboxRefresh(): () => void {
  return onSynced((learnerId) => {
    void useMembershipStore.getState().refresh(learnerId);
    void repaceAfterSync(learnerId);
  });
}

/**
 * A learner's device credentials, or null before the first sync (F-FEEDBACK-001 FB-9: the grown-up
 * zone's hide, report and note-prefs calls). Never registers a device.
 */
export const deviceCredentialsFor = (learnerId: string): Promise<DeviceCredentials | null> => credentialsFor(learnerId, false);
