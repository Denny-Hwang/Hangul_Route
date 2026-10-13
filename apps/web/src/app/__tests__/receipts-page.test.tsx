import { RECEIPTS_PAGE_LIMIT, type BillingSpaceCard, type BillingSummary, type ReceiptView } from '@hangul-route/content-schema';
import { formatDate, getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BILLING_CSS } from '@/components/console/BillingHomeParts';

/**
 * F-BILL-002 B-8c: the receipts page at `BILLING_RECEIPTS_PATH?id=<spaceId>` (sections 4.10, 4.12, 5.3; screen spec
 * design/screens/billing/receipts.md). Rows newest first with the test pill, View receipt only where Stripe keeps a
 * page, which opens a blank tab inside the tap (opener cleared) and then sets its location to the fresh link, behind
 * step-up; a failed lookup says so on that row only; not yours, offline and error states; the table reflows to a
 * list on a narrow column.
 */
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const query = vi.hoisted(() => ({ search: 'id=space%3Afam' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(query.search),
}));

vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

const auth = vi.hoisted(() => ({ outcome: 'retry' as 'retry' | 'cancelled' | 'unavailable', calls: 0 }));
vi.mock('@/components/console/auth-context', () => ({
  useConsoleAuth: () => ({
    reverify: async (fetcher: () => Promise<unknown>) => {
      auth.calls += 1;
      if (auth.outcome === 'cancelled') return { kind: 'cancelled' };
      if (auth.outcome === 'unavailable') return { kind: 'unavailable' };
      return { kind: 'result', result: await fetcher() };
    },
  }),
}));

const calls = vi.hoisted(() => ({
  receipts: [] as unknown[],
  receiptsResult: null as unknown,
  summaryArgs: [] as unknown[],
  summaryResult: null as unknown,
  links: [] as string[],
  linkResults: [] as unknown[],
}));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const api = {
    receipts: (id: string) => {
      calls.receipts.push(id);
      return calls.receiptsResult === 'pending' ? new Promise(() => undefined) : Promise.resolve(calls.receiptsResult);
    },
    billingSummary: async (options?: unknown) => {
      calls.summaryArgs.push(options);
      return calls.summaryResult;
    },
    receiptLink: async (id: string) => {
      calls.links.push(id);
      return calls.linkResults.length > 1 ? calls.linkResults.shift() : calls.linkResults[0];
    },
  };
  const session = { accountId: 'acc_1', displayName: 'Kim' };
  return { useConsole: () => ({ ready: true, session, api, signOut: () => undefined, m: messages('en'), locale: 'en' }) };
});

import ReceiptsPage from '@/app/(console)/account/billing/receipts/page';

const en = getMessages('en');
const b = en.console.billing;
const r = b.receipts;
const HINT = {
  ok: false,
  error: 'forbidden',
  status: 403,
  code: 'reverify_required',
  clerk_error: { type: 'forbidden', reason: 'reverification-error', metadata: { reverification: { level: 'first_factor', afterMinutes: 10 } } },
};

const row = (over: Partial<ReceiptView> = {}): ReceiptView => ({ id: 'bev:r1', kind: 'renewal', planKey: 'family_lifetime', amountCents: 1530, currency: 'usd', livemode: false, occurredAt: '2028-10-05T09:00:00.000Z', hasReceipt: true, ...over });
const card = (over: Partial<BillingSpaceCard> = {}): BillingSpaceCard => ({
  spaceId: 'space:fam',
  kind: 'family',
  name: 'Kim family',
  role: 'owner',
  archived: false,
  payer: true,
  readOnlyReason: null,
  coverage: { state: 'free' },
  usage: null,
  actions: { buy: null, manage: true, contact: false },
  receipts: [],
  hasReceipts: true,
  legacyNoHistory: false,
  ...over,
});
const summary = (cards: BillingSpaceCard[]): BillingSummary => ({ mode: 'test', purchasesOpen: true, cards, account: [] });

