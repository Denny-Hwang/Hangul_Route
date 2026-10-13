import { APP_ROUTES } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-BILL-002 B-9 and B-9b (section 4.7): the gate destination `Billing`. With
 * `flags.grownUpHomeEnabled` on, a web build hands the tab to the grown-up area in the **same tab**
 * through F-APP-001's `openGrownUpArea({ via: 'plan', target: APP_ROUTES.billing })` (A-6; `via` is
 * `plan` in the shipped schema, renamed from `paywall`). With the flag off, it opens today's console
 * billing page through the safe browser hand-off (`openExternalUrl`: a new tab with its opener
 * cleared on the web, a blocked tab reported as `failed`). Native builds never take the same-tab
 * branch (the grown-up hand-off is web only, OD-6) and render no Open billing at all (`planView`).
 */
const openExternalUrl = vi.fn();
vi.mock('../external-link', () => ({ openExternalUrl: (url: string) => openExternalUrl(url) }));
const openGrownUpArea = vi.fn();
vi.mock('../grown-up-handoff', () => ({ openGrownUpArea: (request: unknown) => openGrownUpArea(request) }));

const { flags } = await import('../../config/flags');
const { BILLING_HANDOFF, DASHBOARD_BILLING_HANDOFF, billingOpensSameTab, openBilling } = await import('../billing-handoff');

const initialFlag = flags.grownUpHomeEnabled;

describe('openBilling, flag off (B-9)', () => {
  beforeEach(() => {
    openExternalUrl.mockReset();
    openGrownUpArea.mockReset();
    vi.unstubAllEnvs();
    flags.grownUpHomeEnabled = false;
    vi.stubEnv('EXPO_OS', 'web');
  });

  afterEach(() => {
    flags.grownUpHomeEnabled = initialFlag;
    vi.unstubAllEnvs();
  });

  it("hands consoleBillingUrl() to the browser and reports what happened", async () => {
    openExternalUrl.mockResolvedValue('opened');
    await expect(openBilling()).resolves.toEqual({ kind: 'browser', outcome: 'opened', url: 'https://hangulroute.com/teach/billing' });
    expect(openExternalUrl).toHaveBeenCalledWith('https://hangulroute.com/teach/billing');
    expect(openGrownUpArea).not.toHaveBeenCalled();
  });

  it('follows EXPO_PUBLIC_CONSOLE_URL like the old paywall button', async () => {
    vi.stubEnv('EXPO_PUBLIC_CONSOLE_URL', 'https://staging.example/');
    openExternalUrl.mockResolvedValue('opened');
    await expect(openBilling()).resolves.toEqual({ kind: 'browser', outcome: 'opened', url: 'https://staging.example/teach/billing' });
  });

  it('passes a blocked or offline hand-off back, so the screen can show the address', async () => {
    openExternalUrl.mockResolvedValue('failed');
    await expect(openBilling()).resolves.toMatchObject({ kind: 'browser', outcome: 'failed' });
    openExternalUrl.mockResolvedValue('offline');
    await expect(openBilling()).resolves.toMatchObject({ kind: 'browser', outcome: 'offline' });
  });

  it('calls the hand-off before its first await, so the web keeps the tap for the new tab', () => {
    openExternalUrl.mockReturnValue(new Promise(() => undefined));
    void openBilling();
    expect(openExternalUrl).toHaveBeenCalledTimes(1);
  });
});

describe('openBilling, flag on (B-9b)', () => {
  beforeEach(() => {
    openExternalUrl.mockReset();
    openGrownUpArea.mockReset();
    vi.unstubAllEnvs();
    flags.grownUpHomeEnabled = true;
    vi.stubEnv('EXPO_OS', 'web');
  });

  afterEach(() => {
    flags.grownUpHomeEnabled = initialFlag;
    vi.unstubAllEnvs();
  });

  it("the Billing destination is openGrownUpArea({ via: 'plan', target: APP_ROUTES.billing })", () => {
    expect(BILLING_HANDOFF).toEqual({ via: 'plan', target: APP_ROUTES.billing });
    expect(APP_ROUTES.billing).toBe('/account/billing');
  });

  it('hands off in the same tab through openGrownUpArea, never a new tab or the console URL', async () => {
    openGrownUpArea.mockResolvedValue('opened');
    await expect(openBilling()).resolves.toEqual({ kind: 'same-tab', outcome: 'opened' });
    expect(openGrownUpArea).toHaveBeenCalledTimes(1);
    expect(openGrownUpArea).toHaveBeenCalledWith({ via: 'plan', target: '/account/billing' });
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it("reports 'pin' when a fresh PIN is needed first, so the screen opens the PIN screen", async () => {
    openGrownUpArea.mockResolvedValue('pin');
    await expect(openBilling()).resolves.toEqual({ kind: 'same-tab', outcome: 'pin' });
    expect(openExternalUrl).not.toHaveBeenCalled();
  });

  it("the dashboard's free-lessons line hands off as via 'dashboard', so it is not counted as a Plan screen tap (F-ENT-003 E3-12b)", async () => {
    expect(DASHBOARD_BILLING_HANDOFF).toEqual({ via: 'dashboard', target: APP_ROUTES.billing });
    openGrownUpArea.mockResolvedValue('opened');
    await expect(openBilling(true, DASHBOARD_BILLING_HANDOFF)).resolves.toEqual({ kind: 'same-tab', outcome: 'opened' });
    expect(openGrownUpArea).toHaveBeenCalledWith({ via: 'dashboard', target: '/account/billing' });
  });

  it('ignores EXPO_PUBLIC_CONSOLE_URL: billing is a page of this origin', async () => {
    vi.stubEnv('EXPO_PUBLIC_CONSOLE_URL', 'http://localhost:3000');
    openGrownUpArea.mockResolvedValue('opened');
    await openBilling();
    expect(openGrownUpArea).toHaveBeenCalledWith({ via: 'plan', target: '/account/billing' });
  });

  it('native builds never take the same-tab branch, whatever the flag says (web only, F-APP-001 OD-6)', async () => {
    for (const os of ['ios', 'android']) {
      vi.stubEnv('EXPO_OS', os);
      expect(billingOpensSameTab(), os).toBe(false);
    }
    vi.stubEnv('EXPO_OS', 'ios');
    openExternalUrl.mockResolvedValue('opened');
    await openBilling();
    expect(openGrownUpArea).not.toHaveBeenCalled();
  });
});

describe('billingOpensSameTab', () => {
  it('is true on the web with the flag on, and only then', () => {
    expect(billingOpensSameTab({ grownUpHomeEnabled: true }, 'web')).toBe(true);
    expect(billingOpensSameTab({ grownUpHomeEnabled: false }, 'web')).toBe(false);
    expect(billingOpensSameTab({ grownUpHomeEnabled: true }, 'ios')).toBe(false);
    expect(billingOpensSameTab({ grownUpHomeEnabled: true }, 'android')).toBe(false);
    expect(billingOpensSameTab({ grownUpHomeEnabled: true }, undefined)).toBe(false);
  });

  it('reads flags.grownUpHomeEnabled and the bundle platform by default', () => {
    const before = flags.grownUpHomeEnabled;
    try {
      vi.stubEnv('EXPO_OS', 'web');
      flags.grownUpHomeEnabled = true;
      expect(billingOpensSameTab()).toBe(true);
      flags.grownUpHomeEnabled = false;
      expect(billingOpensSameTab()).toBe(false);
    } finally {
      flags.grownUpHomeEnabled = before;
      vi.unstubAllEnvs();
    }
  });
});
