import { describe, expect, it } from 'vitest';
import { holdsAtOnce, NOTE_HOLD_REPORTERS, NOTE_HOLD_WINDOW_MS } from '../note-holds';

/** The immediate-hold rule of F-FEEDBACK-001 section 8.4 (OD-10), PR FB-4b-device. */
describe('holdsAtOnce', () => {
  it('only an unsafe report from a family account or a PIN-attested device', () => {
    expect(holdsAtOnce('unsafe', 'family', null)).toBe(true);
    expect(holdsAtOnce('unsafe', 'device', 'grown_up_pin')).toBe(true);
    expect(holdsAtOnce('unsafe', 'device', 'self')).toBe(false);
    expect(holdsAtOnce('unsafe', 'device', null)).toBe(false);
    for (const reason of ['unkind', 'not_for_me', 'other'] as const) {
      expect(holdsAtOnce(reason, 'family', null)).toBe(false);
      expect(holdsAtOnce(reason, 'device', 'grown_up_pin')).toBe(false);
    }
  });

  it('pins the OD-10 defaults: 2 distinct families in 30 days', () => {
    expect(NOTE_HOLD_REPORTERS).toBe(2);
    expect(NOTE_HOLD_WINDOW_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
