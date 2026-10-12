import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-BILL-002 B-9 review: with `flags.grownUpHomeEnabled` off, Open billing goes through the safe
 * hand-off, which takes plain `https:` links only. A console base on `http:` (a local
 * `EXPO_PUBLIC_CONSOLE_URL=http://localhost:3000`) is never opened: the screen gets `failed` with
 * the address, and shows it to type. Production and preview bases are https, so the rule is
 * documented rather than loosened for dev builds. With the flag on (B-9b) the console base plays no
 * part: billing opens in this tab through `openGrownUpArea`, and no new tab is ever asked for.
 */
vi.mock('../external-link', async () => vi.importActual('../external-link.web'));
const openGrownUpArea = vi.fn(async (_request: unknown) => 'opened' as const);
vi.mock('../grown-up-handoff', () => ({ openGrownUpArea: (request: unknown) => openGrownUpArea(request) }));

const { flags } = await import('../../config/flags');
const { openBilling } = await import('../billing-handoff');

const initialFlag = flags.grownUpHomeEnabled;

describe('openBilling with a non-https console base', () => {
  const open = vi.fn(() => ({ opener: {} }));

  beforeEach(() => {
    flags.grownUpHomeEnabled = false;
    vi.stubEnv('EXPO_OS', 'web');
  });

  afterEach(() => {
    flags.grownUpHomeEnabled = initialFlag;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    open.mockClear();
    openGrownUpArea.mockClear();
  });

  it('refuses an http base: no tab, outcome failed, the address passed back to show', async () => {
    vi.stubGlobal('open', open);
    vi.stubEnv('EXPO_PUBLIC_CONSOLE_URL', 'http://localhost:3000');
    await expect(openBilling()).resolves.toEqual({ kind: 'browser', outcome: 'failed', url: 'http://localhost:3000/teach/billing' });
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the same base on https in a new tab', async () => {
    vi.stubGlobal('open', open);
    vi.stubEnv('EXPO_PUBLIC_CONSOLE_URL', 'https://localhost:3000');
    await expect(openBilling()).resolves.toEqual({ kind: 'browser', outcome: 'opened', url: 'https://localhost:3000/teach/billing' });
    expect(open).toHaveBeenCalledWith('https://localhost:3000/teach/billing', '_blank');
  });

  it('with the flag on (B-9b), an http base opens no tab either: billing goes through the same-tab hand-off', async () => {
    flags.grownUpHomeEnabled = true;
    vi.stubGlobal('open', open);
    vi.stubEnv('EXPO_PUBLIC_CONSOLE_URL', 'http://localhost:3000');
    await expect(openBilling()).resolves.toEqual({ kind: 'same-tab', outcome: 'opened' });
    expect(open).not.toHaveBeenCalled();
    expect(openGrownUpArea).toHaveBeenCalledWith({ via: 'plan', target: '/account/billing' });
  });
});
