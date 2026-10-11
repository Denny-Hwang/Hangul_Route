import { describe, expect, it } from 'vitest';
import { PLAY_IN_SILENT_MODE } from '../audio';

describe('audio config (F-AUDIO-004 §3.10)', () => {
  it('respects the device silent switch (owner decision 2026-10-10)', () => {
    expect(PLAY_IN_SILENT_MODE).toBe(false);
  });
});
