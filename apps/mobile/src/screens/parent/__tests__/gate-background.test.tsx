import { GROWN_UP_BACKGROUND_MS } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import { useUiStore } from '../../../store/ui-store';
import { bindGrownUpBackgroundRule, type BackgroundRuleDeps } from '../use-gate-lapse';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D16, CS-14: 5 minutes in the background end the grown-up session,
// measured by wall clock between hidden and shown (AppState on native, visibilitychange on the web).
function rig(open = true) {
  let listener: ((visible: boolean) => void) | null = null;
  let clock = 1_000_000;
  const close = vi.fn();
  const deps: BackgroundRuleDeps = {
    subscribe: (l) => {
      listener = l;
      return () => {
        listener = null;
      };
    },
    now: () => clock,
    close,
    sessionOpen: () => open,
  };
  const stop = bindGrownUpBackgroundRule(deps);
  return {
    close,
    stop,
    hide: () => listener?.(false),
    show: () => listener?.(true),
    wait: (ms: number) => {
      clock += ms;
    },
    get bound() {
      return listener !== null;
    },
  };
}

describe('bindGrownUpBackgroundRule', () => {
  it('closes an open session after 5 minutes hidden, not before', () => {
    const r = rig();
    r.hide();
    r.wait(GROWN_UP_BACKGROUND_MS - 1);
    r.show();
    expect(r.close).not.toHaveBeenCalled();
    r.hide();
    r.wait(GROWN_UP_BACKGROUND_MS);
    r.show();
    expect(r.close).toHaveBeenCalledTimes(1);
  });

  it('counts from the first hide (a second hide event does not restart it), and a show alone does nothing', () => {
    const r = rig();
    r.show();
    r.hide();
    r.wait(GROWN_UP_BACKGROUND_MS - 10);
    r.hide();
    r.wait(10);
    r.show();
    expect(r.close).toHaveBeenCalledTimes(1);
  });

  it('touches nothing when no session is open, and unsubscribes', () => {
    const r = rig(false);
    r.hide();
    r.wait(GROWN_UP_BACKGROUND_MS * 2);
    r.show();
    expect(r.close).not.toHaveBeenCalled();
    r.stop();
    expect(r.bound).toBe(false);
  });

  it('the default reads the ui-store session and closes it for real', async () => {
    const visibility = await import('../../../platform/app-visibility');
    let listener: ((visible: boolean) => void) | null = null;
    const spy = vi.spyOn(visibility, 'subscribeAppVisibility').mockImplementation((l) => {
      listener = l;
      return () => undefined;
    });
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(0);
    const stop = bindGrownUpBackgroundRule();
    useUiStore.setState({ parentGateOpenedAt: 1, lastPinVerifiedAt: null });
    listener!(false);
    nowSpy.mockReturnValue(GROWN_UP_BACKGROUND_MS);
    listener!(true);
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    stop();
    spy.mockRestore();
    nowSpy.mockRestore();
  });
});
