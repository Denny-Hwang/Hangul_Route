import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * F-BILL-002 B-9 review: Open billing goes through the safe hand-off, which takes plain `https:`
 * links only. A console base on `http:` (a local `EXPO_PUBLIC_CONSOLE_URL=http://localhost:3000`)
 * is never opened: the screen gets `failed` with the address, and shows it to type. Production and
 * preview bases are https, so the rule is documented rather than loosened for dev builds.
 */
vi.mock('../external-link', async () => vi.importActual('../external-link.web'));

const { openBilling } = await import('../billing-handoff');

describe('openBilling with a non-https console base', () => {
  const open = vi.fn(() => ({ opener: {} }));

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    open.mockClear();
  });

  it('refuses an http base: no tab, outcome failed, the address passed back to show', async () => {
    vi.stubGlobal('open', open);
    vi.stubEnv('EXPO_PUBLIC_CONSOLE_URL', 'http://localhost:3000');
    await expect(openBilling()).resolves.toEqual({ outcome: 'failed', url: 'http://localhost:3000/teach/billing' });
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the same base on https in a new tab', async () => {
    vi.stubGlobal('open', open);
    vi.stubEnv('EXPO_PUBLIC_CONSOLE_URL', 'https://localhost:3000');
    await expect(openBilling()).resolves.toEqual({ outcome: 'opened', url: 'https://localhost:3000/teach/billing' });
    expect(open).toHaveBeenCalledWith('https://localhost:3000/teach/billing', '_blank');
  });
});
