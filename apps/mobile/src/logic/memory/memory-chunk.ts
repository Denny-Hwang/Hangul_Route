import { mergeCellBest, mergeLatchRecord } from '@hangul-route/content-schema';
import { episodeById } from '../../content/episodes';
import { lessonContent } from '../../content/lessons';
import { reviewItemsChunk } from '../../content/review-items';
import { flags } from '../../config/flags';
import { getDeviceId } from '../../platform/device';
import { readJsonExact, removeKey, writeJson } from '../../platform/storage';
import { apiBaseUrl } from '../../platform/sync-api';
import { track } from '../../platform/telemetry';
import { useAudioStore } from '../../store/audio-store';
import { useProfileStore } from '../../store/profile-store';
import { useProgressStore } from '../../store/progress-store';
import { currFlagOn } from '../../store/remote-config-store';
import { useSyncStore } from '../../store/sync-store';
import { questOpenFor, useTierStore } from '../../store/tier-store';
import { CONTENT_OVERLAYS } from '../content-locale';
import { createCellCheckApi, type CellCheckApi } from '../reviews/cell-check-api';
import { createDailyReviewApi, type DailyReviewApi } from '../reviews/daily-review-api';
import { planQuestTryAgain, planQuestWarmup, type ReviewInputs, type TryAgainRequest, type WarmupRequest } from '../reviews/quest-review-planner';
import { createReviewItemStore } from '../reviews/review-items-store';
import { notifyProgressPersisted } from '../sync/persist-hook';
import { localDay } from '../vocab/progress';
import { memoryRecordsFor, recordAnswers } from './boot';
import { createMemoryRuntime, type MemoryRuntime } from './memory-runtime';
import { seedSnapshot } from './seed';

/**
 * The memory store's chunk (F-CURR-002 §10, row CM-12): reached only through the literal `import()`
 * of `./boot.ts`, so Metro emits it as its own precached web bundle (`memory-chunk-<md5>.js`) and
 * the start bundle carries none of it. Wires the runtime to the app's stores, storage, network and
 * telemetry.
 */

/** The chunk's marker: the post-build check finds it in this chunk and never in the start bundle. */
export const MEMORY_CHUNK = 'memory-chunk:runtime';

/** The review items of this build, loaded once (the lazy `review-items` chunk of row CM-10). */
export const reviewItemStore = createReviewItemStore(reviewItemsChunk);

let runtime: MemoryRuntime | null = null;

