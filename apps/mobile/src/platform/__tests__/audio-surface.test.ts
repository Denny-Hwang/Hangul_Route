import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-speech', () => ({ speak: vi.fn(), stop: vi.fn(), getAvailableVoicesAsync: vi.fn(async () => []) }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../storage', () => ({ readJson: vi.fn(async () => null), writeJson: vi.fn(async () => undefined) }));
vi.mock('../telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ uri: '' }) } }));

import * as native from '../audio';
import * as web from '../audio.web';

const functionNames = (mod: object): string[] =>
  Object.entries(mod)
    .filter(([, v]) => typeof v === 'function')
    .map(([k]) => k)
    .filter((k) => !k.startsWith('create'))
    .sort();

describe('audio.ts and audio.web.ts are one surface (Metro picks one per platform)', () => {
  it('export the same functions', () => {
    expect(functionNames(web)).toEqual(functionNames(native));
    expect(functionNames(native)).toEqual(
      [
        'getCapability',
        'hasClip',
        'installGestureUnlock',
        'isMuted',
        'noteFallbackShown',
        'playJamo',
        'playPrompt',
        'refreshCapability',
        'setMuted',
        'speak',
        'stop',
        'subscribeCapability',
        'unlockAudio',
        'warmClips',
      ].sort(),
    );
  });
});
