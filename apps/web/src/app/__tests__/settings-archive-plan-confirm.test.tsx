import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * F-BILL-002 B-12 (section 4.6): the space settings archive confirm names the active plan it affects. The page
 * reads the billing summary quietly (`poll`, so no billing view event) and adds the plan line to the confirm; a
 * failed read, or a space with no plan of its own, keeps the plain confirm. Unarchive never asks.
 */
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams('id=space%3Afam'),
}));
vi.mock('@/components/console/AdultFrame', () => ({ AdultFrame: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

const YEAR_ON = '2099-10-12T00:00:00.000Z';
const state = vi.hoisted(() => ({
  kind: 'family' as string,
  name: 'Kim family',
  archivedAt: null as string | null,
  summary: null as unknown,
  locale: 'en' as 'en' | 'ko' | 'es',
  // When set, the summary read waits for the test to call it.
  hold: null as null | ((release: () => void) => void),
  summaryCalls: [] as unknown[],
  archiveCalls: [] as unknown[],
}));
vi.mock('@/components/console/use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const api = {
    roster: async () => ({
      ok: true,
      data: {
        space: { id: 'space:fam', kind: state.kind, name: state.name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: state.archivedAt, createdAt: '2026-09-01T00:00:00.000Z' },
        learners: [],
        joinCode: null,
        joinCodeExpiresAt: null,
      },
    }),
    members: async () => ({ ok: true, data: [{ memberKind: 'account', memberId: 'acc_1', role: 'owner', joinedAt: '2026-09-01T00:00:00.000Z', name: 'Kim', isOwner: true }] }),
    billingSummary: async (options: unknown) => {
      state.summaryCalls.push(options);
      if (state.hold) await new Promise<void>((release) => state.hold?.(release));
      return state.summary;
    },
    archiveSpace: async (...args: unknown[]) => {
      state.archiveCalls.push(args);
      return { ok: true, data: {} };
    },
    transferRequests: async () => ({ ok: true, data: { requests: [], options: [] } }),
  };
  const session = { accountId: 'acc_1', displayName: 'Kim' };
  return { useConsole: () => ({ ready: true, session, api, signOut: () => undefined, m: messages(state.locale), locale: state.locale }) };
});

import SettingsPage from '@/app/(console)/teach/space/settings/page';

const m = getMessages('en').console;
const words = m.billing.archiveConfirm;
const plainAsk = (name: string) => `${m.settings.danger.archiveAsk(name)} ${m.archiveKeeps}`;

const card = (coverage: unknown, kind = 'family') => ({
  spaceId: 'space:fam',
  kind,
  name: state.name,
  role: 'owner',
  archived: false,
  payer: true,
  readOnlyReason: null,
  coverage,
  usage: { learners: 1, learnerCap: 5, teachers: null, teacherCap: null },
  actions: { buy: null, manage: true, contact: false },
  receipts: [],
  hasReceipts: false,
  legacyNoHistory: false,
});
const own = (planKey: string) => ({ state: 'own', planKey, status: 'active', expiresAt: YEAR_ON, statusSince: '2026-10-01T00:00:00.000Z', endsAtPeriodEnd: false });
const okSummary = (cards: unknown[]) => ({ ok: true, data: { mode: 'test', purchasesOpen: true, cards, account: [] } });

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let renderer: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  vi.unstubAllGlobals();
  state.kind = 'family';
  state.name = 'Kim family';
  state.archivedAt = null;
  state.summary = null;
  state.locale = 'en';
  state.hold = null;
  state.summaryCalls = [];
  state.archiveCalls = [];
});

const textOf = (n: ReactTestInstance): string => n.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');

/** Every question the page's ConfirmSheet asked (AMENDMENTS-DISPLAY-NAV section 8), in order. */
let asked: string[] = [];

/** Answers the ConfirmSheet when one is open: records its question, then presses the verb or Cancel. */
async function respond(answer: boolean): Promise<void> {
  const root = (renderer as unknown as ReactTestRenderer).root;
  const sheet = root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === 'confirm-sheet')[0];
  if (!sheet) return;
  asked.push(textOf(sheet.findByType('h2')));
  const button = root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === (answer ? 'confirm-sheet-confirm' : 'confirm-sheet-cancel'))[0] as ReactTestInstance;
  await act(async () => {
    button.props.onClick();
  });
  await act(async () => undefined);
}

