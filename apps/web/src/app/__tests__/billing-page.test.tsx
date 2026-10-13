import { FAMILY_LIFETIME_LEARNERS, FREE_CLASS_STUDENT_CAP, type BillingSpaceCard, type BillingSummary, type Promo } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { findBannedWord } from '@/lib/console/banned-text';
import { planPrice, promoPriceLine } from '@/lib/console/billing';

/**
 * F-BILL-002 B-8a: the billing home at `/account/billing` (`APP_ROUTES.billing`), drawn from B-7's view model
 * (screen spec design/screens/billing/billing-home.md, mocks billing-home*.html). Renders inside F-APP-001's grown-up
 * layout with `noindex`; the mode banner; the offer inside the one buyable card or Add a plan for several (one
 * primary); viewer cards with no price, button or receipt; Connect a learner; the past-due note; the offline and
 * error panels; offline after load; checkout, Manage subscription and Have a code?.
 */
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(''),
}));

// The frame has its own tests (adult-frame.test.tsx); here it records what the page hands it.
const frame = vi.hoisted(() => ({ spaces: [] as unknown[] }));
vi.mock('@/components/console/AdultFrame', () => ({
  AdultFrame: ({ children, spaces }: { children: ReactNode; spaces?: unknown }) => {
    frame.spaces.push(spaces);
    return <main>{children}</main>;
  },
}));

type Result = { ok: true; data: unknown } | { ok: false; error: string; status: number; code?: string };
const calls = vi.hoisted(() => ({
  summaries: [] as Array<() => Promise<unknown>>,
  summaryCalls: 0,
  checkout: [] as unknown[],
  checkoutResult: null as unknown,
  portal: [] as unknown[],
  portalResult: null as unknown,
  promo: [] as unknown[],
  promoResult: null as unknown,
  api: true,
}));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const api = {
    billingSummary: () => {
      calls.summaryCalls += 1;
      const next = calls.summaries.length > 1 ? calls.summaries.shift() : calls.summaries[0];
      return next ? next() : Promise.resolve({ ok: false, error: 'network', status: -1 });
    },
    checkout: async (body: unknown) => {
      calls.checkout.push(body);
      return calls.checkoutResult;
    },
    portal: async (body: unknown) => {
      calls.portal.push(body);
      return calls.portalResult;
    },
    checkPromo: async (body: unknown) => {
      calls.promo.push(body);
      return calls.promoResult;
    },
  };
  const session = { accountId: 'acc_1', displayName: 'Kim' };
  const signOut = (): undefined => undefined;
  return {
    useConsole: () => ({ ready: true, session, api: calls.api ? api : null, signOut, m: messages('en'), locale: 'en' }),
  };
});

import AccountLayout, { metadata } from '@/app/(console)/account/layout';
import BillingPage from '@/app/(console)/account/billing/page';

const en = getMessages('en');
const b = en.console.billing;
const YEAR_ON = '2099-10-12T00:00:00.000Z';

const card = (over: Partial<BillingSpaceCard> = {}): BillingSpaceCard => ({
  spaceId: 'space:fam',
  kind: 'family',
  name: 'Kim family',
  role: 'owner',
  archived: false,
  payer: true,
  readOnlyReason: null,
  coverage: { state: 'free' },
  usage: { learners: 2, learnerCap: FAMILY_LIFETIME_LEARNERS, teachers: null, teacherCap: null },
  actions: { buy: 'family_lifetime', manage: false, contact: false },
  receipts: [],
  hasReceipts: false,
  legacyNoHistory: false,
  ...over,
});
const own = (over: Partial<Extract<BillingSpaceCard['coverage'], { state: 'own' }>> = {}): BillingSpaceCard['coverage'] => ({
  state: 'own',
  planKey: 'family_lifetime',
  status: 'active',
  expiresAt: YEAR_ON,
  statusSince: '2026-10-01T00:00:00.000Z',
  endsAtPeriodEnd: false,
  ...over,
});
const summary = (cards: BillingSpaceCard[], over: Partial<BillingSummary> = {}): BillingSummary => ({ mode: 'test', purchasesOpen: true, cards, account: [], ...over });
const ok = (s: BillingSummary): (() => Promise<Result>) => () => Promise.resolve({ ok: true, data: s });
const failed = (error = 'network'): (() => Promise<Result>) => () => Promise.resolve({ ok: false, error, status: error === 'network' ? -1 : 500 });

