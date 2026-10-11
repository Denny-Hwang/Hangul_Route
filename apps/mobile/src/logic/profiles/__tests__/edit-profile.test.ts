import { ONBOARDING_TELEMETRY_PAYLOADS, type Profile } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import {
  editMissing,
  editPlan,
  initialEditDraft,
  submitEdit,
  type EditDeps,
  type EditState,
} from '../edit-profile';

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'profile:p-1',
  role: 'learner',
  displayName: 'Mina',
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  createdAt: '2026-10-01T00:00:00.000Z',
  lastActiveAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

const state = (over: Partial<EditState> = {}): EditState => {
  const original = over.original ?? profile();
  return {
    original,
    draft: initialEditDraft(original),
    agreed: false,
    pin: null,
    guardianAcceptedAt: '2026-10-01T00:00:00.000Z',
    selfAcceptedAt: null,
    parentPinHash: 'hash',
    ...over,
  };
};

const withDraft = (s: EditState, draft: Partial<EditState['draft']>): EditState => ({ ...s, draft: { ...s.draft, ...draft } });

function deps(over: Partial<EditDeps> = {}): EditDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    hashPin: vi.fn(async (pin: string) => {
      calls.push(`hash:${pin}`);
      return `h(${pin})`;
    }),
    acceptGuardianConsent: vi.fn(() => calls.push('guardian')),
    acceptSelfConsent: vi.fn(() => calls.push('self')),
    setParentPinHash: vi.fn((h: string) => calls.push(`pin:${h}`)),
    updateProfile: vi.fn((id, patch) => calls.push(`update:${id}:${JSON.stringify(patch)}`)),
    track: vi.fn((e) => calls.push(`track:${e.name}:${JSON.stringify(e.payload)}`)),
    ...over,
  };
}

describe('initialEditDraft: the form starts from the stored profile', () => {
  it('copies name, level, avatar and the effective learner type', () => {
    expect(initialEditDraft(profile({ learnerType: 'self', ageGroup: '10-11', avatar: 'hoya-blue' }))).toEqual({
      name: 'Mina',
      level: '10-11',
      avatar: 'hoya-blue',
      learnerType: 'self',
    });
  });

  it('a profile stored before learnerType existed reads as "child" (§3.10)', () => {
    expect(initialEditDraft(profile()).learnerType).toBe('child');
  });

  it('a level id this build does not know selects no level card (null), it is not replaced', () => {
    const future = { ...profile(), ageGroup: '12-14' } as unknown as Profile;
    expect(initialEditDraft(future).level).toBeNull();
  });
});

describe('editPlan: what a change to "Who is learning?" needs (§3.11)', () => {
  it('no change of who: no consent, no PIN', () => {
    expect(editPlan(state())).toMatchObject({ whoChange: null, consent: null, pinRequired: false });
  });

  it('child -> self always asks for the "13 or older" box, even when a self consent exists', () => {
    expect(editPlan(withDraft(state(), { learnerType: 'self' }))).toMatchObject({ whoChange: 'to-self', consent: 'self', pinRequired: false });
    expect(
      editPlan(withDraft(state({ selfAcceptedAt: '2026-10-02T00:00:00.000Z' }), { learnerType: 'self' })),
    ).toMatchObject({ consent: 'self' });
  });

  it('self -> child needs the guardian consent only when none is stored', () => {
    const self = state({ original: profile({ learnerType: 'self' }), guardianAcceptedAt: null, selfAcceptedAt: 'x' });
    expect(editPlan(withDraft(self, { learnerType: 'child' }))).toMatchObject({ whoChange: 'to-child', consent: 'guardian' });
    expect(editPlan(withDraft({ ...self, guardianAcceptedAt: 'g' }, { learnerType: 'child' }))).toMatchObject({ consent: null });
  });

  it('self -> child creates a PIN when the device has none', () => {
    const self = state({ original: profile({ learnerType: 'self' }), parentPinHash: null });
    expect(editPlan(withDraft(self, { learnerType: 'child' })).pinRequired).toBe(true);
    expect(editPlan(withDraft({ ...self, parentPinHash: 'hash' }, { learnerType: 'child' })).pinRequired).toBe(false);
  });

  it('lists the changed fields in a fixed order (name, level, avatar, learner_type)', () => {
    expect(editPlan(state()).changed).toEqual([]);
    expect(
      editPlan(withDraft(state(), { learnerType: 'self', avatar: 'hoya-pink', level: '5-7', name: 'Mina Kim' })).changed,
    ).toEqual(['name', 'level', 'avatar', 'learner_type']);
  });

  it('a name that differs only by outer spaces is not a change', () => {
    expect(editPlan(withDraft(state(), { name: '  Mina ' })).changed).toEqual([]);
  });

  it('an unknown stored level left untouched is not a change; picking one is', () => {
    const future = state({ original: { ...profile(), ageGroup: '12-14' } as unknown as Profile });
    expect(editPlan(future).changed).toEqual([]);
    expect(editPlan(withDraft(future, { level: '8-9' })).changed).toEqual(['level']);
  });
});