interface FakeTab {
  opener: unknown;
  location: { href: string };
  closed: boolean;
  close: () => void;
}
const browser = vi.hoisted(() => ({ online: true, opened: [] as Array<{ url: string; features?: string }>, tabs: [] as unknown[], blockPopups: false }));

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
let win: EventTarget & { open: (url: string, target: string, features?: string) => FakeTab | null };
beforeEach(() => {
  query.search = 'id=space%3Afam';
  calls.receipts = [];
  calls.receiptsResult = { ok: true, data: { spaceName: 'Kim family', receipts: [row(), row({ id: 'bev:r2', kind: 'failed', occurredAt: '2028-10-02T09:00:00.000Z', hasReceipt: false }), row({ id: 'bev:r3', kind: 'purchase', livemode: true, occurredAt: '2027-10-02T09:00:00.000Z' })] } };
  calls.summaryArgs = [];
  calls.summaryResult = { ok: true, data: summary([card()]) };
  calls.links = [];
  calls.linkResults = [{ ok: true, data: { url: 'https://invoice.stripe.com/i/acct_1/test_1' } }];
  auth.outcome = 'retry';
  auth.calls = 0;
  browser.online = true;
  browser.opened = [];
  browser.tabs = [];
  browser.blockPopups = false;
  win = Object.assign(new EventTarget(), {
    open: (url: string, _target: string, features?: string): FakeTab | null => {
      browser.opened.push({ url, ...(features ? { features } : {}) });
      if (browser.blockPopups) return null;
      const tab: FakeTab = {
        opener: win,
        location: { href: url || 'about:blank' },
        closed: false,
        close() {
          this.closed = true;
        },
      };
      browser.tabs.push(tab);
      return tab;
    },
  });
  vi.stubGlobal('window', win);
  vi.stubGlobal('navigator', {
    get onLine() {
      return browser.online;
    },
  });
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.unstubAllGlobals();
});

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  if (node.type === 'style') return '';
  return node.children.map(textOf).join('');
}
const pageText = (): string => textOf((mounted as unknown as ReactTestRenderer).root);
async function render(): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(<ReceiptsPage />, { createNodeMock: () => ({ focus: () => undefined }) });
  });
  return (mounted as unknown as ReactTestRenderer).root;
}
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}
const rows = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => n.type === 'tr' && n.props.role === 'row').slice(1);
const viewButtons = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => n.type === 'button' && textOf(n) === r.view.cta);
const tab = (i = 0): FakeTab => browser.tabs[i] as FakeTab;
const day = (iso: string): string => formatDate('en', iso, 'monthDayYear', { utc: true });

