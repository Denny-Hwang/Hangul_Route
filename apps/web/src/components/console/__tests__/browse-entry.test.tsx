import { BROWSE_PASS_SESSION_KEY } from '@hangul-route/content-schema';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '@/lib/console/api';
import { resetBrowseScopeCache } from '@/lib/console/browse-link';
import type { KeyValueStorage } from '@/lib/console/session';

/**
 * F-BROWSE-001 BR-10 (sections 4.3 and 4.11; wireframe design/wireframes/browse/entry-points.md): a console entry
 * to All lessons. A plain click checks the plan, writes the tab's pass and goes to `/browse` in the same tab; a
 * modifier click is the browser's (a new tab without a pass); a failed check shows "Could not check your plan."
 * with Try again and Open free lessons; blocked storage shows its line; nothing navigates in either case.
 */
type Scope = ApiResult<{ scope: 'full' | 'sampler' }>;
const consoleView = vi.hoisted(() => ({
  answers: [] as Scope[],
  reads: 0,
  locale: 'en' as 'en' | 'es' | 'ko',
  hold: null as Promise<void> | null,
}));
vi.mock('../use-console', async () => {
  const { getMessages: messages } = await import('@hangul-route/i18n');
  const api = {
    browseScope: async (): Promise<Scope> => {
      if (consoleView.hold) await consoleView.hold;
      const answer = consoleView.answers[Math.min(consoleView.reads, consoleView.answers.length - 1)] as Scope;
      consoleView.reads += 1;
      return answer;
    },
  };
  return {
    useConsole: () => ({ ready: true, session: { accountId: 'acc_1', displayName: 'Kim' }, api, signOut: () => undefined, m: messages(consoleView.locale), locale: consoleView.locale }),
  };
});

import { BrowseLink, type BrowseOpenerEnv } from '../BrowseLink';

const NOW = Date.UTC(2026, 9, 13, 10, 0);

interface FakeEnv extends BrowseOpenerEnv {
  data: Map<string, string>;
  assigned: string[];
}

function fakeEnv(storage: 'ok' | 'none' | 'refuses' = 'ok'): FakeEnv {
  const data = new Map<string, string>();
  const store: KeyValueStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      if (storage === 'refuses') throw new Error('blocked');
      data.set(k, v);
    },
    removeItem: (k) => void data.delete(k),
  };
  const env: FakeEnv = {
    data,
    assigned: [],
    origin: () => 'https://app.hangulroute.com',
    now: () => NOW,
    storage: () => (storage === 'none' ? null : store),
    assign: (url) => {
      env.assigned.push(url);
    },
  };
  return env;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: ReactTestRenderer | null = null;
beforeEach(() => {
  consoleView.answers = [{ ok: true, data: { scope: 'full' } }];
  consoleView.reads = 0;
  consoleView.locale = 'en';
  consoleView.hold = null;
  resetBrowseScopeCache();
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
});

async function render(env: FakeEnv): Promise<ReactTestRenderer> {
  await act(async () => {
    mounted = create(<BrowseLink target={{ kind: 'quest', id: 'quest:stage1-letters-q2' }} source="plan" label="Preview" ariaLabel="Preview: Meet a, eo, g, n" testId="plan-preview" env={env} />);
  });
  return mounted as unknown as ReactTestRenderer;
}

const byTestId = (r: ReactTestRenderer, id: string): ReactTestInstance[] => r.root.findAll((n) => n.props['data-testid'] === id && typeof n.type === 'string');
const textOf = (n: ReactTestInstance): string => n.children.map((child) => (typeof child === 'string' ? child : textOf(child))).join('');

function clickEvent(over: Partial<{ button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) {
  const event = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, prevented: false, preventDefault: () => undefined, ...over };
  event.preventDefault = () => {
    event.prevented = true;
    event.defaultPrevented = true;
  };
  return event;
}

async function click(r: ReactTestRenderer, id: string, event = clickEvent()): Promise<ReturnType<typeof clickEvent>> {
  await act(async () => {
    (byTestId(r, id)[0] as ReactTestInstance).props.onClick(event);
  });
  return event;
}

