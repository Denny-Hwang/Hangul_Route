import type { InboxNote, NotePrefs, NoteReactionId, NoteReportReason } from '@hangul-route/content-schema';
import { create } from 'zustand';
import { applyInbox } from '../logic/notes/apply';
import { enqueueReport, enqueueState, flushOrder, outcomeOf, settleWrite } from '../logic/notes/queue';
import { notesKey, readStoredNotes } from '../logic/notes/stored';
import { emptyNotes, type NoteAttest, type NotesData, type PendingWrite } from '../logic/notes/types';
import { readJson, removeKey, writeJson } from '../platform/storage';
import type { DeviceCredentials, SyncApiClient } from '../platform/sync-api';
import { onProfileRemoved } from './profile-removal';

/**
 * Notes from grown-ups, per learner profile (F-FEEDBACK-001 section 6.9). Persisted through
 * `platform/storage` only, under `notes:<profileId>`, and removed with the profile. Reads and
 * reactions are written here first and queued; the membership store flushes the queue before each
 * inbox read and applies the inbox's notes after it (`flags.notesEnabled`). Siblings on one device
 * each have their own record. Put away is device state: it is never sent.
 */
interface State {
  byProfile: Record<string, NotesData>;
}

/** The parts of the sync client the flush uses. */
export type NotesClient = Pick<SyncApiClient, 'putNoteState' | 'reportNote'>;

interface Actions {
  hydrate: (profileId: string) => Promise<NotesData>;
  /** Apply one inbox; `removed` names notes that left (a note page open on one closes gently). */
  applyInbox: (profileId: string, inbox: { notes: InboxNote[]; notePrefs: NotePrefs }) => Promise<{ added: string[]; removed: string[] }>;
  /** Opening the note page marks it read once (local first, queued). */
  markRead: (profileId: string, noteId: string, now?: Date) => Promise<void>;
  /** The learner's one-tap answer; the last pick wins (local first, queued). */
  pickReaction: (profileId: string, noteId: string, reaction: NoteReactionId, now?: Date) => Promise<void>;
  /** Hide a note on this device only; nothing is sent (section 6.10 item 3). */
  putAway: (profileId: string, noteId: string) => Promise<void>;
  /** Queue a report; the note is hidden on this device at once (section 6.9). */
  queueReport: (profileId: string, noteId: string, reason: NoteReportReason, attest?: NoteAttest, now?: Date) => Promise<void>;
  /** The grown-up answered the one-time class-notes card on this device. */
  markClassNotesCardSeen: (profileId: string) => Promise<void>;
  /** Send the queued writes, reports first; stops at the first network failure. */
  flush: (profileId: string, client: NotesClient, creds: DeviceCredentials) => Promise<void>;
  /** Drop a removed profile's notes from memory and storage. */
  forgetProfile: (profileId: string) => void;
}

const persist = (profileId: string, data: NotesData): void => {
  writeJson(notesKey(profileId), data).catch(() => undefined);
};