describe('the receipts page', () => {
  it('h1 with the space name, test banner, Back to Billing, rows newest first in a captioned table', async () => {
    const root = await render();
    expect(calls.receipts).toEqual(['space:fam']);
    // The banner comes from a summary poll read: no extra view event.
    expect(calls.summaryArgs).toEqual([{ poll: true }]);
    expect(root.findAll((n) => n.type === 'h1').map(textOf)).toEqual([r.pageTitle('Kim family')]);
    expect(pageText()).toContain(b.testMode);
    expect(root.findAll((n) => n.type === 'a' && textOf(n) === r.back.cta).map((a) => a.props.href)).toEqual(['/account/billing']);
    const table = root.find((n) => n.type === 'table');
    expect(table.props.role).toBe('table');
    expect(textOf(table.findByType('caption'))).toBe(r.title);
    const body = rows(root);
    expect(body.map((tr) => textOf(tr.findAll((n) => n.props.role === 'rowheader')[0] as ReactTestInstance))).toEqual([day('2028-10-05T09:00:00.000Z'), day('2028-10-02T09:00:00.000Z'), day('2027-10-02T09:00:00.000Z')]);
    expect(textOf(body[0] as ReactTestInstance)).toContain(r.kind.renewal);
    expect(textOf(body[0] as ReactTestInstance)).toContain('$15.30');
    expect(textOf(body[0] as ReactTestInstance)).toContain(r.test.pill);
    // A live row carries no test pill.
    expect(textOf(body[2] as ReactTestInstance)).not.toContain(r.test.pill);
    // The action column's header is hidden from assistive technology.
    expect(root.findAll((n) => n.type === 'td' && n.props.role === 'columnheader' && n.props['aria-hidden'] === 'true').length).toBe(1);
  });

  it('View receipt only where Stripe keeps a page, with an accessible name that says it opens Stripe in a new tab', async () => {
    const root = await render();
    const buttons = viewButtons(root);
    expect(buttons.length).toBe(2);
    expect(buttons[0]?.props['aria-label']).toBe(r.viewA11y(day('2028-10-05T09:00:00.000Z')));
    // The failed payment is plain text: no button, no failure glyph.
    expect(rows(root)[1]?.findAll((n) => n.type === 'button')).toEqual([]);
  });

  it('View receipt opens a blank tab inside the tap, clears its opener, then sets its location', async () => {
    const root = await render();
    await act(async () => {
      viewButtons(root)[0]?.props.onClick();
    });
    await flush();
    expect(browser.opened[0]?.url).toBe('');
    expect(tab().opener).toBeNull();
    expect(calls.links).toEqual(['bev:r1']);
    expect(tab().location.href).toBe('https://invoice.stripe.com/i/acct_1/test_1');
    expect(tab().closed).toBe(false);
  });

  it('a failed lookup: the tab closes and that row says Can’t open this receipt right now', async () => {
    calls.linkResults = [{ ok: false, error: 'unknown', status: 502, code: 'receipt_unavailable' }];
    const root = await render();
    await act(async () => {
      viewButtons(root)[0]?.props.onClick();
    });
    await flush();
    expect(tab().closed).toBe(true);
    const lines = rows(root).map((tr) => textOf(tr));
    expect(lines[0]).toContain(r.linkFailed);
    expect(lines[2]).not.toContain(r.linkFailed);
  });

  it('a non-https link is never navigated to: the row says it could not open', async () => {
    calls.linkResults = [{ ok: false, error: 'unknown', status: 200, code: 'unreadable_link' }];
    const root = await render();
    await act(async () => {
      viewButtons(root)[0]?.props.onClick();
    });
    await flush();
    expect(tab().closed).toBe(true);
    expect(pageText()).toContain(r.linkFailed);
  });

  it('a blocked blank tab: the link opens in a new tab after the lookup, without an opener', async () => {
    browser.blockPopups = true;
    const root = await render();
    await act(async () => {
      viewButtons(root)[0]?.props.onClick();
    });
    await flush();
    expect(browser.opened.at(-1)).toEqual({ url: 'https://invoice.stripe.com/i/acct_1/test_1', features: 'noopener,noreferrer' });
    expect(pageText()).toContain(r.linkFailed);
  });

  it('step-up around the receipt link: Continue retries the lookup into the same tab', async () => {
    calls.linkResults = [HINT, { ok: true, data: { url: 'https://pay.stripe.com/receipts/test_2' } }];
    const root = await render();
    await act(async () => {
      viewButtons(root)[0]?.props.onClick();
    });
    const dialog = root.find((n) => n.props['data-testid'] === 'step-up' && typeof n.type === 'string');
    expect(textOf(dialog)).toContain(b.stepUp.title);
    await act(async () => {
      dialog.find((n) => n.type === 'button' && textOf(n) === b.stepUp.cta).props.onClick();
    });
    await flush();
    expect(auth.calls).toBe(1);
    expect(tab().location.href).toBe('https://pay.stripe.com/receipts/test_2');
  });

  it('step-up cancelled: the blank tab closes and the page says Nothing was changed', async () => {
    calls.linkResults = [HINT];
    const root = await render();
    await act(async () => {
      viewButtons(root)[0]?.props.onClick();
    });
    const dialog = root.find((n) => n.props['data-testid'] === 'step-up' && typeof n.type === 'string');
    await act(async () => {
      dialog.find((n) => n.type === 'button' && textOf(n) === b.stepUp.cancel.cta).props.onClick();
    });
    await flush();
    expect(tab().closed).toBe(true);
    expect(pageText()).toContain(b.stepUp.cancelled);
    expect(pageText()).not.toContain(r.linkFailed);
  });
});

