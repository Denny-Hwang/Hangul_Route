import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountStore } from '../../../store/account-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { useUiStore } from '../../../store/ui-store';
import { byTestId, render, screenTexts, unmount } from '../../../test-support/render';
import { ParentDashboardScreen } from '../ParentDashboardScreen';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.7 (row DP-2; design design/screens/system/progress-read-failed/ frame M,
 * D8, D9): the Grown-up area shows one quiet line after its title block while any learner on the device could not be
 * saved (`saveFailedFor`). The spec's `grownUp.saveTrouble` is `caregiver.dashboard.saveTrouble` (owner item O1,
 * 2026-11-22). A failed read alone (`loadFailedFor`) does not show it.
 */

vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: vi.fn() }), useFocusEffect: () => undefined }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => true) }));

const LINE = getMessages('en').caregiver.dashboard.saveTrouble;
const learner = (id: string, name: string): Profile => ({ id, displayName: name, ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' });
const navigation = { navigate: vi.fn(), replace: vi.fn(), goBack: vi.fn(), addListener: vi.fn(() => () => undefined) };
const dashboard = (): ReturnType<typeof render> =>
  render(<ParentDashboardScreen navigation={navigation as never} route={{ key: 'ParentDashboard', name: 'ParentDashboard' } as never} />);

beforeEach(() => {
  useProfileStore.setState({ profiles: [learner('profile:mina', 'Mina'), learner('profile:joon', 'Joon')], activeId: 'profile:mina' });
  useAccountStore.setState({ parentPinHash: 'pin-hash', subscription: null });
  useUiStore.setState({ parentGateOpenedAt: Date.now() });
  useProgressStore.setState({ saveFailedFor: new Set(), loadFailedFor: new Set(), hydratedFor: new Set(['profile:mina', 'profile:joon']) });
});
afterEach(() => {
  useProgressStore.setState({ saveFailedFor: new Set(), loadFailedFor: new Set() });
});

describe('[DP] the Grown-up area save line (DP-2)', () => {
  it('is absent while every save lands, and for a failed read alone', async () => {
    const r = await dashboard();
    expect(screenTexts(r.root)).not.toContain(LINE);
    await act(async () => {
      useProgressStore.setState({ loadFailedFor: new Set(['profile:joon']) });
    });
    expect(screenTexts(r.root)).not.toContain(LINE);
    await unmount(r);
  });

  it('shows once after the title block while any learner on the device is in saveFailedFor (not only the active one)', async () => {
    useProgressStore.setState({ saveFailedFor: new Set(['profile:joon']) });
    const r = await dashboard();
    const texts = screenTexts(r.root);
    expect(texts.filter((x) => x === LINE)).toHaveLength(1);
    expect(texts.indexOf(LINE)).toBeGreaterThan(texts.indexOf(getMessages('en').caregiver.dashboard.readOnly));
    const node = byTestId(r.root, 'dashboard-save-trouble')[0];
    expect(node).toBeDefined();
    expect(node?.props['aria-live']).toBeUndefined();
    await act(async () => {
      useProgressStore.setState({ saveFailedFor: new Set() });
    });
    expect(screenTexts(r.root)).not.toContain(LINE);
    await unmount(r);
  });
});