const browser = vi.hoisted(() => ({ assigned: [] as string[], online: true }));

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
let win: EventTarget & { location: { assign: (url: string) => void; search: string; pathname: string }; history: { replaceState: () => void } };
beforeEach(() => {
  frame.spaces = [];
  calls.summaries = [ok(summary([card()]))];
  calls.summaryCalls = 0;
  calls.checkout = [];
  calls.checkoutResult = { ok: true, data: { url: 'https://checkout.stripe.com/c/pay/cs_test_1' } };
  calls.portal = [];
  calls.portalResult = { ok: true, data: { url: 'https://billing.stripe.com/p/session/test_1' } };
  calls.promo = [];
  calls.promoResult = null;
  calls.api = true;
  browser.assigned = [];
  browser.online = true;
  win = Object.assign(new EventTarget(), {
    location: { assign: (url: string) => void browser.assigned.push(url), search: '', pathname: '/account/billing' },
    history: { replaceState: () => undefined },
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

async function render(): Promise<ReactTestInstance> {
  await act(async () => {
    mounted = create(<BillingPage />);
  });
  return (mounted as unknown as ReactTestRenderer).root;
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  // The page's style sheet is not text a reader sees.
  if (node.type === 'style') return '';
  return node.children.map(textOf).join('');
}

function pageText(): string {
  return textOf((mounted as unknown as ReactTestRenderer).root);
}

const byTestId = (root: ReactTestInstance, id: string): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);
const buttons = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => n.type === 'button');
const buttonNamed = (root: ReactTestInstance, name: string): ReactTestInstance => {
  const found = buttons(root).filter((n) => textOf(n) === name);
  if (found.length !== 1) throw new Error(`expected one "${name}" button, found ${found.length}`);
  return found[0] as ReactTestInstance;
};
const primaries = (root: ReactTestInstance): ReactTestInstance[] => root.findAll((n) => typeof n.type === 'string' && typeof n.props.className === 'string' && n.props.className.split(' ').includes('hr-bill-btn-primary'));

describe('layout and indexing', () => {
  it('the /account layout carries noindex and wraps the page in the grown-up layout', async () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    const tree = AccountLayout({ children: <p>body</p> });
    expect((tree.type as { name?: string }).name).toBe('GrownUpLayout');
  });

  it('one h1 (Billing); the frame reads its own spaces (the page reads only the summary)', async () => {
    const root = await render();
    expect(root.findAll((n) => n.type === 'h1').map(textOf)).toEqual([b.title]);
    expect(frame.spaces.every((s) => s === undefined)).toBe(true);
    expect(calls.summaryCalls).toBe(1);
  });
});

describe('loading, banner and the offer', () => {
  it('loading: a busy region with grey outlines and no numbers', async () => {
    calls.summaries = [() => new Promise(() => undefined)];
    const root = await render();
    const busy = root.findAll((n) => n.props['aria-busy'] === 'true' || n.props['aria-busy'] === true);
    expect(busy.length).toBe(1);
    expect(pageText()).not.toMatch(/\d/);
  });

  it('test mode: the banner, the offer inside the one buyable card, one primary button, no Add a plan', async () => {
    const root = await render();
    const text = pageText();
    expect(text).toContain(b.testMode);
    expect(text).toContain(`${b.kind.family} · Kim family`);
    expect(text).toContain(planPrice('family_lifetime', 'en'));
    expect(text).toContain(b.includesLines.family.everyLesson);
    expect(text).not.toContain(b.sections.add);
    const cardSections = byTestId(root, 'bill-card');
    expect(cardSections.length).toBe(1);
    expect(cardSections[0]?.findAll((n) => n.props.role === 'group').length).toBe(1);
    expect(primaries(root).map(textOf)).toEqual([b.buy.family_lifetime.cta]);
    // Have a code? is a native disclosure directly under the price line it rewrites.
    const details = root.findAll((n) => n.type === 'details');
    expect(details.map((d) => textOf(d.findByType('summary')))).toContain(b.promo.disclosure);
  });

  it('two buyable spaces: Add a plan with one row each, exactly one primary', async () => {
    const classCard = card({ spaceId: 'space:cls', kind: 'class', name: 'Room 4', usage: { learners: 3, learnerCap: FREE_CLASS_STUDENT_CAP, teachers: null, teacherCap: null }, actions: { buy: 'group_license', manage: false, contact: false } });
    calls.summaries = [ok(summary([card(), classCard]))];
    const root = await render();
    const text = pageText();
    expect(text).toContain(b.sections.add);
    expect(text).toContain(b.buy.forSpace('Group License', 'Room 4'));
    expect(primaries(root).length).toBe(1);
    expect(byTestId(root, 'bill-offer').length).toBe(2);
    // The cards themselves carry no offer.
    for (const c of byTestId(root, 'bill-card')) expect(c.findAll((n) => n.props.role === 'group').length).toBe(0);
  });

  it('not configured and live-off: their banner; buy, Manage and Apply code disabled', async () => {
    for (const [mode, words] of [
      ['none', b.notConfigured],
      ['live', b.liveOff],
    ] as const) {
      calls.summaries = [ok(summary([card()], { mode, purchasesOpen: false }))];
      const root = await render();
      expect(pageText()).toContain(words);
      expect(buttonNamed(root, b.buy.family_lifetime.cta).props.disabled).toBe(true);
      expect(buttonNamed(root, b.promo.apply.cta).props.disabled).toBe(true);
      act(() => mounted?.unmount());
      mounted = null;
    }
  });
});

describe('cards per persona', () => {
  it('a viewer card: plan, usage and who manages it; no price, no button, no receipt', async () => {
    calls.summaries = [ok(summary([card({ payer: false, role: 'caregiver', readOnlyReason: 'family', coverage: own(), actions: { buy: null, manage: false, contact: false } })]))];
    const root = await render();
    const text = pageText();
    expect(text).toContain(b.coverage.family);
    expect(text).toContain(b.readOnly.family);
    expect(text).not.toMatch(/\$\d/);
    expect(buttons(byTestId(root, 'bill-card')[0] as ReactTestInstance)).toEqual([]);
    expect(text).not.toContain(b.receipts.title);
  });

  it('a payer with the Family Plan: Manage subscription opens the portal', async () => {
    calls.summaries = [ok(summary([card({ coverage: own(), actions: { buy: null, manage: true, contact: false } })]))];
    const root = await render();
    await act(async () => {
      buttonNamed(root, b.manage.cta).props.onClick();
    });
    expect(calls.portal).toEqual([{ subjectKind: 'space', subjectId: 'space:fam' }]);
    expect(browser.assigned).toEqual(['https://billing.stripe.com/p/session/test_1']);
  });

  it('receipts: up to three inline rows in a disclosure, then All receipts to the receipts page', async () => {
    const receipt = { id: 'bev:r1', kind: 'purchase' as const, planKey: 'family_lifetime' as const, amountCents: 1530, currency: 'usd', livemode: false, occurredAt: '2026-10-01T09:00:00.000Z', hasReceipt: true };
    calls.summaries = [ok(summary([card({ coverage: own(), actions: { buy: null, manage: true, contact: false }, receipts: [receipt], hasReceipts: true })]))];
    const root = await render();
    const details = root.findAll((n) => n.type === 'details');
    expect(details.map((d) => textOf(d.findByType('summary')))).toContain(b.receipts.title);
    const all = root.findAll((n) => n.type === 'a' && textOf(n) === b.receipts.all.cta);
    expect(all.map((a) => a.props.href)).toEqual(['/account/billing/receipts?id=space%3Afam']);
    expect(pageText()).toContain(b.receipts.test.pill);
    // No link to Stripe on the billing home: receipt links live behind step-up on the receipts page.
    expect(root.findAll((n) => n.type === 'a' && /stripe/.test(String(n.props.href)))).toEqual([]);
  });

  it('a Family Plan with no learner yet: Connect a learner goes to the family page', async () => {
    calls.summaries = [ok(summary([card({ coverage: own(), usage: { learners: 0, learnerCap: FAMILY_LIFETIME_LEARNERS, teachers: null, teacherCap: null }, actions: { buy: null, manage: true, contact: false } })]))];
    const root = await render();
    expect(pageText()).toContain(b.connectLearner.line);
    const link = root.find((n) => n.type === 'a' && textOf(n) === b.connectLearner.cta);
    expect(link.props.href).toBe('/parent/space?id=space%3Afam');
  });

  it('a school payer: Contact us is a mail link with a fixed subject', async () => {
    calls.summaries = [ok(summary([card({ spaceId: 'space:sch', kind: 'school', name: 'Maple School', coverage: own({ planKey: 'group_license' }), usage: { learners: 212, learnerCap: 300, teachers: 7, teacherCap: 10 }, actions: { buy: null, manage: true, contact: true } })]))];
    const root = await render();
    const link = root.find((n) => n.type === 'a' && textOf(n) === b.contact.cta);
    expect(String(link.props.href)).toMatch(/^mailto:/);
    expect(String(link.props.href)).not.toContain('Maple');
  });

  it('past due: one neutral note above the cards', async () => {
    const since = new Date(Date.now() - 60_000).toISOString();
    calls.summaries = [ok(summary([card({ coverage: own({ status: 'past_due', statusSince: since }), actions: { buy: null, manage: true, contact: false } })]))];
    await render();
    expect(pageText()).toContain(b.pastDue);
  });

  it('no space yet: the two set-up buttons, and Help', async () => {
    calls.summaries = [ok(summary([]))];
    const root = await render();
    const text = pageText();
    expect(text).toContain(b.noSpaces.title);
    expect(root.find((n) => n.type === 'a' && textOf(n) === b.noSpaces.family.cta).props.href).toBe('/start?persona=parent');
    expect(root.find((n) => n.type === 'a' && textOf(n) === b.noSpaces.class.cta).props.href).toBe('/start?persona=teacher');
    expect(text).toContain(b.help.learners);
  });

  it('Help: refund contact, learners never see prices, shared device', async () => {
    await render();
    const text = pageText();
    expect(text).toContain(b.help.refund('hello@hangulroute.com'));
    expect(text).toContain(b.help.learners);
    expect(text).toContain(b.help.sharedDevice);
    expect(findBannedWord(text)).toBeNull();
    expect(text).not.toMatch(/lifetime|Premium|kids/i);
  });
});

describe('offline and errors', () => {
  it('offline: the panel with Try again, no cards and no Help; reloads by itself on online', async () => {
    browser.online = false;
    calls.summaries = [failed('network'), ok(summary([card()]))];
    const root = await render();
    expect(pageText()).toContain(b.offline);
    expect(byTestId(root, 'bill-card')).toEqual([]);
    expect(pageText()).not.toContain(b.help.learners);
    browser.online = true;
    await act(async () => {
      win.dispatchEvent(new Event('online'));
    });
    await flush();
    expect(calls.summaryCalls).toBe(2);
    expect(byTestId(root, 'bill-card').length).toBe(1);
  });

  it('error while online: Can’t check your plan and Try again reloads', async () => {
    calls.summaries = [failed('unknown'), ok(summary([card()]))];
    const root = await render();
    expect(pageText()).toContain(b.cantCheck);
    await act(async () => {
      buttonNamed(root, b.retry.cta).props.onClick();
    });
    expect(calls.summaryCalls).toBe(2);
    expect(byTestId(root, 'bill-card').length).toBe(1);
  });

  it('offline after the cards loaded: the offline line, buy disabled, Receipts still open', async () => {
    const receipt = { id: 'bev:r1', kind: 'purchase' as const, planKey: 'group_license' as const, amountCents: 15300, currency: 'usd', livemode: false, occurredAt: '2026-10-01T09:00:00.000Z', hasReceipt: true };
    const licensed = card({ spaceId: 'space:cls', kind: 'class', name: 'Room 4', coverage: own({ planKey: 'group_license' }), usage: { learners: 3, learnerCap: null, teachers: null, teacherCap: null }, actions: { buy: null, manage: true, contact: false }, receipts: [receipt], hasReceipts: true });
    calls.summaries = [ok(summary([card(), licensed]))];
    const root = await render();
    await act(async () => {
      browser.online = false;
      win.dispatchEvent(new Event('offline'));
    });
    expect(pageText()).toContain(b.offline);
    expect(buttonNamed(root, b.buy.family_lifetime.cta).props.disabled).toBe(true);
    expect(buttonNamed(root, b.manage.cta).props.disabled).toBe(true);
    expect(root.findAll((n) => n.type === 'a' && textOf(n) === b.receipts.all.cta).length).toBe(1);
  });

  it('without an API address: the console notice, no request', async () => {
    calls.api = false;
    await render();
    expect(pageText()).toContain(en.console.shell.noApi);
    expect(calls.summaryCalls).toBe(0);
  });
});

describe('buying', () => {
  it('Get Family Plan starts checkout for that space and goes to Stripe', async () => {
    const root = await render();
    await act(async () => {
      buttonNamed(root, b.buy.family_lifetime.cta).props.onClick();
    });
    expect(calls.checkout).toEqual([{ planKey: 'family_lifetime', subjectKind: 'space', subjectId: 'space:fam' }]);
    expect(browser.assigned).toEqual(['https://checkout.stripe.com/c/pay/cs_test_1']);
  });

  it('409 already_active: the note, nothing charged, and the summary reloads', async () => {
    calls.checkoutResult = { ok: false, error: 'unknown', status: 409, code: 'already_active' };
    const root = await render();
    await act(async () => {
      buttonNamed(root, b.buy.family_lifetime.cta).props.onClick();
    });
    await flush();
    expect(pageText()).toContain(b.alreadyActive);
    expect(calls.summaryCalls).toBe(2);
    expect(browser.assigned).toEqual([]);
  });

  it('a checkout error: Couldn’t start checkout', async () => {
    calls.checkoutResult = { ok: false, error: 'unknown', status: 500, code: 'stripe_error' };
    const root = await render();
    await act(async () => {
      buttonNamed(root, b.buy.family_lifetime.cta).props.onClick();
    });
    expect(pageText()).toContain(b.checkoutFailed);
  });

  it('Have a code?: Apply code checks it for the first offer and rewrites the price line; checkout carries it', async () => {
    const promo: Promo = { id: 'promo_1', code: 'HOYA20', name: null, percentOff: 20, amountOffCents: null, duration: 'once' };
    calls.promoResult = { ok: true, data: { promo } };
    const root = await render();
    const input = root.find((n) => n.type === 'input' && n.props.name === 'promo');
    act(() => input.props.onChange({ target: { value: ' hoya20 ' } }));
    const form = root.find((n) => n.type === 'form');
    await act(async () => {
      form.props.onSubmit({ preventDefault: () => undefined });
    });
    expect(calls.promo).toEqual([{ code: 'hoya20', planKey: 'family_lifetime' }]);
    expect(pageText()).toContain(b.promo.applied('HOYA20', null));
    expect(pageText()).toContain('HOYA20');
    await act(async () => {
      buttonNamed(root, b.buy.family_lifetime.cta).props.onClick();
    });
    expect(calls.checkout).toEqual([{ planKey: 'family_lifetime', subjectKind: 'space', subjectId: 'space:fam', promoCode: 'HOYA20' }]);
  });

  it('a code checked for the Family Plan: the Group License row keeps the plain price and its checkout carries no code', async () => {
    const classCard = card({ spaceId: 'space:cls', kind: 'class', name: 'Room 4', usage: { learners: 3, learnerCap: FREE_CLASS_STUDENT_CAP, teachers: null, teacherCap: null }, actions: { buy: 'group_license', manage: false, contact: false } });
    calls.summaries = [ok(summary([card(), classCard]))];
    const promo: Promo = { id: 'promo_1', code: 'HOYA20', name: null, percentOff: 20, amountOffCents: null, duration: 'once' };
    calls.promoResult = { ok: true, data: { promo } };
    const root = await render();
    const input = root.find((n) => n.type === 'input' && n.props.name === 'promo');
    act(() => input.props.onChange({ target: { value: 'HOYA20' } }));
    await act(async () => {
      root.find((n) => n.type === 'form').props.onSubmit({ preventDefault: () => undefined });
    });
    expect(calls.promo).toEqual([{ code: 'HOYA20', planKey: 'family_lifetime' }]);
    const offers = byTestId(root, 'bill-offer');
    expect(textOf(offers[0] as ReactTestInstance)).toContain(promoPriceLine('family_lifetime', promo, 'en') as string);
    expect(textOf(offers[1] as ReactTestInstance)).toContain(planPrice('group_license', 'en'));
    expect(textOf(offers[1] as ReactTestInstance)).not.toContain('HOYA20');
    await act(async () => {
      buttonNamed(root, b.buy.group_license.cta).props.onClick();
    });
    expect(calls.checkout).toEqual([{ planKey: 'group_license', subjectKind: 'space', subjectId: 'space:cls' }]);
  });
});
