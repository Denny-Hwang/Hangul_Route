import { getMessages } from '@hangul-route/i18n';
import type { ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpaceListItem } from '@/lib/console/api';
import { ATTENTION_POLL_MS } from '@/lib/console/persona-attention';
import { resetTransferLockForTests } from '@/lib/console/transfer-lock';

/**
 * AMENDMENTS-GROWNUP-UX GX-3 (sections 5.4, 5.5 and 6; mock design/screens/approvals/mock/home-{lc}.html): on a teacher
 * page the frame shows the number of requests waiting on the Classes tab (on screen, `aria-hidden`; the tab's name says
 * what it counts), "(n) " in front of the tab title, and the re-link bar while a new device waits; it reads the counts
 * again every 30 s while in view, once GX-W's `attention` is on the spaces list, and never on a timer before it. A school
 * admin's classes come from the school's own `attention`, each class counted once. The page inside reads the counts
 * through `FrameAttentionContext` (the home row chip, a school row's links, the school page's class rows).
 */
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined }) }));

type Result = { ok: true; data: unknown } | { ok: false; error: string; status: number };
const view = vi.hoisted(() => ({
  api: null as null | Record<string, (...args: string[]) => Promise<unknown>>,
  locale: 'en' as 'en' | 'es' | 'ko',
}));
vi.mock('../use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'acc_1', displayName: 'Kim' }, api: view.api, signOut: () => undefined, m: messages(view.locale), locale: view.locale }),
  };
});
vi.mock('@/lib/i18n/locale-context', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  return {
    useConsoleLocale: () => ({ locale: view.locale, messages: messages(view.locale), available: ['en', 'es', 'ko'], setLocale: () => undefined }),
    useMessages: () => messages(view.locale),
  };
});

import { AdultFrame, resetFrameMemory, type AdultFrameEnvironment } from '../AdultFrame';
import { AttentionCountChip, SchoolAttentionLinks } from '../AttentionCounts';

const NOW = new Date('2026-10-31T12:00:00.000Z');
const at = (minutes: number): string => new Date(NOW.getTime() + minutes * 60_000).toISOString();

function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], name: string, attention?: unknown): SpaceListItem {
  return {
    space: { id, kind, name, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-10-01T00:00:00Z' },
    role,
    counts: { learners: 2, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
    ...(attention === undefined ? {} : { attention }),
  };
}
const att = (relinks: number, moves: number, relinkExpiresAt: string | null = null) => ({ relinks, moves, relinkExpiresAt });

const calls: Array<{ name: string; id?: string }> = [];
const answers = {
  spaces: [] as SpaceListItem[],
  schools: {} as Record<string, Result>,
  schoolViews: {} as Record<string, Result>,
};
function fakeApi(): Record<string, (...args: string[]) => Promise<unknown>> {
  return {
    listSpaces: async () => {
      calls.push({ name: 'listSpaces' });
      return { ok: true, data: answers.spaces };
    },
    schoolAttention: async (id: string) => {
      calls.push({ name: 'schoolAttention', id });
      return answers.schools[id] ?? { ok: false, error: 'not_found', status: 404 };
    },
    school: async (id: string) => {
      calls.push({ name: 'school', id });
      return answers.schoolViews[id] ?? { ok: false, error: 'not_found', status: 404 };
    },
    roster: async () => ({ ok: false, error: 'not_found', status: 404 }),
  };
}

const listeners = new Set<() => void>();
const fakeDocument = {
  visibilityState: 'visible',
  title: 'Classes · Hangul Route',
  querySelector: () => null,
  addEventListener: (type: string, l: () => void) => {
    if (type === 'visibilitychange') listeners.add(l);
  },
  removeEventListener: (type: string, l: () => void) => {
    if (type === 'visibilitychange') listeners.delete(l);
  },
};

function env(pathname = '/teach/home'): AdultFrameEnvironment {
  return {
    location: () => ({ origin: 'https://app.hangulroute.com', pathname, search: '' }),
    readLastPersona: async () => 'teacher',
    writeLastPersona: () => undefined,
    clearGrownUpTab: () => undefined,
    assign: () => undefined,
    now: () => Date.now(),
  };
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(NOW);
  vi.stubGlobal('document', fakeDocument);
  fakeDocument.title = 'Classes · Hangul Route';
  vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'enabled');
  vi.stubEnv('NEXT_PUBLIC_REPORTS_ENABLED', 'false');
  vi.stubEnv('NEXT_PUBLIC_NOTES_ENABLED', 'false');
  vi.stubEnv('NEXT_PUBLIC_BROWSE', 'false');
  vi.stubEnv('NEXT_PUBLIC_LECTURE_MODE', 'off');
  resetTransferLockForTests();
  resetFrameMemory();
  view.api = fakeApi();
  view.locale = 'en';
  answers.spaces = [];
  answers.schools = {};
  answers.schoolViews = {};
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  calls.length = 0;
  listeners.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetTransferLockForTests();
});

