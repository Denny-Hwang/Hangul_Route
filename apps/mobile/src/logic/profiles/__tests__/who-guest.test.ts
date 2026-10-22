import { OA_TELEMETRY_PAYLOADS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { chooserTrigger, guestTile, whoPickedEvent, whoShownEvent, type WhoTrigger } from '../who';

// [GU] AMENDMENTS-GUEST-FIRST-LESSON row GU-5, sections 6.1, 9.1, 12 and 19, CS-G4, CS-G5: the `try` trigger and the
// chooser's guest tiles as pure rules.

describe('chooserTrigger with the try intent (section 6.1, CS-G4)', () => {
  const base = { shared: false, activeLocked: false, profiles: 1, backgroundMs: 0, joinHeld: false, flag: true };

  it('opens the chooser with the trigger try from one learner profile up, shared or not (OQ-G9)', () => {
    expect(chooserTrigger({ ...base, event: 'try' })).toBe('try');
    expect(chooserTrigger({ ...base, event: 'try', shared: true, profiles: 2 })).toBe('try');
    expect(chooserTrigger({ ...base, event: 'try', profiles: 13, shared: true })).toBe('try');
  });

  it('a locked active profile changes nothing: the chooser still opens with try', () => {
    expect(chooserTrigger({ ...base, event: 'try', activeLocked: true })).toBe('try');
  });

  it('the chooser switch off: the intent is ignored (today’s launch)', () => {
    expect(chooserTrigger({ ...base, event: 'try', flag: false })).toBeNull();
  });

  it('no learner profile: never the chooser (the guest run starts instead, row GU-3)', () => {
    expect(chooserTrigger({ ...base, event: 'try', profiles: 0 })).toBeNull();
  });

  it('a held join wins (OA-D20): join on a shared device, else today’s Join; never try', () => {
    expect(chooserTrigger({ ...base, event: 'try', joinHeld: true, shared: true, profiles: 2 })).toBe('join');
    expect(chooserTrigger({ ...base, event: 'try', joinHeld: true })).toBeNull();
  });

  it('the other events never answer try', () => {
    for (const event of ['launch', 'return', 'resume', 'manual'] as const) {
      expect(chooserTrigger({ ...base, event, shared: true, profiles: 2, backgroundMs: 60 * 60 * 1000 })).not.toBe('try');
    }
  });
});

describe('guestTile, the tile rule table of section 9.1', () => {
  const triggers: readonly WhoTrigger[] = ['launch', 'return', 'resume', 'join', 'manual', 'try'];

  it('a live guest shows its own tile, whatever the trigger but join (CS-G5)', () => {
    for (const trigger of triggers) {
      const tile = guestTile({ guestOn: true, liveGuest: true, trigger, tried: false, joining: false });
      expect(tile).toBe(trigger === 'join' ? null : 'guest');
    }
    // Never the try tile beside it: one guest per device.
    expect(guestTile({ guestOn: true, liveGuest: true, trigger: 'try', tried: true, joining: false })).toBe('guest');
  });

  it('no live guest: the try tile only for the try trigger, or return with try', () => {
    for (const trigger of triggers) {
      const expected = trigger === 'try' ? 'try' : null;
      expect(guestTile({ guestOn: true, liveGuest: false, trigger, tried: false, joining: false })).toBe(expected);
    }
    expect(guestTile({ guestOn: true, liveGuest: false, trigger: 'return', tried: true, joining: false })).toBe('try');
    // `tried` only rides on return: a launch, a resume or a Switch never shows it (OQ-G8).
    for (const trigger of ['launch', 'resume', 'manual'] as const) {
      expect(guestTile({ guestOn: true, liveGuest: false, trigger, tried: true, joining: false })).toBeNull();
    }
  });

  it('a held class code never shows a guest tile of any kind (joining needs a profile, CS-G4)', () => {
    expect(guestTile({ guestOn: true, liveGuest: false, trigger: 'try', tried: true, joining: true })).toBeNull();
    expect(guestTile({ guestOn: true, liveGuest: false, trigger: 'return', tried: true, joining: true })).toBeNull();
    expect(guestTile({ guestOn: true, liveGuest: true, trigger: 'manual', tried: false, joining: true })).toBeNull();
    expect(guestTile({ guestOn: true, liveGuest: false, trigger: 'join', tried: true, joining: false })).toBeNull();
  });

  it('the guest switch off: no tile at all', () => {
    for (const trigger of triggers) {
      expect(guestTile({ guestOn: false, liveGuest: true, trigger, tried: true, joining: false })).toBeNull();
      expect(guestTile({ guestOn: false, liveGuest: false, trigger, tried: true, joining: false })).toBeNull();
    }
  });
});

describe('who.* events with the guest values (section 12)', () => {
  it('who.shown carries trigger try; who.picked carries kind try and guest, with no use', () => {
    const shown = whoShownEvent({ trigger: 'try', learners: 2, grownUps: 2, anyLocked: false, resetPending: false });
    expect(shown.payload.trigger).toBe('try');
    expect(OA_TELEMETRY_PAYLOADS['who.shown'].safeParse(shown.payload).success).toBe(true);
    for (const kind of ['try', 'guest'] as const) {
      expect(whoPickedEvent(kind, 'area').payload).toEqual({ kind });
      expect(OA_TELEMETRY_PAYLOADS['who.picked'].safeParse(whoPickedEvent(kind).payload).success).toBe(true);
    }
  });
});
