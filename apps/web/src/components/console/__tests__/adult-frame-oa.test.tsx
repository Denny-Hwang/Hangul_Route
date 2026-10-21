import type { DeviceUses } from '@hangul-route/content-schema';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceListItem } from '@/lib/console/api';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-3 (sections 7.1, 7.3 and 7.6): the adult frame writes the account's
 * grown-up uses (`deviceUses`, no names) whenever a persona home renders, draws the persona-home PIN cards there only,
 * and its Learner app exit opens the learner app's chooser (`who=1`).
 */
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined }) }));
vi.mock('../use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  return { useConsole: () => ({ ready: true, session: { accountId: 'user_1', displayName: 'Kim' }, api: null, signOut: () => undefined, m: messages('en'), locale: 'en' }) };
});
vi.mock('../auth-context', () => ({
  useConsoleAuth: () => ({ session: { accountId: 'user_1', displayName: 'Kim' }, reverifySecret: async () => 'done', secretReverifyReady: true }),
}));
vi.mock('@/lib/i18n/locale-context', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  return { useConsoleLocale: () => ({ locale: 'en', messages: messages('en'), available: ['en'], setLocale: () => undefined }), useMessages: () => messages('en') };
});

import { AdultFrame, resetFrameMemory, type AdultFrameEnvironment } from '../AdultFrame';
import type { PinCardsEnvironment } from '../PinCards';

const NOW = 1_800_000_000_000;

function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], name = 'Sunflower Family'): SpaceListItem {
  return {
    space: { id, kind, name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-10-01T00:00:00Z' },
    role,
    counts: { learners: 2, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

function cardsEnv(log: string[]): PinCardsEnvironment {
  return {
    now: () => NOW,
    readDevice: async () => ({ readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: true }),
    readUnlock: () => null,
    readPinOwner: async () => null,
    fingerprint: async () => 'a1b2c3d4e5f60718',
    readPromptSeen: async () => false,
    markPromptSeen: () => log.push('seen'),
    writePinOwner: async () => true,
    assign: (url) => log.push(`assign:${url}`),
    setTimer: () => () => undefined,
    clearGrownUpTab: () => log.push('cards:clearGrownUpTab'),
    origin: () => 'https://app.hangulroute.com',
    // In view in a visible tab at once.
    observeSeen: (_element, onSeen) => {
      onSeen();
      return () => undefined;
    },
    readOfferClosed: () => null,
    writeOfferClosed: (at) => log.push(`offerClosed:${at}`),
  };
}

interface Env extends AdultFrameEnvironment {
  uses: DeviceUses[];
  assigned: string[];
  log: string[];
}

function env(pathname: string): Env {
  const e: Env = {
    uses: [],
    assigned: [],
    log: [],
    location: () => ({ origin: 'https://app.hangulroute.com', pathname, search: '' }),
    readLastPersona: async () => null,
    writeLastPersona: () => undefined,
    clearGrownUpTab: () => e.log.push('clearGrownUpTab'),
    assign: (url) => e.assigned.push(url),
    now: () => NOW,
    writeDeviceUses: (record) => e.uses.push(record),
  };
  e.pinCards = cardsEnv(e.log);
  return e;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  resetFrameMemory();
  vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'false');
  vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'false');
  vi.stubEnv('NEXT_PUBLIC_BROWSE', 'false');
  vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', 'off');
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  vi.unstubAllEnvs();
});

async function render(e: Env, spaces: readonly SpaceListItem[] | null): Promise<ReactTestRenderer> {
  await act(async () => {
    mounted = create(
      <AdultFrame env={e} spaces={spaces}>
        <p>page</p>
      </AdultFrame>,
      // A DOM-like node for refs (the set-a-PIN card observes its section).
      { createNodeMock: (element) => (element.type === 'section' ? {} : null) },
    );
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
  return mounted as unknown as ReactTestRenderer;
}

const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance[] => r.root.findAll((n) => typeof n.type === 'string' && n.props['data-testid'] === id);

describe('deviceUses: written on every persona home (section 7.1)', () => {
  it('the family home writes the uses of the spaces it holds', async () => {
    const e = env('/parent');
    await render(e, [item('space:fam', 'family', 'owner'), item('space:cls', 'class', 'teacher', 'Ms Kim class')]);
    expect(e.uses).toEqual([{ v: 1, uses: ['family', 'teacher'], at: NOW }]);
  });

  it('the teacher home writes them too, school included', async () => {
    const e = env('/teach/home');
    await render(e, [item('space:sch', 'school', 'admin')]);
    expect(e.uses).toEqual([{ v: 1, uses: ['school'], at: NOW }]);
  });

  it('holds no name, email, account id or space id', async () => {
    const e = env('/parent');
    await render(e, [item('space:fam', 'family', 'owner', 'The Kim Family')]);
    const stored = JSON.stringify(e.uses);
    expect(stored).not.toMatch(/Kim|space:|user_1|@/);
  });

  it('is not written on other pages, nor before the spaces are known', async () => {
    const other = env('/teach/space');
    await render(other, [item('space:cls', 'class', 'teacher')]);
    expect(other.uses).toEqual([]);
    act(() => mounted?.unmount());
    const loading = env('/parent');
    await render(loading, null);
    expect(loading.uses).toEqual([]);
  });
});

describe('the Learner app exit opens the chooser (section 7.3, OA-D12)', () => {
  it('clears the tab, then goes to the learner app with who=1; the label stays Learner app', async () => {
    const e = env('/parent');
    const r = await render(e, [item('space:fam', 'family', 'owner')]);
    act(() => byTestId(r, 'frame-learner-app')[0]?.props.onClick());
    expect(e.log).toContain('clearGrownUpTab');
    expect(e.assigned).toEqual(['/?lang=en&who=1']);
  });
});

describe('the PIN cards sit on persona homes only (section 7.6)', () => {
  it('a nopin browser shows the set-a-PIN card once on a home', async () => {
    const e = env('/parent');
    const r = await render(e, [item('space:fam', 'family', 'owner')]);
    expect(byTestId(r, 'pin-prompt-card')).toHaveLength(1);
    expect(e.log).toContain('seen');
  });

  it('Open the app on the card leaves the tab like the exit and opens the PIN gate back to this home', async () => {
    const e = env('/parent');
    const r = await render(e, [item('space:fam', 'family', 'owner')]);
    act(() => byTestId(r, 'pin-prompt-open')[0]?.props.onClick());
    expect(e.log.slice(-2)).toEqual(['cards:clearGrownUpTab', 'assign:/?gate=grown-up&next=%2Fparent']);
  });

  it('never on another page', async () => {
    const e = env('/teach/space');
    const r = await render(e, [item('space:fam', 'family', 'owner')]);
    expect(byTestId(r, 'pin-prompt-card')).toHaveLength(0);
  });

  it('an environment without the cards draws none', async () => {
    const e = env('/parent');
    delete e.pinCards;
    const r = await render(e, [item('space:fam', 'family', 'owner')]);
    expect(byTestId(r, 'pin-prompt-card')).toHaveLength(0);
  });
});
