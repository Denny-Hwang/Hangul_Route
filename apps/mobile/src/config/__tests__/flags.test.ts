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
});
