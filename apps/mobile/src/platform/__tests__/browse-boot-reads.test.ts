import { describe, expect, it, vi } from 'vitest';

/**
 * F-BROWSE-001 section 4.10 (BR-6): during its boot, All lessons reads only
 * `browse:*`, `device:audio`, the device locale key and the shell store's
 * `lastPersona` (read through `shell-store`, outside the app's key/value
 * store). A spy on every storage read across the boot's calls pins it, so a
 * later change to the audio or locale hydrate that reads a `profile*` or any
 * other learner key fails here.
 */
const reads: string[] = [];
const record = async (key: string): Promise<null> => {
  reads.push(key);
  return null;
};

vi.mock('../storage', () => ({
  readJson: vi.fn(record),
  readJsonStrict: vi.fn(record),
  readJsonExact: vi.fn(record),
  listKeys: vi.fn(async () => {
    reads.push('*listKeys*');
    return [];
  }),
  writeJson: vi.fn(async () => undefined),
  removeKey: vi.fn(async () => undefined),
  setWriteFence: vi.fn(),
}));
vi.mock('../browse', () => ({
  readSessionPass: () => null,
  removeSessionPass: () => undefined,
  writeSessionPass: () => true,
}));
vi.mock('../shell-store', () => ({ readLastPersona: async () => null }));
// The platform modules that load react-native: telemetry sends nothing here, and the device locale is English.
vi.mock('../telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../locale', () => ({ deviceLanguages: () => ['en-US'], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));

const { resolveBrowseBoot, BROWSE_KEPT_PASS_KEY, BROWSE_PREFS_KEY } = await import('../browse-boot');
const { useAudioStore, AUDIO_PREFS_KEY } = await import('../../store/audio-store');
const { useLocaleStore } = await import('../../store/locale-store');

describe('the browse boot reads no learner key', () => {
  it('every key read is browse:*, device:audio or the device locale key', async () => {
    await resolveBrowseBoot(Date.parse('2026-10-12T09:00:00.000Z'));
    await useAudioStore.getState().hydrate();
    await useLocaleStore.getState().hydrate([]);
    const allowed = new Set([BROWSE_KEPT_PASS_KEY, BROWSE_PREFS_KEY, AUDIO_PREFS_KEY, 'device:settings']);
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.filter((key) => !allowed.has(key))).toEqual([]);
    expect(reads).toContain(BROWSE_KEPT_PASS_KEY);
    expect(reads).toContain(AUDIO_PREFS_KEY);
    expect(reads).toContain('device:settings');
  });
});
