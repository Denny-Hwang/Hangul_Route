import type { StageKey } from '@hangul-route/content-schema';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import {
  availableChunks,
  filesToRemove,
  filesToSave,
  fits,
  indexUrls,
  parseOfflinePacks,
  stagePackRows,
  staleLaterUrls,
  type OfflineFile,
  type OfflinePacksIndex,
  type SpaceEstimate,
  type StagePackRow,
} from '../logic/offline/offline-packs';
import * as cache from '../platform/offline-cache';
import { isOnline } from '../platform/online';
import { readJson, writeJson } from '../platform/storage';

/**
 * Save for offline (F-CURR-002 §10 item 4, row CM-5B; wireframe `design/wireframes/pwa/save-for-offline.md`). One per
 * device: Cache Storage is the browser's, not a learner's. It knows which later chunks (a lesson cell's Volume 2, a
 * book 2 tale) are on the device, so a whole-catalogue screen loads only those offline and the lesson page can say,
 * calmly, that a later volume needs the internet the first time; and it saves or removes a stage for the grown-up card.
 * The stages a grown-up chose are kept (`device:offline-saved`) and topped up when a new build arrives, before it
 * applies (`refreshForUpdate`) and again once it runs (`init`), so a saved stage stays saved through an update.
 */

export const CHOSEN_KEY = 'device:offline-saved';

/** How many files are fetched at once. */
const PARALLEL = 4;

export type SaveProblem = 'network' | 'space' | 'notFile';

export interface OfflinePacksState {
  /** `unsupported`: native (nothing to save), or a web page with no worker in control or no index. */
  status: 'idle' | 'loading' | 'ready' | 'unsupported';
  index: OfflinePacksIndex | null;
  /** URLs of the index on the device. */
  cached: ReadonlySet<string>;
  /** The later chunks (by name) on the device. */
  available: ReadonlySet<string>;
  /** The stages a grown-up saved. */
  chosen: readonly StageKey[];
  /** The save or remove in progress. */
  busy: StageKey | 'all' | null;
  /** Bytes saved so far of the save in progress, and its total. */
  progress: { done: number; total: number } | null;
  /** The last save that stopped, and why. */
  problem: { stage: StageKey | 'all'; reason: SaveProblem } | null;
  space: SpaceEstimate | null;
}

export interface OfflinePacksActions {
  /** Reads the index and the caches; drops an older build's chunks and tops up the chosen stages when online. */
  init: () => Promise<void>;
  /** Saves these stages (`all`: every stage of the index). */
  save: (which: StageKey | 'all') => Promise<void>;
  remove: (stage: StageKey) => Promise<void>;
  /** A new build is waiting: save its files of the chosen stages now, while the network is here. */
  refreshForUpdate: () => Promise<void>;
  /** The later chunk is on the device (always true on native, where every chunk is in the bundle). */
  opensOffline: (chunkName: string) => boolean;
  rows: () => StagePackRow[];
}

export interface OfflinePacksDeps {
  native: boolean;
  supported: () => boolean;
  readIndex: (fresh?: boolean) => Promise<unknown>;
  cachedUrls: (urls: readonly string[]) => Promise<Set<string>>;
  saveFile: (file: OfflineFile) => Promise<void>;
  removeFiles: (files: readonly OfflineFile[]) => Promise<void>;
  laterCacheUrls: () => Promise<string[]>;
  dropLaterUrls: (urls: readonly string[]) => Promise<void>;
  spaceEstimate: () => Promise<SpaceEstimate | null>;
  online: () => boolean;
  readChosen: () => Promise<StageKey[] | null>;
  writeChosen: (stages: readonly StageKey[]) => Promise<void>;
}

const reasonOf = (error: unknown): SaveProblem => {
  const r = (error as { reason?: unknown } | null)?.reason;
  return r === 'space' || r === 'notFile' ? r : 'network';
};