describe('editMissing: the calm line under a disabled Save, in order', () => {
  it('a name the create form would refuse comes first', () => {
    expect(editMissing(withDraft(state(), { name: '' }))).toBe('name');
    expect(editMissing(withDraft(state(), { name: 'Mina<3', learnerType: 'self' }))).toBe('name');
  });

  it('then the consent box', () => {
    expect(editMissing(withDraft(state(), { learnerType: 'self' }))).toBe('agree');
    expect(editMissing({ ...withDraft(state(), { learnerType: 'self' }), agreed: true })).toBeNull();
  });

  it('then the PIN', () => {
    const self = state({ original: profile({ learnerType: 'self' }), parentPinHash: null, guardianAcceptedAt: 'g' });
    const toChild = withDraft(self, { learnerType: 'child' });
    expect(editMissing(toChild)).toBe('pin');
    expect(editMissing({ ...toChild, pin: '1234' })).toBeNull();
  });

  it('nothing changed yet reads as "unchanged"', () => {
    expect(editMissing(state())).toBe('unchanged');
    expect(editMissing(withDraft(state(), { avatar: 'hoya-green' }))).toBeNull();
  });
});

describe('submitEdit: Save', () => {
  it('saves only the changed fields and reports each as profile.updated, nothing else', async () => {
    const d = deps();
    const s = withDraft(state(), { name: ' Mina Kim ', level: '10-11' });
    expect(await submitEdit(s, d)).toEqual({ ok: true });
    expect(d.calls).toEqual([
      'update:profile:p-1:{"displayName":"Mina Kim","ageGroup":"10-11"}',
      'track:profile.updated:{"field":"name"}',
      'track:profile.updated:{"field":"level"}',
    ]);
    expect(d.track).toHaveBeenCalledWith(expect.objectContaining({ profileId: 'profile:p-1' }));
  });

  it('every event payload passes its strict schema (no name, no learnerType)', async () => {
    const self = state({ original: profile({ learnerType: 'self' }), parentPinHash: null, guardianAcceptedAt: null });
    const d = deps();
    await submitEdit({ ...withDraft(self, { learnerType: 'child', name: 'Leo', avatar: 'hoya-blue', level: '5-7' }), agreed: true, pin: '1234' }, d);
    const events = vi.mocked(d.track).mock.calls.map(([e]) => e);
    expect(events.length).toBe(5);
    for (const e of events) {
      const schema = ONBOARDING_TELEMETRY_PAYLOADS[e.name as keyof typeof ONBOARDING_TELEMETRY_PAYLOADS];
      expect(schema.safeParse(e.payload).success).toBe(true);
    }
  });

  it('child -> self: records the self consent when absent, then the profile', async () => {
    const d = deps();
    await submitEdit({ ...withDraft(state(), { learnerType: 'self' }), agreed: true }, d);
    expect(d.calls).toEqual([
      'self',
      'update:profile:p-1:{"learnerType":"self"}',
      'track:profile.updated:{"field":"learner_type"}',
    ]);
  });

  it('child -> self keeps an existing self consent stamp', async () => {
    const d = deps();
    await submitEdit({ ...withDraft(state({ selfAcceptedAt: 's' }), { learnerType: 'self' }), agreed: true }, d);
    expect(d.acceptSelfConsent).not.toHaveBeenCalled();
    expect(d.updateProfile).toHaveBeenCalledWith('profile:p-1', { learnerType: 'self' });
  });

  it('self -> child on a device with no PIN and no guardian consent: hash, consent, PIN, profile, events', async () => {
    const self = state({ original: profile({ learnerType: 'self' }), parentPinHash: null, guardianAcceptedAt: null, selfAcceptedAt: 's' });
    const d = deps();
    await submitEdit({ ...withDraft(self, { learnerType: 'child' }), agreed: true, pin: '4321' }, d);
    expect(d.calls).toEqual([
      'hash:4321',
      'guardian',
      'pin:h(4321)',
      'update:profile:p-1:{"learnerType":"child"}',
      'track:profile.updated:{"field":"learner_type"}',
      'track:pin.created:{"where":"gate"}',
    ]);
  });

  it('a PIN that cannot be hashed stores nothing', async () => {
    const self = state({ original: profile({ learnerType: 'self' }), parentPinHash: null, guardianAcceptedAt: null });
    const d = deps({
      hashPin: vi.fn(async () => {
        throw new Error('no crypto');
      }),
    });
    expect(await submitEdit({ ...withDraft(self, { learnerType: 'child' }), agreed: true, pin: '1111' }, d)).toEqual({
      ok: false,
      reason: 'pin-failed',
    });
    expect(d.calls).toEqual([]);
  });

  it('an incomplete form stores nothing', async () => {
    const d = deps();
    expect(await submitEdit(state(), d)).toEqual({ ok: false, reason: 'incomplete' });
    expect(await submitEdit(withDraft(state(), { learnerType: 'self' }), d)).toEqual({ ok: false, reason: 'incomplete' });
    expect(d.calls).toEqual([]);
  });
});
