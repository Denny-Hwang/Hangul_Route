import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-BILL-002 B-9: the gate destination `Billing` opens today's console billing page through the
 * safe browser hand-off (`openExternalUrl`: a new tab with its opener cleared on the web, a blocked
 * tab reported as `failed`). B-9b adds the same-tab `openGrownUpArea` branch behind
 * `flags.grownUpHomeEnabled`.
 */
const openExternalUrl = vi.fn();
vi.mock('../external-link', () => ({ openExternalUrl: (url: string) => openExternalUrl(url) }));

const { openBilling } = await import('../billing-handoff');

describe('openBilling', () => {
  beforeEach(() => {
    openExternalUrl.mockReset();
    vi.unstubAllEnvs();
  });

  it("hands consoleBillingUrl() to the browser and reports what happened", async () => {
    openExternalUrl.mockResolvedValue('opened');
    await expect(openBilling()).resolves.toEqual({ outcome: 'opened', url: 'https://hangulroute.com/teach/billing' });
    expect(openExternalUrl).toHaveBeenCalledWith('https://hangulroute.com/teach/billing');
  });

  it('follows EXPO_PUBLIC_CONSOLE_URL like the old paywall button', async () => {
    vi.stubEnv('EXPO_PUBLIC_CONSOLE_URL', 'https://staging.example/');
    openExternalUrl.mockResolvedValue('opened');
    await expect(openBilling()).resolves.toEqual({ outcome: 'opened', url: 'https://staging.example/teach/billing' });
  });

  it('passes a blocked or offline hand-off back, so the screen can show the address', async () => {
    openExternalUrl.mockResolvedValue('failed');
    await expect(openBilling()).resolves.toMatchObject({ outcome: 'failed' });
    openExternalUrl.mockResolvedValue('offline');
    await expect(openBilling()).resolves.toMatchObject({ outcome: 'offline' });
  });

  it('calls the hand-off before its first await, so the web keeps the tap for the new tab', () => {
    openExternalUrl.mockReturnValue(new Promise(() => undefined));
    void openBilling();
    expect(openExternalUrl).toHaveBeenCalledTimes(1);
  });
});