export function createOfflinePacksStore(deps: OfflinePacksDeps): StoreApi<OfflinePacksState & OfflinePacksActions> {
  let started: Promise<void> | null = null;

  return createStore<OfflinePacksState & OfflinePacksActions>((set, get) => {
    const recount = async (index: OfflinePacksIndex): Promise<void> => {
      const cached = await deps.cachedUrls(indexUrls(index));
      set({ cached, available: availableChunks(index, cached), space: await deps.spaceEstimate() });
    };

    /** Saves files a few at a time; stops at the first failure. Each saved file counts at once. */
    const saveAll = async (files: readonly OfflineFile[], index: OfflinePacksIndex | null, onBytes: (n: number) => void): Promise<void> => {
      let next = 0;
      const worker = async (): Promise<void> => {
        while (next < files.length) {
          const file = files[next];
          next += 1;
          if (file === undefined) return;
          await deps.saveFile(file);
          onBytes(file.bytes);
          if (index !== null && get().index === index) {
            const cached = new Set(get().cached);
            cached.add(file.url);
            set({ cached, available: availableChunks(index, cached) });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, files.length) }, worker));
    };

    const topUp = async (index: OfflinePacksIndex): Promise<void> => {
      const files = filesToSave(index, get().chosen, get().cached);
      if (files.length === 0) return;
      await saveAll(files, index, () => undefined).catch(() => undefined);
    };

    return {
      status: 'idle',
      index: null,
      cached: new Set(),
      available: new Set(),
      chosen: [],
      busy: null,
      progress: null,
      problem: null,
      space: null,

      init: () => {
        started ??= (async () => {
          if (deps.native || !deps.supported()) {
            set({ status: 'unsupported' });
            return;
          }
          set({ status: 'loading' });
          const [raw, chosen] = await Promise.all([deps.readIndex(false), deps.readChosen().catch(() => null)]);
          const index = parseOfflinePacks(raw);
          if (index === null) {
            set({ status: 'unsupported', chosen: chosen ?? [] });
            return;
          }
          set({ index, chosen: (chosen ?? []).filter((s) => index.stages.some((p) => p.stage === s)) });
          await recount(index);
          set({ status: 'ready' });
          if (!deps.online()) return;
          // An older build's later chunks: this build never asks for them again.
          const stale = staleLaterUrls(await deps.laterCacheUrls(), index);
          if (stale.length > 0) await deps.dropLaterUrls(stale).catch(() => undefined);
          // A chosen stage whose files changed with this build (new content hashes) is saved again.
          await topUp(index);
          set({ space: await deps.spaceEstimate() });
        })().catch(() => {
          set({ status: 'unsupported' });
        });
        return started;
      },

      save: async (which) => {
        const { index, busy } = get();
        if (index === null || busy !== null) return;
        const stages = which === 'all' ? index.stages.map((s) => s.stage) : [which];
        const files = filesToSave(index, stages, get().cached);
        const total = files.reduce((s, f) => s + f.bytes, 0);
        if (!fits(get().space, total)) {
          set({ problem: { stage: which, reason: 'space' } });
          return;
        }
        const chosen = [...new Set([...get().chosen, ...stages])];
        set({ busy: which, problem: null, chosen, progress: { done: 0, total } });
        await deps.writeChosen(chosen).catch(() => undefined);
        let done = 0;
        try {
          await saveAll(files, index, (n) => {
            done += n;
            set({ progress: { done, total } });
          });
        } catch (error) {
          set({ problem: { stage: which, reason: reasonOf(error) } });
        }
        await recount(index).catch(() => undefined);
        set({ busy: null, progress: null });
      },

      remove: async (stage) => {
        const { index, busy } = get();
        if (index === null || busy !== null) return;
        const chosen = get().chosen.filter((s) => s !== stage);
        set({ busy: stage, problem: null, chosen });
        await deps.writeChosen(chosen).catch(() => undefined);
        await deps.removeFiles(filesToRemove(index, stage, chosen)).catch(() => undefined);
        await recount(index).catch(() => undefined);
        set({ busy: null });
      },

      refreshForUpdate: async () => {
        await get().init();
        if (get().status !== 'ready' || get().chosen.length === 0 || !deps.online()) return;
        const next = parseOfflinePacks(await deps.readIndex(true));
        if (next === null) return;
        const cached = await deps.cachedUrls(indexUrls(next));
        const files = filesToSave(next, get().chosen, cached);
        await saveAll(files, null, () => undefined).catch(() => undefined);
      },

      opensOffline: (chunkName) => deps.native || get().available.has(chunkName),

      rows: () => {
        const { index, cached, chosen } = get();
        return index === null ? [] : stagePackRows(index, cached, chosen);
      },
    };
  });
}

export const offlinePacks = createOfflinePacksStore({
  native: cache.EVERY_CHUNK_ON_DEVICE,
  supported: cache.offlineCacheSupported,
  readIndex: cache.readOfflineIndex,
  cachedUrls: cache.cachedUrls,
  saveFile: cache.saveFile,
  removeFiles: cache.removeFiles,
  laterCacheUrls: cache.laterCacheUrls,
  dropLaterUrls: cache.dropLaterUrls,
  spaceEstimate: cache.spaceEstimate,
  online: isOnline,
  readChosen: () => readJson<StageKey[]>(CHOSEN_KEY),
  writeChosen: (stages) => writeJson(CHOSEN_KEY, stages),
});

export function useOfflinePacks<T>(select: (s: OfflinePacksState & OfflinePacksActions) => T): T {
  return useStore(offlinePacks, select);
}
