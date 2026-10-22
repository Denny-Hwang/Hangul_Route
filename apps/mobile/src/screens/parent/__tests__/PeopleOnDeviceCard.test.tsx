import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '../../../store/account-store';
import { useLocaleStore } from '../../../store/locale-store';
import { resetProfileLocks, useProfileLocks } from '../../../store/profile-locks';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';
import { PeopleOnDeviceCard } from '../PeopleOnDeviceCard';

/**
 * [OA] The People on this device card (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 10.1, row OA-7a; mock boards 1, 2):
 * every learner on the device, in creation order, a locked one with the glyph and named "<name>, locked"; a tap opens
 * the person page. No progress, stars or space on a row.
 */
const en = getMessages('en');

const child = (id: string, displayName: string): Profile => ({
  id,
  displayName,
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  role: 'learner',
  createdAt: '2026-10-01T00:00:00.000Z',
  learnerType: 'child',
});

const PROFILES = [child('profile:mina0001', 'Mina'), child('profile:jun00001', 'Jun'), child('profile:sora0001', 'Sora')];

beforeEach(() => {
  setPlatform('web');
  resetProfileLocks();
  useLocaleStore.setState({ device: 'en', byProfile: {} });
  useAccountStore.setState({ parentPinHash: 'pin-hash' });
});

afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('[OA] People on this device (row OA-7a)', () => {
  it('lists every learner on the device under the title, in order; a tap opens that person', async () => {
    const onOpen = vi.fn();
    const r = await render(<PeopleOnDeviceCard profiles={PROFILES} onOpen={onOpen} />);
    expect(screenTexts(r.root)[0]).toBe(en.caregiver.people.title);
    const rows = r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'button').map((n) => n.props['aria-label']);
    expect(rows).toEqual(['Mina', 'Jun', 'Sora']);
    // A row names the learner only: no progress, stars, level or space (CS-6 spirit; mock board 1).
    for (const p of PROFILES) expect(screenTexts(byTestId(r.root, `people-row-${p.id}`)[0]!).every((t) => t === p.displayName || t.startsWith('Hoya'))).toBe(true);
    await press(buttonsNamed(r.root, 'Jun')[0] as ReactTestInstance);
    expect(onOpen).toHaveBeenCalledWith('profile:jun00001');
  });

  it('a locked learner carries the glyph and is named as locked (a tap here asks no PIN)', async () => {
    useProfileLocks.setState({ read: ['profile:sora0001'] });
    const onOpen = vi.fn();
    const r = await render(<PeopleOnDeviceCard profiles={PROFILES} onOpen={onOpen} />);
    expect(byTestId(r.root, 'people-row-lock-profile:sora0001')).toHaveLength(1);
    expect(byTestId(r.root, 'people-row-lock-profile:mina0001')).toHaveLength(0);
    await press(buttonsNamed(r.root, en.a11y.who.lockedRow('Sora'))[0] as ReactTestInstance);
    expect(onOpen).toHaveBeenCalledWith('profile:sora0001');
  });

  it('no learner: nothing is drawn', async () => {
    const r = await render(<PeopleOnDeviceCard profiles={[]} onOpen={vi.fn()} />);
    expect(byTestId(r.root, 'people-on-device')).toHaveLength(0);
  });
});