async function clickArchive(answer = false): Promise<string[]> {
  asked = [];
  vi.stubGlobal('window', { addEventListener: () => undefined, removeEventListener: () => undefined });
  await act(async () => {
    renderer = create(<SettingsPage />);
  });
  await act(async () => undefined);
  const root = (renderer as unknown as ReactTestRenderer).root;
  const danger = root.find((n) => n.type === 'section' && n.props['aria-label'] === m.settings.danger.title);
  const button = danger.findAll((n) => n.type === 'button')[0] as ReactTestInstance;
  await act(async () => {
    button.props.onClick();
  });
  await act(async () => undefined);
  await respond(answer);
  return asked;
}

describe('the archive confirm names the plan (F-BILL-002 B-12)', () => {
  it('a family with a renewing Family Plan: learners lose it while archived, and it keeps renewing', async () => {
    state.summary = okSummary([card(own('family_lifetime'))]);
    const asked = await clickArchive();
    expect(asked).toEqual([`${plainAsk('Kim family')}\n\n${words.familyLoses('Kim family')} ${words.familyRenews}`]);
    // Read quietly: the settings page never counts as a billing home view.
    expect(state.summaryCalls).toEqual([{ poll: true }]);
    // Saying no archives nothing.
    expect(state.archiveCalls).toEqual([]);
  });

  it('a class with a renewing Group License: it keeps renewing until cancelled in Billing; yes archives', async () => {
    state.kind = 'class';
    state.name = 'Spring Class';
    state.summary = okSummary([card(own('group_license'), 'class')]);
    const asked = await clickArchive(true);
    expect(asked).toEqual([`${plainAsk('Spring Class')}\n\n${words.licenseRenews}`]);
    expect(state.archiveCalls).toEqual([['space:fam', true]]);
    // The page reloads after the archive; the summary is not read again (the space is archived now).
    expect(state.summaryCalls).toEqual([{ poll: true }]);
  });

  it('a click before the summary read settles waits for it, then names the plan', async () => {
    let release: (() => void) | null = null;
    state.hold = (r) => {
      release = r;
    };
    state.summary = okSummary([card(own('family_lifetime'))]);
    expect(await clickArchive()).toEqual([]);
    await act(async () => {
      (release as unknown as () => void)();
    });
    await act(async () => undefined);
    await respond(false);
    expect(asked).toEqual([`${plainAsk('Kim family')}\n\n${words.familyLoses('Kim family')} ${words.familyRenews}`]);
    expect(state.archiveCalls).toEqual([]);
  });

  it('in Korean: the Korean ask, keeps line and plan line, a blank line apart', async () => {
    state.locale = 'ko';
    state.summary = okSummary([card(own('family_lifetime'))]);
    const ko = getMessages('ko').console;
    // The settings parts read the header language context (English here); the confirm follows the console locale.
    const asked = await clickArchive();
    const k = ko.billing.archiveConfirm;
    expect(asked).toEqual([`${ko.settings.danger.archiveAsk('Kim family')} ${ko.archiveKeeps}\n\n${k.familyLoses('Kim family')} ${k.familyRenews}`]);
  });

  it('a free space: the plain confirm', async () => {
    state.summary = okSummary([card({ state: 'free' })]);
    expect(await clickArchive()).toEqual([plainAsk('Kim family')]);
  });

  it('the summary read fails: the plain confirm, the page still works', async () => {
    state.summary = { ok: false, error: 'network' };
    expect(await clickArchive()).toEqual([plainAsk('Kim family')]);
  });

  it('an archived space: no summary read, and unarchive never asks', async () => {
    state.archivedAt = '2026-10-01T00:00:00.000Z';
    const asked = await clickArchive();
    expect(asked).toEqual([]);
    expect(state.summaryCalls).toEqual([]);
    expect(state.archiveCalls).toEqual([['space:fam', false]]);
    const root = (renderer as unknown as ReactTestRenderer).root;
    expect(textOf(root.find((n) => n.type === 'main'))).toContain(m.settings.notes.unarchived);
  });
});
