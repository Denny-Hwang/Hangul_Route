import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

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

  it('placementEnabled is OFF by default (F-PLC-001 section 6)', async () => {
    delete process.env.EXPO_PUBLIC_PLACEMENT_ENABLED;
    const mod = await reload();
    expect(mod.flags.placementEnabled).toBe(false);
    expect(mod.launchDefaultFlags.placementEnabled).toBe(false);
  });

  it('placementEnabled flips on with "true"', async () => {
    process.env.EXPO_PUBLIC_PLACEMENT_ENABLED = 'true';
    const mod = await reload();
    expect(mod.flags.placementEnabled).toBe(true);
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

  it('myRouteEnabled (F-ROUTE-001 rollout) is OFF by default and flips on with "true" or "1"', async () => {
    delete process.env.EXPO_PUBLIC_MY_ROUTE_ENABLED;
    let mod = await reload();
    expect(mod.flags.myRouteEnabled).toBe(false);
    expect(mod.launchDefaultFlags.myRouteEnabled).toBe(false);
    process.env.EXPO_PUBLIC_MY_ROUTE_ENABLED = 'true';
    mod = await reload();
    expect(mod.flags.myRouteEnabled).toBe(true);
    process.env.EXPO_PUBLIC_MY_ROUTE_ENABLED = '1';
    mod = await reload();
    expect(mod.flags.myRouteEnabled).toBe(true);
    process.env.EXPO_PUBLIC_MY_ROUTE_ENABLED = 'maybe';
    mod = await reload();
    expect(mod.flags.myRouteEnabled).toBe(false);
  });

  it('myRouteEnabled is read by its literal name, so a web build can carry the override', () => {
    const src = readFileSync(join(__dirname, '../flags.ts'), 'utf8');
    expect(src).toContain('process.env.EXPO_PUBLIC_MY_ROUTE_ENABLED');
  });
  it('vocabTopicsEnabled (F-VOC-003 section 3.1) is OFF by default and flips on with "true" or "1"', async () => {
    delete process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED;
    let mod = await reload();
    expect(mod.flags.vocabTopicsEnabled).toBe(false);
    expect(mod.launchDefaultFlags.vocabTopicsEnabled).toBe(false);
    process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED = 'true';
    mod = await reload();
    expect(mod.flags.vocabTopicsEnabled).toBe(true);
    process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED = '1';
    mod = await reload();
    expect(mod.flags.vocabTopicsEnabled).toBe(true);
    process.env.EXPO_PUBLIC_VOCAB_TOPICS_ENABLED = 'maybe';
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
});
