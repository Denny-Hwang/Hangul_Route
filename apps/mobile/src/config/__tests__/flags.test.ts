import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

async function reload(): Promise<typeof import('../flags')> {
  vi.resetModules();
  return import('../flags');
}

describe('flags', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('launch defaults: voice-echo OFF, telemetry ON, network ON', async () => {
    delete process.env.EXPO_PUBLIC_VOICE_ECHO_ENABLED;
    delete process.env.EXPO_PUBLIC_TELEMETRY_ENABLED;
    delete process.env.EXPO_PUBLIC_TELEMETRY_NETWORK;
    const mod = await reload();
    expect(mod.flags.voiceEchoEnabled).toBe(false);
    expect(mod.flags.telemetryEnabled).toBe(true);
    expect(mod.flags.telemetryNetwork).toBe(true);
    expect(mod.launchDefaultFlags.voiceEchoEnabled).toBe(false);
  });

  it('voiceEchoEnabled flips on with "true"', async () => {
    process.env.EXPO_PUBLIC_VOICE_ECHO_ENABLED = 'true';
    const mod = await reload();
    expect(mod.flags.voiceEchoEnabled).toBe(true);
  });

  it('voiceEchoEnabled flips on with "1"', async () => {
    process.env.EXPO_PUBLIC_VOICE_ECHO_ENABLED = '1';
    const mod = await reload();
    expect(mod.flags.voiceEchoEnabled).toBe(true);
  });

  it('telemetryEnabled flips off with "false"', async () => {
    process.env.EXPO_PUBLIC_TELEMETRY_ENABLED = 'false';
    const mod = await reload();
    expect(mod.flags.telemetryEnabled).toBe(false);
  });

  it('telemetryNetwork flips off with "0"', async () => {
    process.env.EXPO_PUBLIC_TELEMETRY_NETWORK = '0';
    const mod = await reload();
    expect(mod.flags.telemetryNetwork).toBe(false);
  });

  it('unrecognized values fall back to the launch default', async () => {
    process.env.EXPO_PUBLIC_VOICE_ECHO_ENABLED = 'maybe';
    const mod = await reload();
    expect(mod.flags.voiceEchoEnabled).toBe(false);
  });

  it('content gating and unreviewed stories are OFF by default', async () => {
    delete process.env.EXPO_PUBLIC_CONTENT_GATING_ENABLED;
    delete process.env.EXPO_PUBLIC_SHOW_UNREVIEWED_STORIES;
    const mod = await reload();
    expect(mod.flags.contentGatingEnabled).toBe(false);
    expect(mod.flags.showUnreviewedStories).toBe(false);
    expect(mod.launchDefaultFlags.contentGatingEnabled).toBe(false);
    expect(mod.launchDefaultFlags.showUnreviewedStories).toBe(false);
  });

  it('contentGatingEnabled flips on with "true"', async () => {
    process.env.EXPO_PUBLIC_CONTENT_GATING_ENABLED = 'true';
    const mod = await reload();
    expect(mod.flags.contentGatingEnabled).toBe(true);
  });

  it('contentGatingEnabled is read by its literal name, so the web build can carry the switch (F-ENT-003 section 3.4)', async () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_PUBLIC_CONTENT_GATING_ENABLED');
    process.env.EXPO_PUBLIC_CONTENT_GATING_ENABLED = '1';
    let mod = await reload();
    expect(mod.flags.contentGatingEnabled).toBe(true);
    process.env.EXPO_PUBLIC_CONTENT_GATING_ENABLED = 'maybe';
    mod = await reload();
    expect(mod.flags.contentGatingEnabled).toBe(false);
  });

  it('gatingActive: the switch counts on the web only; ios and android are always off (F-ENT-003 section 3.4, OD-13)', async () => {
    const { gatingActive } = await reload();
    expect(gatingActive({ contentGatingEnabled: true }, 'web')).toBe(true);
    expect(gatingActive({ contentGatingEnabled: false }, 'web')).toBe(false);
    expect(gatingActive({ contentGatingEnabled: true }, 'ios')).toBe(false);
    expect(gatingActive({ contentGatingEnabled: true }, 'android')).toBe(false);
    expect(gatingActive({ contentGatingEnabled: false }, 'ios')).toBe(false);
    expect(gatingActive({ contentGatingEnabled: false }, 'android')).toBe(false);
    // An unknown bundle (tests, scripts) fails open, like the switch off.
    expect(gatingActive({ contentGatingEnabled: true }, undefined)).toBe(false);
  });

  // Any mention of the flag in code (member access, index access, destructuring); comments do not count.
  const readsRawFlag = (src: string): boolean =>
    /\bcontentGatingEnabled\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));

  it('the raw-flag check sees every way of reading the flag, and ignores comments', () => {
    expect(readsRawFlag('const on = flags.contentGatingEnabled;')).toBe(true);
    expect(readsRawFlag('const { contentGatingEnabled } = flags;')).toBe(true);
    expect(readsRawFlag("const on = flags['contentGatingEnabled'];")).toBe(true);
    expect(readsRawFlag('/**\n * only with `contentGatingEnabled`, D5\n */\nexport const x = 1;')).toBe(false);
    expect(readsRawFlag('// contentGatingEnabled is read by gatingActive\nexport const x = 1;')).toBe(false);
  });

  it('every access caller reads gatingActive, never the raw flag (F-ENT-003 section 3.4)', () => {
    const root = join(__dirname, '../../..');
    const files = [join(root, 'App.tsx'), ...walk(join(root, 'src'))].filter(
      (f) => /\.tsx?$/.test(f) && !f.includes('__tests__') && !f.endsWith(join('config', 'flags.ts')),
    );
    const raw = files.filter((f) => readsRawFlag(readFileSync(f, 'utf8')));
    expect(raw.map((f) => f.slice(root.length + 1))).toEqual([]);
  });

  it('bundleOs reads the platform the bundler inlines, by its literal name', async () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_OS');
    const { bundleOs } = await reload();
    process.env.EXPO_OS = 'web';
    expect(bundleOs()).toBe('web');
    process.env.EXPO_OS = 'ios';
    expect(bundleOs()).toBe('ios');
    delete process.env.EXPO_OS;
    expect(bundleOs()).toBeUndefined();
  });

  it('showUnreviewedStories flips on with "1"', async () => {
    process.env.EXPO_PUBLIC_SHOW_UNREVIEWED_STORIES = '1';
    const mod = await reload();
    expect(mod.flags.showUnreviewedStories).toBe(true);
  });

  it('placementEnabled (F-PLC-001 P-10 beta flip) is ON by default on every platform', async () => {
    delete process.env.EXPO_PUBLIC_PLACEMENT_ENABLED;
    for (const os of ['web', 'ios', 'android', undefined]) {
      if (os === undefined) delete process.env.EXPO_OS;
      else process.env.EXPO_OS = os;
      const mod = await reload();
      expect(mod.flags.placementEnabled).toBe(true);
      expect(mod.launchDefaultFlags.placementEnabled).toBe(true);
    }
  });

  it('placementEnabled stays a kill switch: "false" or "0" turns it off, "true" or "1" keeps it on', async () => {
    process.env.EXPO_PUBLIC_PLACEMENT_ENABLED = 'false';
    let mod = await reload();
    expect(mod.flags.placementEnabled).toBe(false);
    process.env.EXPO_PUBLIC_PLACEMENT_ENABLED = '0';
    mod = await reload();
    expect(mod.flags.placementEnabled).toBe(false);
    process.env.EXPO_PUBLIC_PLACEMENT_ENABLED = 'true';
    mod = await reload();
    expect(mod.flags.placementEnabled).toBe(true);
    process.env.EXPO_PUBLIC_PLACEMENT_ENABLED = '1';
    mod = await reload();
    expect(mod.flags.placementEnabled).toBe(true);
    process.env.EXPO_PUBLIC_PLACEMENT_ENABLED = 'maybe';
    mod = await reload();
    expect(mod.flags.placementEnabled).toBe(true);
  });

  it('placementEnabled is read by its literal name, so the kill switch reaches the web bundle', () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_PUBLIC_PLACEMENT_ENABLED');
    expect(src).not.toContain("readBool('EXPO_PUBLIC_PLACEMENT_ENABLED'");
  });

  it('audioClips (F-AUDIO-004 A-6) is ON by default and switches off with "false" or "0"', async () => {
    delete process.env.EXPO_PUBLIC_AUDIO_CLIPS;
    let mod = await reload();
    expect(mod.flags.audioClips).toBe(true);
    expect(mod.launchDefaultFlags.audioClips).toBe(true);
    process.env.EXPO_PUBLIC_AUDIO_CLIPS = 'false';
    mod = await reload();
    expect(mod.flags.audioClips).toBe(false);
    process.env.EXPO_PUBLIC_AUDIO_CLIPS = '0';
    mod = await reload();
    expect(mod.flags.audioClips).toBe(false);
    process.env.EXPO_PUBLIC_AUDIO_CLIPS = 'nope';
    mod = await reload();
    expect(mod.flags.audioClips).toBe(true);
  });

  it('audioClips is read by its literal name, so the Expo bundler inlines the override', () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_PUBLIC_AUDIO_CLIPS');
  });

  it('myRouteEnabled (F-ROUTE-001 R-10b beta flip) is ON by default and switches off with "false" or "0"', async () => {
    delete process.env.EXPO_PUBLIC_MY_ROUTE_ENABLED;
    let mod = await reload();
    expect(mod.flags.myRouteEnabled).toBe(true);
    expect(mod.launchDefaultFlags.myRouteEnabled).toBe(true);
    process.env.EXPO_PUBLIC_MY_ROUTE_ENABLED = 'false';
    mod = await reload();
    expect(mod.flags.myRouteEnabled).toBe(false);
    process.env.EXPO_PUBLIC_MY_ROUTE_ENABLED = '0';
    mod = await reload();
    expect(mod.flags.myRouteEnabled).toBe(false);
    process.env.EXPO_PUBLIC_MY_ROUTE_ENABLED = 'maybe';
    mod = await reload();
    expect(mod.flags.myRouteEnabled).toBe(true);
  });

  it('myRouteEnabled is read by its literal name, so a web build can carry the override', () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_PUBLIC_MY_ROUTE_ENABLED');
  });
  it('vocabTopicsEnabled (F-VOC-003 section 3.1) is ON by default since C-7 and "false" or "0" switches it off', async () => {
    delete process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED;
    let mod = await reload();
    expect(mod.flags.vocabTopicsEnabled).toBe(true);
    expect(mod.launchDefaultFlags.vocabTopicsEnabled).toBe(true);
    process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED = 'false';
    mod = await reload();
    expect(mod.flags.vocabTopicsEnabled).toBe(false);
    process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED = '0';
    mod = await reload();
    expect(mod.flags.vocabTopicsEnabled).toBe(false);
    process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED = 'true';
    mod = await reload();
    expect(mod.flags.vocabTopicsEnabled).toBe(true);
    process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED = 'maybe';
    mod = await reload();
    expect(mod.flags.vocabTopicsEnabled).toBe(true);
  });

  it('vocabTopicsEnabled is web-first: on for web, off by default in iOS and Android bundles until the device pass', async () => {
    delete process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED;
    process.env.EXPO_OS = 'web';
    let mod = await reload();
    expect(mod.flags.vocabTopicsEnabled).toBe(true);
    for (const os of ['ios', 'android']) {
      process.env.EXPO_OS = os;
      delete process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED;
      mod = await reload();
      expect(mod.flags.vocabTopicsEnabled).toBe(false);
      expect(mod.launchDefaultFlags.vocabTopicsEnabled).toBe(false);
      process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED = 'true';
      mod = await reload();
      expect(mod.flags.vocabTopicsEnabled).toBe(true);
    }
    process.env.EXPO_OS = 'web';
    process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED = 'false';
    mod = await reload();
    expect(mod.flags.vocabTopicsEnabled).toBe(false);
  });

  it('vocabShowDrafts (F-VOC-001 section 3.7, dev builds only) is OFF by default and flips on with "true"', async () => {
    delete process.env.EXPO_PUBLIC_VOCAB_SHOW_DRAFTS;
    let mod = await reload();
    expect(mod.flags.vocabShowDrafts).toBe(false);
    expect(mod.launchDefaultFlags.vocabShowDrafts).toBe(false);
    process.env.EXPO_PUBLIC_VOCAB_SHOW_DRAFTS = 'true';
    mod = await reload();
    expect(mod.flags.vocabShowDrafts).toBe(true);
    process.env.EXPO_PUBLIC_VOCAB_SHOW_DRAFTS = '0';
    mod = await reload();
    expect(mod.flags.vocabShowDrafts).toBe(false);
  });

  it('vocabShowDrafts ignores the env value in a release build (__DEV__ false or NODE_ENV production)', async () => {
    const g = globalThis as { __DEV__?: boolean };
    const hadDev = '__DEV__' in g;
    const dev = g.__DEV__;
    try {
      process.env.EXPO_PUBLIC_VOCAB_SHOW_DRAFTS = 'true';
      g.__DEV__ = false;
      let mod = await reload();
      expect(mod.flags.vocabShowDrafts).toBe(false);
      g.__DEV__ = true;
      mod = await reload();
      expect(mod.flags.vocabShowDrafts).toBe(true);
      delete g.__DEV__;
      process.env.NODE_ENV = 'production';
      mod = await reload();
      expect(mod.flags.vocabShowDrafts).toBe(false);
    } finally {
      if (hadDev) g.__DEV__ = dev;
      else delete g.__DEV__;
    }
  });

  it('the vocabulary flags are read by their literal names, so a web build can carry the override', () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED');
    expect(src).toContain('process.env.EXPO_PUBLIC_VOCAB_SHOW_DRAFTS');
  });

  it('grownUpHomeEnabled (F-APP-001 A-10) is ON by default; "false", "0", "off" or "no" in any case, trimmed, is the kill switch', async () => {
    delete process.env.EXPO_PUBLIC_GROWN_UP_HOME;
    let mod = await reload();
    expect(mod.flags.grownUpHomeEnabled).toBe(true);
    expect(mod.launchDefaultFlags.grownUpHomeEnabled).toBe(true);
    for (const off of ['false', '0', 'FALSE', 'False', ' false ', 'off', 'OFF', 'no', ' 0']) {
      process.env.EXPO_PUBLIC_GROWN_UP_HOME = off;
      mod = await reload();
      expect(mod.flags.grownUpHomeEnabled, off).toBe(false);
    }
    for (const on of ['true', '1', 'TRUE', ' on ', 'yes', '']) {
      process.env.EXPO_PUBLIC_GROWN_UP_HOME = on;
      mod = await reload();
      expect(mod.flags.grownUpHomeEnabled, on).toBe(true);
    }
    process.env.EXPO_PUBLIC_GROWN_UP_HOME = 'maybe';
    mod = await reload();
    expect(mod.flags.grownUpHomeEnabled).toBe(true);
  });

  it('grownUpHomeEnabled is read by its literal name, so the owner can turn it off in a web build', () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_PUBLIC_GROWN_UP_HOME');
  });

  it('notesEnabled (F-FEEDBACK-001 section 6.5) is ON by default since FB-14 and switches off with "false" or "0"', async () => {
    delete process.env.EXPO_PUBLIC_NOTES_ENABLED;
    let mod = await reload();
    expect(mod.flags.notesEnabled).toBe(true);
    expect(mod.launchDefaultFlags.notesEnabled).toBe(true);
    process.env.EXPO_PUBLIC_NOTES_ENABLED = 'true';
    mod = await reload();
    expect(mod.flags.notesEnabled).toBe(true);
    process.env.EXPO_PUBLIC_NOTES_ENABLED = 'false';
    mod = await reload();
    expect(mod.flags.notesEnabled).toBe(false);
    process.env.EXPO_PUBLIC_NOTES_ENABLED = '0';
    mod = await reload();
    expect(mod.flags.notesEnabled).toBe(false);
  });

  it('notesEnabled is read by its literal name, so a web build can carry the override', () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_PUBLIC_NOTES_ENABLED');
  });

  it('reportsEnabled (F-REPORT-001 section 3.1, RP-9) is ON by default since RP-11 and switches off with "false" or "0"', async () => {
    delete process.env.EXPO_PUBLIC_REPORTS_ENABLED;
    let mod = await reload();
    expect(mod.flags.reportsEnabled).toBe(true);
    expect(mod.launchDefaultFlags.reportsEnabled).toBe(true);
    process.env.EXPO_PUBLIC_REPORTS_ENABLED = 'false';
    mod = await reload();
    expect(mod.flags.reportsEnabled).toBe(false);
    process.env.EXPO_PUBLIC_REPORTS_ENABLED = '0';
    mod = await reload();
    expect(mod.flags.reportsEnabled).toBe(false);
    process.env.EXPO_PUBLIC_REPORTS_ENABLED = 'true';
    mod = await reload();
    expect(mod.flags.reportsEnabled).toBe(true);
    process.env.EXPO_PUBLIC_REPORTS_ENABLED = 'enabled';
    mod = await reload();
    expect(mod.flags.reportsEnabled).toBe(true);
  });

  it('reportsEnabledFor shows reports only with the flag on and a reviewed locale, as the console does (section 3.1)', async () => {
    const mod = await reload();
    expect(mod.REPORT_REVIEWED_LOCALES).toEqual(['en', 'es', 'ko']);
    expect(mod.reportsEnabledFor('en', { reportsEnabled: true })).toBe(true);
    expect(mod.reportsEnabledFor('ko', { reportsEnabled: true })).toBe(true);
    expect(mod.reportsEnabledFor('es', { reportsEnabled: true })).toBe(true);
    expect(mod.reportsEnabledFor('ko', { reportsEnabled: false })).toBe(false);
    expect(mod.reportsEnabledFor('en', { reportsEnabled: false })).toBe(false);
    delete process.env.EXPO_PUBLIC_REPORTS_ENABLED;
    expect((await reload()).reportsEnabledFor('en')).toBe(true);
    expect((await reload()).reportsEnabledFor('ko')).toBe(true);
    process.env.EXPO_PUBLIC_REPORTS_ENABLED = 'false';
    expect((await reload()).reportsEnabledFor('en')).toBe(false);
    delete process.env.EXPO_PUBLIC_REPORTS_ENABLED;
  });

  it('reportsEnabled is read by its literal name, so a web build can carry the override (RP-11 flipped its default on)', () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_PUBLIC_REPORTS_ENABLED');
  });

  it('routeEnabled (F-PLAN-002 section 6, P2-8b) is ON by default and turns off with "false"', async () => {
    delete process.env.EXPO_PUBLIC_ROUTE_ENABLED;
    let mod = await reload();
    expect(mod.flags.routeEnabled).toBe(true);
    expect(mod.launchDefaultFlags.routeEnabled).toBe(true);
    process.env.EXPO_PUBLIC_ROUTE_ENABLED = 'false';
    mod = await reload();
    expect(mod.flags.routeEnabled).toBe(false);
    process.env.EXPO_PUBLIC_ROUTE_ENABLED = '0';
    mod = await reload();
    expect(mod.flags.routeEnabled).toBe(false);
    process.env.EXPO_PUBLIC_ROUTE_ENABLED = 'true';
    mod = await reload();
    expect(mod.flags.routeEnabled).toBe(true);
  });

  it('routeEnabledFor shows the weekly plan only with the flag on and a reviewed locale (P2-8b; es and ko signed by the MAR re-review)', async () => {
    const mod = await reload();
    expect(mod.ROUTE_REVIEWED_LOCALES).toEqual(['en', 'es', 'ko']);
    expect(mod.routeEnabledFor('en', { routeEnabled: true }, false)).toBe(true);
    expect(mod.routeEnabledFor('es', { routeEnabled: true }, false)).toBe(true);
    expect(mod.routeEnabledFor('ko', { routeEnabled: true }, false)).toBe(true);
    expect(mod.routeEnabledFor('es', { routeEnabled: false }, false)).toBe(false);
    expect(mod.routeEnabledFor('en', { routeEnabled: false }, false)).toBe(false);
    // The QA build that shows every locale (EXPO_PUBLIC_SHOW_ALL_LOCALES=1) plays es and ko for the 320 px pass.
    expect(mod.routeEnabledFor('es', { routeEnabled: true }, true)).toBe(true);
    expect(mod.routeEnabledFor('ko', { routeEnabled: true }, true)).toBe(true);
    expect(mod.routeEnabledFor('ko', { routeEnabled: false }, true)).toBe(false);
    delete process.env.EXPO_PUBLIC_ROUTE_ENABLED;
    delete process.env.EXPO_PUBLIC_SHOW_ALL_LOCALES;
    const fresh = await reload();
    expect(fresh.routeEnabledFor('en')).toBe(true);
    expect(fresh.routeEnabledFor('ko')).toBe(true);
  });

  it('every shipped UI locale is a reviewed weekly plan locale, so a plan is never left without its Change and Stop entries', async () => {
    // The re-pace, Homework and Today's mission follow an existing plan in any locale; the entries follow
    // routeEnabledFor. Shipping es or ko before adding it to ROUTE_REVIEWED_LOCALES would strand a plan, so the two
    // lists move in the same PR (F-PLAN-002 section 6).
    const { LOCALE_STATUS, LOCALES } = await import('@hangul-route/i18n');
    const mod = await reload();
    const stranded = LOCALES.filter((l) => LOCALE_STATUS[l] === 'shipped' && !mod.ROUTE_REVIEWED_LOCALES.includes(l));
    expect(stranded).toEqual([]);
  });

  it('routeEnabled is read by its literal name, so a web build can carry the override', () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_PUBLIC_ROUTE_ENABLED');
  });

  // Each case re-imports flags.ts (about 25 imports in all), so the cases are split and get room on a loaded runner.
  const RELOADS_MS = 30_000;

  it('lectureModeEnabled (AMENDMENTS-LECTURE-V2 LV-D1, LV-6) is OFF at launch until LV-7; "false", "0", "off", "no" or "disabled" in any case, trimmed, switch it off', async () => {
    delete process.env.EXPO_PUBLIC_LECTURE_MODE;
    let mod = await reload();
    expect(mod.flags.lectureModeEnabled).toBe(false);
    expect(mod.launchDefaultFlags.lectureModeEnabled).toBe(false);
    for (const off of ['false', '0', 'off', 'no', 'disabled', 'FALSE', ' Off ', 'NO', ' disabled', 'DISABLED ', '\t0\n']) {
      process.env.EXPO_PUBLIC_LECTURE_MODE = off;
      mod = await reload();
      expect(mod.flags.lectureModeEnabled, JSON.stringify(off)).toBe(false);
    }
  }, RELOADS_MS);

  it('lectureModeEnabled turns on before LV-7 with the console value "enabled" or the kill switch on values; anything else is the launch default', async () => {
    // A build (the e2e build, a preview) turns it on before LV-7 flips the default: the console's own value
    // (`enabled`) and the kill switch's on values.
    let mod: Awaited<ReturnType<typeof reload>>;
    for (const on of ['enabled', 'ENABLED', ' enabled ', 'true', '1', 'on', 'yes', 'TRUE']) {
      process.env.EXPO_PUBLIC_LECTURE_MODE = on;
      mod = await reload();
      expect(mod.flags.lectureModeEnabled, JSON.stringify(on)).toBe(true);
    }
    for (const other of ['', 'maybe', 'enable', 'disable']) {
      process.env.EXPO_PUBLIC_LECTURE_MODE = other;
      mod = await reload();
      expect(mod.flags.lectureModeEnabled, JSON.stringify(other)).toBe(mod.launchDefaultFlags.lectureModeEnabled);
    }
  }, RELOADS_MS);

  it('lectureModeEnabled is read by its literal name, so a web build can carry the switch', () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_PUBLIC_LECTURE_MODE');
  });
});