describe('BrowseLink (section 4.11): one link, same tab, content ids only', () => {
  it('is a link to the lesson at its relative /browse URL, with the label and the accessible name', async () => {
    const r = await render(fakeEnv());
    const link = byTestId(r, 'plan-preview')[0] as ReactTestInstance;
    expect(link.type).toBe('a');
    expect(link.props.href).toBe('/browse#t=quest:stage1-letters-q2&s=plan');
    expect(link.props.target).toBeUndefined();
    expect(link.props['aria-label']).toBe('Preview: Meet a, eo, g, n');
    expect(textOf(link)).toBe('Preview');
  });

  it('a plain click writes the full pass, then goes to the lesson in the same tab', async () => {
    const env = fakeEnv();
    const r = await render(env);
    const event = await click(r, 'plan-preview');
    expect(event.prevented).toBe(true);
    expect(JSON.parse(env.data.get(BROWSE_PASS_SESSION_KEY) ?? 'null')).toEqual({ v: 1, scope: 'full', source: 'account', issuedAt: NOW, seen: NOW, uiLocale: 'en' });
    expect(env.assigned).toEqual(['https://app.hangulroute.com/browse#t=quest:stage1-letters-q2&s=plan']);
  });

  it('is aria-busy while the plan check runs, and not after it settles', async () => {
    let release: () => void = () => undefined;
    consoleView.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const env = fakeEnv();
    const r = await render(env);
    expect((byTestId(r, 'plan-preview')[0] as ReactTestInstance).props['aria-busy']).toBeUndefined();
    await click(r, 'plan-preview');
    expect((byTestId(r, 'plan-preview')[0] as ReactTestInstance).props['aria-busy']).toBe(true);
    await act(async () => {
      release();
      await consoleView.hold;
    });
    expect((byTestId(r, 'plan-preview')[0] as ReactTestInstance).props['aria-busy']).toBeUndefined();
    expect(env.assigned).toHaveLength(1);
  });

  it('carries the console locale into the pass', async () => {
    consoleView.locale = 'ko';
    const env = fakeEnv();
    const r = await render(env);
    await click(r, 'plan-preview');
    expect(JSON.parse(env.data.get(BROWSE_PASS_SESSION_KEY) ?? 'null')).toMatchObject({ uiLocale: 'ko' });
  });

  it.each([{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }])('a modifier or middle click (%o) is left to the browser: no pass, no scope read', async (over) => {
    const env = fakeEnv();
    const r = await render(env);
    const event = await click(r, 'plan-preview', clickEvent(over));
    expect(event.prevented).toBe(false);
    expect(consoleView.reads).toBe(0);
    expect(env.data.size).toBe(0);
    expect(env.assigned).toEqual([]);
  });

  it('a failed check: the line, Try again and Open free lessons, and no navigation', async () => {
    consoleView.answers = [{ ok: false, error: 'network', status: -1 }];
    const env = fakeEnv();
    const r = await render(env);
    await click(r, 'plan-preview');
    expect(env.assigned).toEqual([]);
    expect(env.data.size).toBe(0);
    const notice = byTestId(r, 'plan-preview-notice')[0] as ReactTestInstance;
    expect(notice.props.role).toBe('status');
    expect(textOf(notice)).toContain('Could not check your plan.');
    expect(textOf(byTestId(r, 'plan-preview-retry')[0] as ReactTestInstance)).toBe('Try again');
    expect(textOf(byTestId(r, 'plan-preview-free')[0] as ReactTestInstance)).toBe('Open free lessons');
  });

  it('Try again checks again and opens once the check answers', async () => {
    consoleView.answers = [{ ok: false, error: 'unknown', status: 503 }, { ok: true, data: { scope: 'sampler' } }];
    const env = fakeEnv();
    const r = await render(env);
    await click(r, 'plan-preview');
    await act(async () => {
      (byTestId(r, 'plan-preview-retry')[0] as ReactTestInstance).props.onClick();
    });
    expect(consoleView.reads).toBe(2);
    expect(JSON.parse(env.data.get(BROWSE_PASS_SESSION_KEY) ?? 'null')).toMatchObject({ scope: 'sampler' });
    expect(env.assigned).toEqual(['https://app.hangulroute.com/browse#t=quest:stage1-letters-q2&s=plan']);
  });

  it('Open free lessons writes a 1-hour free-lessons pass (fallback) and opens the same lesson', async () => {
    consoleView.answers = [{ ok: false, error: 'network', status: -1 }];
    const env = fakeEnv();
    const r = await render(env);
    await click(r, 'plan-preview');
    await act(async () => {
      (byTestId(r, 'plan-preview-free')[0] as ReactTestInstance).props.onClick();
    });
    expect(JSON.parse(env.data.get(BROWSE_PASS_SESSION_KEY) ?? 'null')).toEqual({ v: 1, scope: 'sampler', source: 'account', issuedAt: NOW, seen: NOW, fallback: true, uiLocale: 'en' });
    expect(env.assigned).toEqual(['https://app.hangulroute.com/browse#t=quest:stage1-letters-q2&s=plan']);
  });

  it.each(['none', 'refuses'] as const)('blocked storage (%s): the storage line only, no navigation', async (storage) => {
    const env = fakeEnv(storage);
    const r = await render(env);
    await click(r, 'plan-preview');
    expect(env.assigned).toEqual([]);
    expect(textOf(byTestId(r, 'plan-preview-notice')[0] as ReactTestInstance)).toBe("Your browser blocked this page's storage, so lessons cannot open here.");
    expect(byTestId(r, 'plan-preview-retry')).toHaveLength(0);
    expect(byTestId(r, 'plan-preview-free')).toHaveLength(0);
  });

  it('the status region is empty until something needs saying', async () => {
    const r = await render(fakeEnv());
    expect(textOf(byTestId(r, 'plan-preview-notice')[0] as ReactTestInstance)).toBe('');
  });
});
