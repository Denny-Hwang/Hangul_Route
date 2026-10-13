import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it, vi } from 'vitest';
import { freeLessonsRowA11y, runDashboardBilling, type DashboardBillingDeps } from '../dashboard-free-line';
import type { BillingOpenResult } from '../paywall';

/**
 * F-ENT-003 row E3-12b (section 3.9.2): what one tap of **Open billing** on the dashboard's
 * free-lessons line does, and how the link is described. The flow follows the Plan screen
 * (F-BILL-002 section 4.7) with the dashboard's own hand-off request: blocked while offline in the
 * same-tab mode, one hand-off per tap, the address to type when the browser blocks the new tab, the
 * PIN screen when the same-tab hand-off needs a fresh PIN, and a throw frees the link.
 */

const en = getMessages('en');

function deps(over: Partial<DashboardBillingDeps> = {}): DashboardBillingDeps & {
  setNote: ReturnType<typeof vi.fn>;
  askPin: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
} {
  return {
    sameTab: false,
    isOnline: () => true,
    busy: { current: false },
    open: vi.fn(async (): Promise<BillingOpenResult> => ({ kind: 'browser', outcome: 'opened', url: 'https://hangulroute.com/teach/billing' })),
    askPin: vi.fn(),
    setNote: vi.fn(),
    messages: en,
    ...over,
  } as DashboardBillingDeps & { setNote: ReturnType<typeof vi.fn>; askPin: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> };
}

describe('runDashboardBilling', () => {
  it('does nothing in the same-tab mode while offline (the live network state)', async () => {
    const d = deps({ sameTab: true, isOnline: () => false });
    await runDashboardBilling(d);
    expect(d.open).not.toHaveBeenCalled();
    expect(d.setNote).not.toHaveBeenCalled();
    expect(d.busy.current).toBe(false);
  });

  it('opens the new tab offline when the flag is off (the browser hand-off reports offline itself)', async () => {
    const d = deps({ sameTab: false, isOnline: () => false });
    await runDashboardBilling(d);
    expect(d.open).toHaveBeenCalledWith(false);
  });

  it('runs once while a hand-off is in flight', async () => {
    const d = deps({ busy: { current: true } });
    await runDashboardBilling(d);
    expect(d.open).not.toHaveBeenCalled();
  });

  it('calls the hand-off before its first await, so the tap reaches the new tab', () => {
    const d = deps({ open: vi.fn(() => new Promise<BillingOpenResult>(() => undefined)) });
    void runDashboardBilling(d);
    expect(d.open).toHaveBeenCalledTimes(1);
    expect(d.busy.current).toBe(true);
    expect(d.setNote).toHaveBeenCalledWith(null);
  });

  it('opened in a new tab: clears the note and frees the link', async () => {
    const d = deps();
    await runDashboardBilling(d);
    expect(d.setNote).toHaveBeenLastCalledWith(null);
    expect(d.askPin).not.toHaveBeenCalled();
    expect(d.busy.current).toBe(false);
  });

  it('a blocked tab shows the address to type', async () => {
    const d = deps({
      open: vi.fn(async (): Promise<BillingOpenResult> => ({ kind: 'browser', outcome: 'failed', url: 'https://hangulroute.com/teach/billing' })),
    });
    await runDashboardBilling(d);
    const note = d.setNote.mock.calls.at(-1)?.[0] as string | null;
    expect(note).toEqual(expect.stringContaining('https://hangulroute.com/teach/billing'));
    expect(d.askPin).not.toHaveBeenCalled();
  });

  it("same tab: 'pin' opens the PIN screen, 'opened' does not", async () => {
    const pin = deps({ sameTab: true, open: vi.fn(async (): Promise<BillingOpenResult> => ({ kind: 'same-tab', outcome: 'pin' })) });
    await runDashboardBilling(pin);
    expect(pin.open).toHaveBeenCalledWith(true);
    expect(pin.askPin).toHaveBeenCalledTimes(1);
    expect(pin.setNote).toHaveBeenLastCalledWith(null);
    const opened = deps({ sameTab: true, open: vi.fn(async (): Promise<BillingOpenResult> => ({ kind: 'same-tab', outcome: 'opened' })) });
    await runDashboardBilling(opened);
    expect(opened.askPin).not.toHaveBeenCalled();
  });

  it('a hand-off that throws settles quietly and frees the link for another tap', async () => {
    const d = deps({ open: vi.fn(async (): Promise<BillingOpenResult> => Promise.reject(new Error('boom'))) });
    await expect(runDashboardBilling(d)).resolves.toBeUndefined();
    expect(d.busy.current).toBe(false);
    expect(d.askPin).not.toHaveBeenCalled();
  });
});

describe('freeLessonsRowA11y', () => {
  const needsInternet = en.learner.welcome.grownUps.needsInternet;

  it('on the web the link is described by its line, and by "Needs the internet" too while offline', () => {
    expect(freeLessonsRowA11y('row-1', false, needsInternet, 'web')).toEqual({
      lineId: 'row-1-line',
      offlineId: 'row-1-offline',
      describedBy: 'row-1-line',
      hint: undefined,
    });
    expect(freeLessonsRowA11y('row-1', true, needsInternet, 'web')).toEqual({
      lineId: 'row-1-line',
      offlineId: 'row-1-offline',
      describedBy: 'row-1-line row-1-offline',
      hint: needsInternet,
    });
  });

  it('native has no aria-describedby; the offline hint still applies', () => {
    expect(freeLessonsRowA11y('row-1', false, needsInternet, 'ios').describedBy).toBeNull();
    expect(freeLessonsRowA11y('row-1', true, needsInternet, 'android')).toMatchObject({ describedBy: null, hint: needsInternet });
  });
});
