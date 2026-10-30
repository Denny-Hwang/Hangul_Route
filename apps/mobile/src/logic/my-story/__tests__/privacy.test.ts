import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CURR_TELEMETRY_PAYLOADS,
  GUEST_TELEMETRY_PAYLOADS,
  OA_TELEMETRY_PAYLOADS,
  ONBOARDING_TELEMETRY_PAYLOADS,
  SHELL_TELEMETRY_PAYLOADS,
  TELEMETRY_EVENT_NAMES,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';

/**
 * F-CURR-001 §5 test P-1, extended to My Story by F-CURR-002 row CM-38 (§7.1 F8, OD-13, §11.1, §13): the text a learner
 * makes is never kept or sent. The renderer, its chunk and entry, and its logic import no telemetry, store, storage,
 * breadcrumb or logger and never navigate with data; no store, persisted slice, snapshot, backup or telemetry name
 * or payload has a place for it. The component tests check the runtime side (the host hears ids and booleans only,
 * the same for any pick; nothing logged or stored; gone after unmount); the Write Frame P-1 test covers the
 * renderer that plays each frame.
 */
const SRC = join(__dirname, '../../..');
const REPO = join(SRC, '../../..');
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');
const files = {
  game: read('screens/minigames/MyStoryGame.tsx'),
  chunk: read('screens/minigames/my-story-chunk.tsx'),
  entry: read('screens/minigames/my-story-entry.tsx'),
  ...Object.fromEntries(readdirSync(join(__dirname, '..')).filter((f) => f.endsWith('.ts')).map((f) => [f, read(`logic/my-story/${f}`)])),
};
const storeDir = join(SRC, 'store');
const stores = readdirSync(storeDir)
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => readFileSync(join(storeDir, f), 'utf8'));
const sync = readFileSync(join(REPO, 'packages/content-schema/src/schemas/sync.ts'), 'utf8');

describe('My Story keeps what is written in the step (test P-1, OD-13)', () => {
  it('covers the renderer, its chunk and entry and its logic', () => {
    expect(Object.keys(files).sort()).toEqual(['chunk', 'e2e-chain.ts', 'entry', 'fallback.ts', 'game', 'page.ts']);
  });

  it('imports no telemetry, store, storage, breadcrumb or logger, and never navigates', () => {
    for (const [name, source] of Object.entries(files)) {
      expect(source, name).not.toMatch(/platform\/telemetry|\btrack\(|\/store\/|platform\/storage|breadcrumb|console\.|localStorage|sessionStorage|indexedDB|AsyncStorage|idb-keyval|Clipboard|Sharing|expo-file-system|\bprint\(/i);
      expect(source, name).not.toMatch(/useNavigation|navigation\.|\.navigate\(|\.push\(|\.replace\(|setParams|history\./);
    }
  });

  it('its only exits are the host: complete() through Done or Skip, and onBack on an empty chain', () => {
    expect(files.game).not.toMatch(/host\.answer|host\.complete/);
    expect(files.game).toMatch(/<WriteFrameGame scope=\{writeScope\} host=\{host\} onBack=\{onBack\} chain=\{chain\} \/>/);
    expect(files.game).toMatch(/onDone=\{finish\}/);
  });

  it('draws the text from the state it is handed and caches none of it', () => {
    expect(files.game).not.toMatch(/useRef<[^>]*(StoryLine|WrittenFrame)|useState<[^>]*(StoryLine|WrittenFrame)|useMemo\([^)]*written/);
    // The one sentence a ref holds is the last one said, for the sound panel's Try again: it goes with the component.
    expect(files.game.match(/useRef<string/g)?.length ?? 0).toBe(1);
    expect(files.game.match(/useRef</g)?.length ?? 0).toBe(2);
    expect(files.game).toMatch(/useRef<Focusable \| null>\(null\)/);
  });

  it('no store, persisted slice, snapshot or backup knows the game', () => {
    for (const source of stores) expect(source).not.toMatch(/my-?story|myStory/i);
    expect(sync).not.toMatch(/my-?story|myStory|story ?text|writeFrame/i);
  });

  it('no telemetry name or payload carries a My Story text: the kind code is the only trace', () => {
    expect(TELEMETRY_EVENT_NAMES.filter((n) => /story/i.test(n) && /my|text|page|frame/i.test(n))).toEqual([]);
    // Every payload registry the client sends against: the zod ones (their shape's keys) and the shell's key lists.
    // A key that could hold a written text or a pick (OA's `picked` is a count of profiles, a whole number).
    const TEXT_KEY = /text|sentence|word|story|^picks?$|^pickedWords?$/i;
    const registries = { CURR_TELEMETRY_PAYLOADS, ONBOARDING_TELEMETRY_PAYLOADS, OA_TELEMETRY_PAYLOADS, GUEST_TELEMETRY_PAYLOADS };
    for (const [registry, payloads] of Object.entries(registries)) {
      expect(Object.keys(payloads).length, registry).toBeGreaterThan(0);
      for (const [name, schema] of Object.entries(payloads)) {
        const keys = Object.keys((schema as { shape?: object }).shape ?? {});
        expect(keys.filter((k) => TEXT_KEY.test(k)), `${registry} ${name}`).toEqual([]);
      }
    }
    for (const [name, keys] of Object.entries(SHELL_TELEMETRY_PAYLOADS)) {
      expect(Object.keys(keys).filter((k) => TEXT_KEY.test(k)), name).toEqual([]);
    }
  });

  it('the core events My Story sends carry codes only: minigame.finished and audio.fallback_shown', () => {
    // The payloads are typed in the app, not in a registry: read them where they are built.
    const finished = read('logic/minigame-finished.ts');
    expect(finished).toMatch(/payload: \{ kind, questId, stepIndex \}/);
    const controller = read('logic/audio/controller.ts');
    expect(controller).toMatch(/name: 'audio\.fallback_shown'; payload: \{ source: string; reason: FallbackReason \}/);
    expect(controller).toMatch(/deps\.emit\(\{ name: 'audio\.fallback_shown', payload: \{ source, reason \} \}\)/);
  });
});
