import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '../../../store/account-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { useUiStore } from '../../../store/ui-store';
import { byTestId, render, screenTexts, unmount } from '../../../test-support/render';
import { ProfileScreen } from '../ProfileScreen';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.7 (row DP-2; design design/screens/system/progress-read-failed/ frame L,
 * D8): while the active learner's progress could not be saved (`saveFailedFor` only, not a failed read), Profile shows
 * one quiet line above the second group. On a family device it asks for a grown-up's help and never asks the learner,
 * possibly a child, to free up space (owner item O4, 2026-11-22); a self-only device never says "grown-up" and gets
 * the spec's line.
 */

const navigation = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }));
vi.mock('@react-navigation/native', () => ({ useNavigation: () => navigation, useFocusEffect: () => undefined }));

const ID = 'profile:mina';
const t = getMessages('en').learner.profile.saveTrouble;

function seed(learnerType: 'child' | 'self'): void {
  const profile: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType };
  useProfileStore.setState({ profiles: [profile], activeId: ID });
  useAccountStore.setState({ parentPinHash: 'pin-hash', subscription: null });
  useUiStore.setState({ parentGateOpenedAt: null });
}

beforeEach(() => {
  useProgressStore.setState({ saveFailedFor: new Set(), loadFailedFor: new Set() });
});
afterEach(() => {
  useProgressStore.setState({ saveFailedFor: new Set(), loadFailedFor: new Set() });
});

describe('[DP] the Profile save line (DP-2)', () => {
  it('is absent while the saves land, and for a failed read (loadFailedFor)', async () => {
    seed('child');
    const r = await render(<ProfileScreen />);
    expect(byTestId(r.root, 'profile-save-trouble')).toHaveLength(0);
    await act(async () => {
      useProgressStore.setState({ loadFailedFor: new Set([ID]) });
    });
    expect(byTestId(r.root, 'profile-save-trouble')).toHaveLength(0);
    await unmount(r);
  });

  it('family device: asks for a grown-up, above the For grown-ups group, and never asks to free up space', async () => {
    seed('child');
    useProgressStore.setState({ saveFailedFor: new Set([ID]) });
    const r = await render(<ProfileScreen />);
    const texts = screenTexts(r.root);
    expect(texts).toContain(t.family);
    expect(texts).not.toContain(t.self);
    expect(texts.indexOf(t.family)).toBeLessThan(texts.indexOf('For grown-ups'));
    const node = byTestId(r.root, 'profile-save-trouble')[0];
    expect(node?.props['aria-live']).toBeUndefined();
    await unmount(r);
  });

  it('self-only device: the spec line, above Account & more', async () => {
    seed('self');
    useProgressStore.setState({ saveFailedFor: new Set([ID]) });
    const r = await render(<ProfileScreen />);
    const texts = screenTexts(r.root);
    expect(texts).toContain(t.self);
    expect(texts).not.toContain(t.family);
    expect(texts.indexOf(t.self)).toBeLessThan(texts.indexOf('Account & more'));
    await unmount(r);
  });

  it('another learner in saveFailedFor does not show it here', async () => {
    seed('child');
    useProgressStore.setState({ saveFailedFor: new Set(['profile:joon']) });
    const r = await render(<ProfileScreen />);
    expect(byTestId(r.root, 'profile-save-trouble')).toHaveLength(0);
    await unmount(r);
  });
});
