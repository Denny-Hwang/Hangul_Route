import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { BROWSE_EVENT_NAMES, TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * F-BROWSE-001 §4.10 (BR-3): what the browse root fences. Writes only to
 * `browse:pass`, `browse:prefs`, `browse:telemetry-queue` and `device:audio`;
 * telemetry only for the five `browse.*` names; its own telemetry queue key.
 */
vi.mock('../../config/flags', () => ({
  flags: { voiceEchoEnabled: false, telemetryEnabled: true, telemetryNetwork: true },
}));

const mem = vi.hoisted(() => new Map<string, unknown>());
vi.mock('../storage', () => ({
  readJson: vi.fn(async (k: string) => mem.get(k) ?? null),
  readJsonStrict: vi.fn(async (k: string) => mem.get(k) ?? null),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    mem.set(k, v);
  }),
}));

import { AUDIO_PREFS_KEY } from '../../store/audio-store';
import { BROWSE_TELEMETRY_QUEUE_KEY, BROWSE_WRITABLE_KEYS, applyBrowseFences, isBrowseEventName, isBrowseWritableKey } from '../browse-fences';
import { setWriteFence, setWriteFenceObserver, writePasses } from '../storage-fence';
import { LEARNER_TELEMETRY_QUEUE_KEY, configureTelemetryQueue, setTelemetryFence, track } from '../telemetry';

afterEach(() => {
  setWriteFence(null);
  setWriteFenceObserver(null);
  setTelemetryFence(null);
  configureTelemetryQueue(LEARNER_TELEMETRY_QUEUE_KEY);
  mem.clear();
});

describe('browse fences', () => {
  it('lists exactly the four keys Browse may write', () => {
    expect([...BROWSE_WRITABLE_KEYS]).toEqual(['browse:pass', 'browse:prefs', 'browse:telemetry-queue', 'device:audio']);
    expect(BROWSE_TELEMETRY_QUEUE_KEY).toBe('browse:telemetry-queue');
    expect(BROWSE_WRITABLE_KEYS).toContain(AUDIO_PREFS_KEY);
  });

  it('allows the listed keys only', () => {
    for (const key of BROWSE_WRITABLE_KEYS) expect(isBrowseWritableKey(key), key).toBe(true);
    for (const key of ['telemetry:queue', 'device:settings', 'profiles', 'profiles:active', 'progress:p1', 'account:session', 'settings:p1', 'browse:other', 'shell:lastPersona', 'browse:pass:x']) {
      expect(isBrowseWritableKey(key), key).toBe(false);
    }
  });

  it('allows the five browse.* names and no learner name', () => {
    for (const name of BROWSE_EVENT_NAMES) expect(isBrowseEventName(name), name).toBe(true);
    for (const name of TELEMETRY_EVENT_NAMES.filter((n) => !n.startsWith('browse.'))) expect(isBrowseEventName(name), name).toBe(false);
    expect(isBrowseEventName('browse.unknown')).toBe(false);
  });

  it('applyBrowseFences sets the write fence, the telemetry fence and the browse queue at once', async () => {
    applyBrowseFences();
    expect(writePasses('browse:prefs', 'write')).toBe(true);
    expect(writePasses('progress:p1', 'write')).toBe(false);
    expect(writePasses('telemetry:queue', 'remove')).toBe(false);

    const offline = vi.fn<typeof fetch>(async () => {
      throw new Error('offline');
    });
    expect(await track({ name: 'quest.complete', profileId: 'p1' }, { endpoint: 'https://api.example.com', fetchImpl: offline })).toBe(false);
    expect(offline).not.toHaveBeenCalled();
    await track({ name: 'browse.opened', payload: { source: 'gate' } }, { endpoint: 'https://api.example.com', fetchImpl: offline });
    expect(mem.has('telemetry:queue')).toBe(false);
    expect((mem.get('browse:telemetry-queue') as { name: string }[]).map((e) => e.name)).toEqual(['browse.opened']);
  });
});

/**
 * The fences drop writes silently, so a fence set in the learner app would
 * lose progress with no error. Only browse code (the `/browse` root) may set
 * one: no other module of the app imports `browse-fences` or calls a fence or
 * queue setter. The definers themselves are the exception.
 */
const APP_ROOT = join(__dirname, '..', '..', '..');
const FENCE_CALL = /\b(setWriteFence|setTelemetryFence|configureTelemetryQueue|applyBrowseFences)\s*\(|['"][^'"]*\/browse-fences['"]/;

function appSources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : appSources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Browse code (F-BROWSE-001 section 4.10) and the modules that define the fences. */
function mayFence(file: string): boolean {
  const rel = relative(APP_ROOT, file).split(sep).join('/');
  return (
    /^src\/(screens|logic)\/browse\//.test(rel) ||
    /^(src\/)?BrowseApp\.tsx$/.test(rel) ||
    rel === 'src/navigation/browse.tsx' ||
    /^src\/platform\/browse[^/]*\.tsx?$/.test(rel) ||
    /^src\/platform\/(storage-fence|storage|storage\.web|telemetry)\.ts$/.test(rel)
  );
}

export function fenceCallers(files: readonly string[]): string[] {
  return files.filter((file) => !mayFence(file) && FENCE_CALL.test(readFileSync(file, 'utf8'))).map((file) => relative(APP_ROOT, file));
}

describe('the learner app never sets a fence', () => {
  it('no module outside browse code imports browse-fences or calls a fence or queue setter', () => {
    const files = [join(APP_ROOT, 'App.tsx'), join(APP_ROOT, 'index.ts'), ...appSources(join(APP_ROOT, 'src'))].filter((f) => existsSync(f));
    expect(files.some((f) => f.endsWith(join('src', 'store', 'progress-store.ts')))).toBe(true);
    const callers = fenceCallers(files);
    expect(callers, callers.join('\n')).toEqual([]);
  });

  it('flags a learner module that would set one, and allows browse code', () => {
    const dir = join(APP_ROOT, 'src', 'platform', '__tests__');
    expect(mayFence(join(APP_ROOT, 'src', 'screens', 'browse', 'BrowseHome.tsx'))).toBe(true);
    expect(mayFence(join(APP_ROOT, 'src', 'platform', 'browse-fences.ts'))).toBe(true);
    expect(mayFence(join(APP_ROOT, 'BrowseApp.tsx'))).toBe(true);
    expect(mayFence(join(APP_ROOT, 'App.tsx'))).toBe(false);
    expect(mayFence(join(APP_ROOT, 'src', 'store', 'bootstrap.ts'))).toBe(false);
    expect(mayFence(join(APP_ROOT, 'src', 'screens', 'home', 'HomeScreen.tsx'))).toBe(false);
    for (const line of ["import { applyBrowseFences } from '../platform/browse-fences';", 'setWriteFence(() => true);', "configureTelemetryQueue('x');", 'setTelemetryFence (null);']) {
      expect(FENCE_CALL.test(line), line).toBe(true);
    }
    expect(FENCE_CALL.test('const fenced = writePasses(key);')).toBe(false);
    expect(fenceCallers([join(dir, 'browse-fences.test.ts')])).toEqual([relative(APP_ROOT, join(dir, 'browse-fences.test.ts'))]);
  });
});