export function memoryRuntime(): MemoryRuntime {
  runtime ??= createMemoryRuntime({
    now: () => new Date(),
    dayOf: localDay,
    items: () => reviewItemStore.ensure(),
    // Exact: a stored value that does not parse throws, so the runtime never takes it for "nothing stored" and writes over it.
    read: (key) => readJsonExact<unknown>(key),
    write: (key, value) => writeJson(key, value),
    remove: (key) => removeKey(key),
    hydrate: (profileId) => useProgressStore.getState().hydrate(profileId),
    snapshot: (profileId) => (useProgressStore.getState().hydratedFor.has(profileId) ? useProgressStore.getState().byProfile[profileId] : undefined),
    applySeed: (profileId, seed) => {
      // On the hydrated snapshot only; saved and synced like any write (the merge keeps the earliest seeding).
      const progress = useProgressStore.getState();
      const snap = progress.hydratedFor.has(profileId) ? progress.byProfile[profileId] : undefined;
      if (!snap || !useProfileStore.getState().profiles.some((p) => p.id === profileId)) return null;
      const seeded = seedSnapshot(snap, seed);
      if (seeded !== snap) {
        progress.replaceSnapshot(profileId, seeded);
        notifyProgressPersisted(profileId);
      }
      return useProgressStore.getState().byProfile[profileId]?.memSeededAt ?? null;
    },
    applyCellBest: (profileId, rises) => {
      // Row CM-20: the derived levels latched on the hydrated snapshot, merged by max (a level never drops).
      const progress = useProgressStore.getState();
      const snap = progress.hydratedFor.has(profileId) ? progress.byProfile[profileId] : undefined;
      if (!snap || !useProfileStore.getState().profiles.some((p) => p.id === profileId)) return null;
      const cellBest = mergeCellBest(snap.cellBest, Object.fromEntries(rises.map((r) => [r.cellId, r.level]))) ?? {};
      progress.replaceSnapshot(profileId, { ...snap, cellBest });
      notifyProgressPersisted(profileId);
      return useProgressStore.getState().byProfile[profileId]?.cellBest ?? cellBest;
    },
    recordVocab: (profileId, events, now) => useProgressStore.getState().recordVocab(profileId, events, now),
    serverTime: (profileId) => useTierStore.getState().byLearner[profileId]?.fetchedAt ?? null,
    profileHere: (profileId) => useProfileStore.getState().profiles.some((p) => p.id === profileId),
    track: (event) => void track(event),
    requestSync: (profileId) => useSyncStore.getState().requestSync(profileId),
    net: () => {
      const base = apiBaseUrl();
      if (!base || !flags.syncEnabled) return null;
      return {
        base,
        fetch: (input, init) => globalThis.fetch(input, init),
        creds: async (learnerId) => {
          const secret = (await useSyncStore.getState().hydrate(learnerId)).secret;
          return secret ? { deviceId: await getDeviceId(), secret } : null;
        },
      };
    },
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  });
  return runtime;
}

let dailyReview: DailyReviewApi | null = null;

/**
 * The Daily Review's reads and writes (F-CURR-002 row CM-14), here with the review engine so no scheduler module is
 * shared by two chunks. The screen's chunk and Home reach it through `memoryChunk()` of `./boot.ts`.
 */
export function dailyReviewApi(): DailyReviewApi {
  dailyReview ??= createDailyReviewApi({
    file: (profileId) => memoryRuntime().file(profileId),
    ensureSeeded: (profileId) => memoryRuntime().ensureSeeded(profileId),
    items: () => reviewItemStore.ensure(),
    // With answers not recorded the review would repeat itself, so `memoryRecord` gates it too (daily-review.md).
    on: (profileId) => memoryRecordsFor(profileId) && currFlagOn('dailyReview', profileId),
    visibility: (profileId) => ({ volumes: currFlagOn('volumes', profileId), topicPacks: currFlagOn('topicPacks', profileId), pack: (key) => currFlagOn(`pack.${key}`, profileId) }),
    voice: () => {
      const audio = useAudioStore.getState();
      return audio.tts.state === 'ready' && !audio.muted;
    },
    hydrate: (profileId) => useProgressStore.getState().hydrate(profileId),
    reviews: (profileId) => useProgressStore.getState().byProfile[profileId]?.reviews,
    vocab: (profileId) => useProgressStore.getState().byProfile[profileId],
    recordReview: (profileId, entry) => void useProgressStore.getState().recordReview(profileId, entry),
    recordAnswers: (profileId, answers) => recordAnswers(profileId, answers),
    track: (event) => void track(event),
    overlays: (locale) => CONTENT_OVERLAYS[locale],
    ensureCell: (cell) => lessonContent.ensureCells([cell]),
    random: () => Math.random(),
  });
  return dailyReview;
}

let cellCheck: CellCheckApi | null = null;

/**
 * The Cell Check and its test-out (F-CURR-002 row CM-21), here beside the Daily Review's API and the review engine, so
 * the screen's chunk (`screens/cell-check/cell-check-chunk.tsx`) shares no module with this one.
 */
