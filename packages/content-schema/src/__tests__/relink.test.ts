import { describe, expect, it } from 'vitest';
import { RELINK_WINDOW_MS, RelinkCreateSchema, RelinkRequestSchema, SpaceSettingsPatchSchema, rosterAlias } from '../index';

describe('relink + settings schemas (F-TCH-001 §10)', () => {
  it('validates relink creates and requests', () => {
    expect(RelinkCreateSchema.parse({ code: 'k7m2x9', learnerId: 'profile:minho', deviceId: 'device-bbbbbbbb', platform: ' tablet ' })).toEqual({ code: 'K7M2X9', learnerId: 'profile:minho', deviceId: 'device-bbbbbbbb', platform: 'tablet' });
    expect(RelinkCreateSchema.safeParse({ code: 'nope', learnerId: 'profile:minho', deviceId: 'device-bbbbbbbb' }).success).toBe(false);
    expect(RelinkCreateSchema.safeParse({ code: 'K7M2X9', learnerId: 'minho', deviceId: 'device-bbbbbbbb' }).success).toBe(false);
    expect(RelinkCreateSchema.safeParse({ code: 'K7M2X9', learnerId: 'profile:minho', deviceId: 'short' }).success).toBe(false);
    const req = { id: 'relink:abc', spaceId: 'space:c', learnerId: 'profile:minho', deviceId: 'device-bbbbbbbb', platform: null, requestedAt: 't', expiresAt: 't2', status: 'pending', decidedAt: null };
    expect(RelinkRequestSchema.parse(req).status).toBe('pending');
    expect(RelinkRequestSchema.safeParse({ ...req, status: 'maybe' }).success).toBe(false);
    expect(RELINK_WINDOW_MS).toBe(600_000);
  });

  it('settings patch needs at least one field; alias keeps initials only', () => {
    expect(SpaceSettingsPatchSchema.parse({ anonymizeRoster: true })).toEqual({ anonymizeRoster: true });
    expect(SpaceSettingsPatchSchema.parse({ consentMode: 'school' }).consentMode).toBe('school');
    expect(SpaceSettingsPatchSchema.safeParse({}).success).toBe(false);
    expect(SpaceSettingsPatchSchema.safeParse({ consentMode: 'none' }).success).toBe(false);
    expect(rosterAlias('Minho Kim')).toBe('M. K.');
    expect(rosterAlias('suni')).toBe('S.');
    expect(rosterAlias('   ')).toBe('?');
  });
});