export const useNotesStore = create<State & Actions>((set, get) => {
  const loading = new Map<string, Promise<NotesData>>();
  const flushing = new Map<string, Promise<void>>();

  /** Change one profile's record in memory and storage; `undefined` from `change` leaves it as it is. */
  const update = (profileId: string, change: (current: NotesData) => NotesData | undefined): void => {
    const current = get().byProfile[profileId] ?? emptyNotes();
    const next = change(current);
    if (next === undefined || next === current) return;
    set((s) => ({ byProfile: { ...s.byProfile, [profileId]: next } }));
    persist(profileId, next);
  };

  const hydrate = (profileId: string): Promise<NotesData> => {
    const existing = get().byProfile[profileId];
    if (existing) return Promise.resolve(existing);
    const pending = loading.get(profileId);
    if (pending) return pending;
    const load = readJson<unknown>(notesKey(profileId))
      .then((raw) => {
        // A write that landed while the read was pending is newer than the stored copy.
        const arrived = get().byProfile[profileId];
        if (arrived) return arrived;
        const data = readStoredNotes(raw);
        set((s) => ({ byProfile: { ...s.byProfile, [profileId]: data } }));
        return data;
      })
      .finally(() => loading.delete(profileId));
    loading.set(profileId, load);
    return load;
  };

  const send = async (profileId: string, write: PendingWrite, client: NotesClient, creds: DeviceCredentials): Promise<number> => {
    const result =
      write.kind === 'report'
        ? await client.reportNote(profileId, write.noteId, { reason: write.reason, ...(write.attest ? { attest: write.attest } : {}) }, creds)
        : await client.putNoteState(profileId, write.noteId, { ...(write.read ? { read: true } : {}), ...(write.reaction ? { reaction: write.reaction } : {}) }, creds);
    return result.http;
  };

  return {
    byProfile: {},

    hydrate,

    applyInbox: async (profileId, inbox) => {
      await hydrate(profileId);
      let outcome = { added: [] as string[], removed: [] as string[] };
      update(profileId, (current) => {
        const result = applyInbox(current, inbox);
        outcome = { added: result.added, removed: result.removed };
        return result.data;
      });
      return outcome;
    },

    markRead: async (profileId, noteId, now = new Date()) => {
      await hydrate(profileId);
      update(profileId, (current) => {
        const note = current.notes.find((n) => n.id === noteId);
        if (!note || note.readAt !== null) return undefined;
        const at = now.toISOString();
        return {
          ...current,
          notes: current.notes.map((n) => (n.id === noteId ? { ...n, readAt: at } : n)),
          queue: enqueueState(current.queue, noteId, { read: true }, at),
        };
      });
    },

    pickReaction: async (profileId, noteId, reaction, now = new Date()) => {
      await hydrate(profileId);
      update(profileId, (current) => {
        const note = current.notes.find((n) => n.id === noteId);
        if (!note || note.reaction === reaction) return undefined;
        return {
          ...current,
          notes: current.notes.map((n) => (n.id === noteId ? { ...n, reaction } : n)),
          queue: enqueueState(current.queue, noteId, { reaction }, now.toISOString()),
        };
      });
    },

    putAway: async (profileId, noteId) => {
      await hydrate(profileId);
      update(profileId, (current) =>
        current.putAway.includes(noteId) || !current.notes.some((n) => n.id === noteId) ? undefined : { ...current, putAway: [...current.putAway, noteId] },
      );
    },

    queueReport: async (profileId, noteId, reason, attest, now = new Date()) => {
      await hydrate(profileId);
      update(profileId, (current) =>
        current.notes.some((n) => n.id === noteId) ? { ...current, queue: enqueueReport(current.queue, noteId, reason, attest, now.toISOString()) } : undefined,
      );
    },

    markClassNotesCardSeen: async (profileId) => {
      await hydrate(profileId);
      update(profileId, (current) => (current.classNotesCardSeen ? undefined : { ...current, classNotesCardSeen: true }));
    },

    flush: (profileId, client, creds) => {
      const running = flushing.get(profileId);
      if (running) return running;
      const run = (async () => {
        const data = await hydrate(profileId);
        for (const write of flushOrder(data.queue)) {
          const http = await send(profileId, write, client, creds);
          update(profileId, (current) => settleWrite(current, write, outcomeOf(http)));
          if (http === -1) break; // offline: the rest waits for the next sync
        }
      })().finally(() => flushing.delete(profileId));
      flushing.set(profileId, run);
      return run;
    },

    forgetProfile: (profileId) => {
      set((s) => {
        const rest = { ...s.byProfile };
        delete rest[profileId];
        return { byProfile: rest };
      });
      removeKey(notesKey(profileId)).catch(() => undefined);
    },
  };
});

onProfileRemoved((profileId) => useNotesStore.getState().forgetProfile(profileId));