async function render(spaces: SpaceListItem[], options: { pathname?: string; attentionHere?: boolean; children?: ReactNode } = {}): Promise<ReactTestRenderer> {
  await act(async () => {
    mounted = create(
      <AdultFrame env={env(options.pathname)} spaces={spaces} attentionHere={options.attentionHere}>
        {options.children ?? <p>page</p>}
      </AdultFrame>,
    );
  });
  await act(async () => {
    await Promise.resolve();
  });
  return mounted as unknown as ReactTestRenderer;
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance[] => r.root.findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const one = (r: ReactTestRenderer, id: string): ReactTestInstance => {
  const found = byTestId(r, id);
  expect(found).toHaveLength(1);
  return found[0] as ReactTestInstance;
};
const textOf = (n: ReactTestInstance): string => n.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');
const count = (name: string): number => calls.filter((c) => c.name === name).length;

const en = getMessages('en').console;

describe('the Classes tab number (section 6)', () => {
  it('shows the persona total on screen, hidden from the reader, and says what it counts in the tab name', async () => {
    const r = await render([item('c1', 'class', 'owner', 'Sunday Class A', att(1, 2, at(8))), item('c2', 'class', 'teacher', 'Beginners B', att(0, 0))]);
    const tab = one(r, 'nav-classes');
    expect(tab.props['aria-label']).toBe('Classes, 3 need your OK');
    const number = one(r, 'nav-count');
    expect(textOf(number)).toBe('3');
    expect(number.props['aria-hidden']).toBe('true');
    expect(fakeDocument.title).toBe('(3) Classes · Hangul Route');
  });

  it('one waiting: the singular name; nothing waiting: no number and the plain name', async () => {
    let r = await render([item('c1', 'class', 'owner', 'Sunday Class A', att(0, 1))]);
    expect(one(r, 'nav-classes').props['aria-label']).toBe('Classes, 1 needs your OK');
    act(() => mounted?.unmount());
    r = await render([item('c1', 'class', 'owner', 'Sunday Class A', att(0, 0))]);
    expect(one(r, 'nav-classes').props['aria-label']).toBeUndefined();
    expect(byTestId(r, 'nav-count')).toHaveLength(0);
    expect(byTestId(r, 'relink-bar')).toHaveLength(0);
    expect(fakeDocument.title).toBe('Classes · Hangul Route');
  });

  it('class moves off with one pending re-link: the count is 1 (only the moves follow the flag)', async () => {
    vi.stubEnv('NEXT_PUBLIC_CLASS_TRANSFER', 'off');
    const r = await render([item('c1', 'class', 'owner', 'Sunday Class A', att(1, 2, at(8)))], {
      children: <AttentionCountChip spaceId="c1" />,
    });
    expect(textOf(one(r, 'nav-count'))).toBe('1');
    expect(textOf(one(r, 'class-attention-c1'))).toBe('1 needs your OK');
  });

  it('shows 99+ above two digits', async () => {
    const r = await render([item('c1', 'class', 'owner', 'Sunday Class A', att(0, 120))]);
    expect(textOf(one(r, 'nav-count'))).toBe('99+');
  });

  it('in Korean and Spanish the number reads with the locale\'s one action wording', async () => {
    view.locale = 'ko';
    let r = await render([item('c1', 'class', 'owner', '일요일 반 A', att(1, 1, at(8)))]);
    expect(one(r, 'nav-classes').props['aria-label']).toBe('반, 승인 대기 2건');
    expect(textOf(one(r, 'relink-bar-text'))).toBe('새 기기 승인 대기 · 일요일 반 A');
    expect(textOf(one(r, 'relink-bar-minutes'))).toBe('8분 남음');
    act(() => mounted?.unmount());
    view.locale = 'es';
    r = await render([item('c1', 'class', 'owner', 'Clase A', att(1, 1, at(8)))]);
    expect(one(r, 'nav-classes').props['aria-label']).toBe('Clases, 2 por aprobar');
    expect(textOf(one(r, 'relink-bar-text'))).toBe('Un dispositivo nuevo espera tu aprobación · Clase A');
  });
});

describe('the re-link bar (section 5.5)', () => {
  it('one new device: the class name, the minutes left, and Review to the class page\'s review', async () => {
    answers.spaces = [item('c1', 'class', 'owner', 'Sunday Class A', att(1, 0, at(7.5)))];
    const r = await render(answers.spaces);
    const bar = one(r, 'relink-bar');
    expect(bar.findAll((n) => n.props.role === 'status')).toHaveLength(1);
    expect(textOf(one(r, 'relink-bar-text'))).toBe('A new device needs your OK · Sunday Class A');
    expect(textOf(one(r, 'relink-bar-minutes'))).toBe('8 min left');
    const review = one(r, 'relink-bar-review');
    expect(review.props.href).toBe('/teach/space?id=c1#attention');
    expect(textOf(review)).toBe(en.status.review.cta);
    // The minutes line moves once a minute; the sentence (the live region) does not.
    await advance(60_000);
    expect(textOf(one(r, 'relink-bar-minutes'))).toBe('7 min left');
    expect(textOf(one(r, 'relink-bar-text'))).toBe('A new device needs your OK · Sunday Class A');
  });

  it('two or more: the count, and Review goes to the class whose one closes first', async () => {
    const r = await render([item('c1', 'class', 'owner', 'Sunday Class A', att(1, 0, at(9))), item('c2', 'class', 'owner', 'Beginners B', att(1, 0, at(3)))]);
    expect(textOf(one(r, 'relink-bar-text'))).toBe('2 new devices need your OK');
    expect(one(r, 'relink-bar-review').props.href).toBe('/teach/space?id=c2#attention');
  });

  it('a move alone never draws the bar (moves stay open 14 days)', async () => {
    const r = await render([item('c1', 'class', 'owner', 'Sunday Class A', att(0, 2))]);
    expect(byTestId(r, 'relink-bar')).toHaveLength(0);
  });

  it('is not drawn on the class page (it has its own), nor on a lecture page, nor for the family persona', async () => {
    const spaces = [item('c1', 'class', 'owner', 'Sunday Class A', att(1, 0, at(8)))];
    let r = await render(spaces, { attentionHere: true, pathname: '/teach/space' });
    expect(byTestId(r, 'relink-bar')).toHaveLength(0);
    // The tab still shows the number, but the class page owns the title and the timer.
    expect(textOf(one(r, 'nav-count'))).toBe('1');
    expect(fakeDocument.title).toBe('Classes · Hangul Route');
    act(() => mounted?.unmount());
    r = await render(spaces, { pathname: '/teach/space/lecture' });
    expect(byTestId(r, 'relink-bar')).toHaveLength(0);
    act(() => mounted?.unmount());
    r = await render([item('f1', 'family', 'owner', 'Kim family', att(1, 0, at(8)))], { pathname: '/parent' });
    expect(byTestId(r, 'relink-bar')).toHaveLength(0);
    expect(byTestId(r, 'nav-count')).toHaveLength(0);
  });
});

describe('reads (section 5.4)', () => {
  it('reads the spaces list again every 30 s while in view, one call a tick, and draws the new counts', async () => {
    const spaces = [item('c1', 'class', 'owner', 'Sunday Class A', att(1, 0, at(8)))];
    answers.spaces = [item('c1', 'class', 'owner', 'Sunday Class A', att(0, 0))];
    const r = await render(spaces);
    expect(calls).toEqual([]);
    expect(byTestId(r, 'relink-bar')).toHaveLength(1);
    await advance(ATTENTION_POLL_MS);
    expect(calls).toEqual([{ name: 'listSpaces' }]);
    expect(byTestId(r, 'relink-bar')).toHaveLength(0);
    expect(byTestId(r, 'nav-count')).toHaveLength(0);
    await advance(ATTENTION_POLL_MS);
    expect(count('listSpaces')).toBe(2);
  });

  it('reads nothing on a timer on the class page', async () => {
    await render([item('c1', 'class', 'owner', 'Sunday Class A', att(1, 0, at(8)))], { attentionHere: true, pathname: '/teach/space' });
    await advance(10 * 60_000);
    expect(calls).toEqual([]);
  });

  it('without GX-W (no attention on the list) nothing is drawn and nothing is read, even after 10 minutes in view', async () => {
    const r = await render([item('c1', 'class', 'owner', 'Sunday Class A'), item('s1', 'school', 'admin', 'Maple School')]);
    await advance(10 * 60_000);
    expect(calls).toEqual([]);
    expect(byTestId(r, 'nav-count')).toHaveLength(0);
    expect(byTestId(r, 'relink-bar')).toHaveLength(0);
  });

  it('a failed poll keeps what is drawn', async () => {
    view.api = { ...fakeApi(), listSpaces: async () => ({ ok: false, error: 'network', status: -1 }) };
    const r = await render([item('c1', 'class', 'owner', 'Sunday Class A', att(1, 0, at(8)))]);
    await advance(ATTENTION_POLL_MS);
    expect(byTestId(r, 'relink-bar')).toHaveLength(1);
  });
});

describe('a school admin (section 6, GX-W school attention)', () => {
  const school = item('s1', 'school', 'admin', 'Maple School', att(0, 0));
  beforeEach(() => {
    answers.schools.s1 = {
      ok: true,
      data: [
        { spaceId: 'c1', relinks: 1, moves: 0, relinkExpiresAt: at(6) },
        { spaceId: 'c9', relinks: 0, moves: 2, relinkExpiresAt: null },
        { spaceId: 'c8', relinks: 0, moves: 0, relinkExpiresAt: null },
      ],
    };
    answers.schoolViews.s1 = { ok: true, data: { classes: [{ space: { id: 'c1', name: 'Class One' } }, { space: { id: 'c9', name: 'Class Nine' } }, { space: { id: 'c8', name: 'Class Eight' } }] } };
  });

  it('counts the school\'s classes once each, also one the admin teaches, and names a class the list does not hold', async () => {
    const r = await render([school, item('c1', 'class', 'teacher', 'Class One (mine)', att(1, 0, at(6)))]);
    expect(count('schoolAttention')).toBe(1);
    expect(textOf(one(r, 'nav-count'))).toBe('3');
    expect(textOf(one(r, 'relink-bar-text'))).toBe('A new device needs your OK · Class One (mine)');
  });

  it('reads the school\'s class names once, only for a waiting class the list cannot name', async () => {
    answers.schools.s1 = { ok: true, data: [{ spaceId: 'c9', relinks: 1, moves: 0, relinkExpiresAt: at(4) }] };
    const r = await render([school], { children: <SchoolAttentionLinks schoolId="s1" fallback={[]} /> });
    await act(async () => {
      await Promise.resolve();
    });
    expect(textOf(one(r, 'relink-bar-text'))).toBe('A new device needs your OK · Class Nine');
    expect(textOf(one(r, 'school-attention-c9'))).toBe('Class Nine: 1 needs your OK');
    expect(one(r, 'school-attention-c9').props.href).toBe('/teach/space?id=c9#attention');
    await advance(ATTENTION_POLL_MS);
    expect(count('school')).toBe(1);
    expect(count('schoolAttention')).toBe(2);
  });

  it('a school row lists only its classes with requests waiting, and the class rows of the school page get the chip', async () => {
    const r = await render([school], {
      children: (
        <>
          <SchoolAttentionLinks schoolId="s1" fallback={[]} />
          <AttentionCountChip spaceId="c9" testId="school-class-attention-c9" />
          <AttentionCountChip spaceId="c8" testId="school-class-attention-c8" />
        </>
      ),
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(byTestId(r, 'school-attention-c8')).toHaveLength(0);
    expect(textOf(one(r, 'school-attention-c9'))).toBe('Class Nine: 2 need your OK');
    expect(textOf(one(r, 'school-class-attention-c9'))).toBe('2 need your OK');
    expect(one(r, 'school-class-attention-c9').props.href).toBe('/teach/space?id=c9#attention');
    expect(byTestId(r, 'school-class-attention-c8')).toHaveLength(0);
  });

  it('a school the account only teaches in is not read', async () => {
    await render([item('s2', 'school', 'teacher', 'Oak School', att(0, 0)), item('c1', 'class', 'teacher', 'Class One', att(0, 0))]);
    expect(count('schoolAttention')).toBe(0);
  });
});

describe('the page\'s counts before GX-W (fallbacks)', () => {
  it('the row chip uses the page\'s own count and links to the class page\'s review', async () => {
    const r = await render([item('c1', 'class', 'owner', 'Sunday Class A')], { children: <AttentionCountChip spaceId="c1" fallback={2} /> });
    const chip = one(r, 'class-attention-c1');
    expect(textOf(chip)).toBe('2 need your OK');
    expect(chip.props.href).toBe('/teach/space?id=c1#attention');
    expect(chip.props.className).toBe('hr-attn-chip');
  });

  it('nothing waiting: no chip', async () => {
    const r = await render([item('c1', 'class', 'owner', 'Sunday Class A')], { children: <AttentionCountChip spaceId="c1" fallback={0} /> });
    expect(byTestId(r, 'class-attention-c1')).toHaveLength(0);
  });

  it('a school row keeps the shipped move links (to the moves page) without the school\'s attention', async () => {
    const r = await render([item('s1', 'school', 'admin', 'Maple School')], {
      children: <SchoolAttentionLinks schoolId="s1" fallback={[{ spaceId: 'c9', name: 'Class Nine', waiting: 2 }]} />,
    });
    const link = one(r, 'school-moves-c9');
    expect(link.props.href).toBe('/teach/space/transfers?id=c9');
    expect(textOf(link)).toBe(en.transfer.schoolRow('Class Nine', 2));
  });
});

describe('tokens only', () => {
  it('the frame\'s attention rules never use the danger colour: amber is the action colour (anti-shame)', async () => {
    const { ATTENTION_CSS } = await import('../AttentionCounts');
    const { colors } = await import('@hangul-route/design-system/tokens');
    expect(ATTENTION_CSS).toContain(colors.feedback.nudge);
    expect(ATTENTION_CSS).not.toContain(colors.feedback.danger);
  });
});