describe('states', () => {
  it('not yours (403): h1 Receipts with no space name, the payer line and Back to Billing', async () => {
    calls.receiptsResult = { ok: false, error: 'forbidden', status: 403 };
    const root = await render();
    expect(root.findAll((n) => n.type === 'h1').map(textOf)).toEqual([r.title]);
    expect(pageText()).toContain(r.notYours);
    expect(root.findAll((n) => n.type === 'table')).toEqual([]);
    expect(root.findAll((n) => n.type === 'a' && textOf(n) === r.back.cta).length).toBeGreaterThanOrEqual(1);
  });

  it('an unknown space (404) or no id reads the same', async () => {
    calls.receiptsResult = { ok: false, error: 'not_found', status: 404 };
    await render();
    expect(pageText()).toContain(r.notYours);
    act(() => mounted?.unmount());
    mounted = null;
    query.search = '';
    calls.receipts = [];
    await render();
    expect(pageText()).toContain(r.notYours);
    expect(calls.receipts).toEqual([]);
  });

  it('error: Can’t load receipts right now and Try again reloads', async () => {
    calls.receiptsResult = { ok: false, error: 'unknown', status: 500 };
    const root = await render();
    expect(pageText()).toContain(r.cantLoad);
    calls.receiptsResult = { ok: true, data: { spaceName: 'Kim family', receipts: [row()] } };
    await act(async () => {
      root.find((n) => n.type === 'button' && textOf(n) === b.retry.cta).props.onClick();
    });
    await flush();
    expect(rows(root).length).toBe(1);
  });

  it('offline: the offline panel, and it reloads by itself on online', async () => {
    browser.online = false;
    calls.receiptsResult = { ok: false, error: 'network', status: -1 };
    const root = await render();
    expect(pageText()).toContain(b.offline);
    browser.online = true;
    calls.receiptsResult = { ok: true, data: { spaceName: 'Kim family', receipts: [row()] } };
    await act(async () => {
      win.dispatchEvent(new Event('online'));
    });
    await flush();
    expect(rows(root).length).toBe(1);
  });

  it('empty: No receipts yet; with a Stripe plan bought before history began: the receipt email line', async () => {
    calls.receiptsResult = { ok: true, data: { spaceName: 'Kim family', receipts: [] } };
    await render();
    expect(pageText()).toContain(r.empty);
    act(() => mounted?.unmount());
    mounted = null;
    calls.summaryResult = { ok: true, data: summary([card({ legacyNoHistory: true, hasReceipts: false })]) };
    await render();
    expect(pageText()).toContain(r.older);
    expect(pageText()).not.toContain(r.empty);
  });

  it('50 rows: the beyond-limit line under the table', async () => {
    calls.receiptsResult = { ok: true, data: { spaceName: 'Kim family', receipts: Array.from({ length: RECEIPTS_PAGE_LIMIT }, (_, i) => row({ id: `bev:r${i}` })) } };
    await render();
    expect(pageText()).toContain(r.beyondLimit);
  });

  it('loading: a busy region, no numbers', async () => {
    calls.receiptsResult = 'pending';
    const root = await render();
    expect(root.findAll((n) => n.props['aria-busy'] === true || n.props['aria-busy'] === 'true').length).toBe(1);
    expect(pageText()).not.toMatch(/\d/);
  });
});

describe('the 320 px list layout', () => {
  it('rows are blocks below a 36rem column and a table from it (container query); no fixed widths', () => {
    expect(BILLING_CSS).toContain('container:bill / inline-size');
    expect(BILLING_CSS).toMatch(/\.hr-bill-table tbody,\.hr-bill-table tr,\.hr-bill-table th,\.hr-bill-table td\{display:block\}/);
    expect(BILLING_CSS).toContain('@container bill (min-width:36rem)');
    // Only the visually hidden header row has a pixel size; no row or cell is fixed wide.
    expect(BILLING_CSS).not.toMatch(/\.hr-bill-table (tbody|tr|th(?!ead)|td|\.hr-bill-c-)[^{]*\{[^}]*\bwidth:\d+px/);
  });
});
