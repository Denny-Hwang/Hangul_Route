import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGuestStore } from '../../../store/guest-store';
import { useProfileStore } from '../../../store/profile-store';
import { byTestId } from '../../../test-support/render';
import { DecodingSprintOffer, DecodingSprintRoute } from '../syllable-build-entry';

/**
 * F-CURR-002 section 7.1 F9 ("hidden when off"), row CM-32: with `decodingSprint` off the Block Sprint is drawn nowhere
 * (the Journey footer and the Hangul Check results share `DecodingSprintOffer`) and its route goes straight back; a guest
 * run never sees it either.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const flags = vi.hoisted(() => ({ decodingSprint: false }));
vi.mock('../../../store/remote-config-store', async (original) => ({
  ...((await original()) as Record<string, unknown>),
  useCurrFlag: (name: string) => (name === 'decodingSprint' ? flags.decodingSprint : false),
}));

const mounted: ReactTestRenderer[] = [];
async function mount(element: React.ReactElement): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>{element}</LayoutProvider>);
  });
  mounted.push(r);
  return r;
}

const navigation = () => ({ canGoBack: vi.fn(() => true), goBack: vi.fn() });
type RouteProps = Parameters<typeof DecodingSprintRoute>[0];

beforeEach(() => {
  flags.decodingSprint = false;
  useProfileStore.setState({ activeId: 'p1' });
  useGuestStore.setState({ running: false });
});
afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
});

describe('decodingSprint off', () => {
  it('draws no offer, wherever it is placed', async () => {
    const r = await mount(<DecodingSprintOffer testID="hangul-check-sprint" onOpen={() => undefined} />);
    expect(r.toJSON()).toBeNull();
    expect(byTestId(r.root, 'hangul-check-sprint')).toHaveLength(0);
  });

  it('the route goes back at once and draws no sprint', async () => {
    const nav = navigation();
    const r = await mount(<DecodingSprintRoute {...({ navigation: nav, route: { key: 'k', name: 'DecodingSprint' } } as unknown as RouteProps)} />);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'decoding-sprint-intro')).toHaveLength(0);
  });

  it('on, a guest run still gets no offer and the route still goes back', async () => {
    flags.decodingSprint = true;
    useGuestStore.setState({ running: true });
    const r = await mount(<DecodingSprintOffer onOpen={() => undefined} />);
    expect(r.toJSON()).toBeNull();
    const nav = navigation();
    await mount(<DecodingSprintRoute {...({ navigation: nav, route: { key: 'k', name: 'DecodingSprint' } } as unknown as RouteProps)} />);
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });
});