export function cellCheckApi(): CellCheckApi {
  cellCheck ??= createCellCheckApi({
    file: (profileId) => memoryRuntime().file(profileId),
    ensureSeeded: (profileId) => memoryRuntime().ensureSeeded(profileId),
    items: () => reviewItemStore.ensure(),
    // With answers not recorded a Check could latch a result while no memory state moved (cell-check.md States).
    on: (profileId) => memoryRecordsFor(profileId) && currFlagOn('cellCheck', profileId),
    visibility: (profileId) => ({ volumes: currFlagOn('volumes', profileId), topicPacks: currFlagOn('topicPacks', profileId), pack: (key) => currFlagOn(`pack.${key}`, profileId) }),
    voice: () => {
      const audio = useAudioStore.getState();
      return audio.tts.state === 'ready' && !audio.muted;
    },
    hydrate: (profileId) => useProgressStore.getState().hydrate(profileId),
    snapshot: (profileId) => useProgressStore.getState().byProfile[profileId],
    recordReview: (profileId, entry) => void useProgressStore.getState().recordReview(profileId, entry),
    recordAnswers: (profileId, answers) => recordAnswers(profileId, answers),
    recordTestOut: (profileId, answers, passed, at) => (memoryRecordsFor(profileId) ? memoryRuntime().recordTestOut(profileId, answers, passed, at) : Promise.resolve()),
    latch: (profileId, field, keys, at) => {
      // On the hydrated snapshot only, merged earliest-wins (a latch never moves later); saved and synced like any write.
      // A Stage Jump's keys (its cells and the stage key, row CM-25) go in one write.
      const progress = useProgressStore.getState();
      const snap = progress.hydratedFor.has(profileId) ? progress.byProfile[profileId] : undefined;
      if (!snap) return;
      const merged = mergeLatchRecord(snap[field], Object.fromEntries(keys.map((key) => [key, at]))) ?? {};
      if (keys.every((key) => snap[field]?.[key] === merged[key])) return;
      progress.replaceSnapshot(profileId, { ...snap, [field]: merged });
      notifyProgressPersisted(profileId);
    },
    testOutCell: (profileId, cellId) => {
      // The cell page's offer rules, read again by the session (F-ENT-003: the same access as playing the cell).
      const episode = episodeById(cellId);
      if (!episode) return null;
      const snap = useProgressStore.getState().byProfile[profileId];
      const open = questOpenFor(profileId, new Date(), snap);
      const ids = new Set(episode.questIds);
      const started = snap?.testedOut?.[cellId] !== undefined || (snap?.quests ?? []).some((q) => ids.has(q.questId) && (q.stars > 0 || Boolean(q.completedAt)));
      return { stage: episode.stage, open: episode.questIds.map(open), started };
    },
    serverTime: (profileId) => useTierStore.getState().byLearner[profileId]?.fetchedAt ?? null,
    track: (event) => void track(event),
    overlays: (locale) => CONTENT_OVERLAYS[locale],
    ensureCell: (cell) => lessonContent.ensureCells([cell]),
  });
  return cellCheck;
}

/** A learner's stored rows and the review items, for the review surfaces; null when the store cannot be read. */
const reviewInputs: ReviewInputs = async (profileId) => {
  const [index, file] = await Promise.all([reviewItemStore.ensure(), memoryRuntime().file(profileId)]);
  return file ? { index, rows: file.rows } : null;
};

/**
 * The quest warm-up and Try these again (F-CURR-002 row CM-15), planned here beside the review engine and the
 * store they read, so the sessions' own chunk (`screens/quest/quest-review-chunk.tsx`) shares no module with
 * this one. Reached through `questReviewPlanner` of the boot module.
 */
export const questReviewPlanner = {
  warmup: (input: WarmupRequest) => planQuestWarmup(reviewInputs, input),
  again: (input: TryAgainRequest) => planQuestTryAgain(reviewInputs, input),
  /** Reads what the plans read, so a plan asked for soon after is quick; a failed read is only a slower plan. */
  preload: (profileId: string): Promise<void> => reviewInputs(profileId).then(
    () => undefined,
    () => undefined,
  ),
};
