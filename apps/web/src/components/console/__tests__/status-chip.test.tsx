import { readFileSync } from 'node:fs';
import { colors, touchTarget } from '@hangul-route/design-system/tokens';
import { LOCALES, type UiLocale } from '@hangul-route/i18n';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { StatusChip, relinkSettled, revealAnswers, useDecided, DECIDED_HOLD_MS } from '@/components/console/LearnerStatusParts';
import { statusWords, type LearnerStatus, type LearnerStatusKind } from '@/lib/console/learner-status';

/** AMENDMENTS-GROWNUP-UX GX-1 section 4: the chip has text in every locale; amber only on the action states; never red. */
const lang = { locale: 'en' as UiLocale };
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: lang.locale, messages: i18n.getMessages(lang.locale), available: ['en', 'es', 'ko'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => lang.locale, useSetLocale: () => () => undefined };
});

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const NOW = new Date('2026-10-31T12:00:00.000Z');
const soon = new Date(NOW.getTime() + 8 * 60_000).toISOString();
const status = (kind: LearnerStatusKind): LearnerStatus => ({
  learnerId: 'profile:a',
  kind,
  action: kind === 'relink' || kind === 'move_yours',
  scopeBase: false,
  ...(kind === 'relink' ? { relink: { id: 'relink:a', expiresAt: soon } } : {}),
  ...(kind.startsWith('move') ? { move: { source: 'transfer' as const, id: 't', to: 'Class D', on: kind === 'move_scheduled' ? '2026-11-03T00:00:00.000Z' : null, expiresAt: null } } : {}),
});
const KINDS: LearnerStatusKind[] = ['relink', 'move_yours', 'move_room', 'move_scheduled', 'move_others', 'new', 'in_class'];

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === 'string') return node;
  return node.children.map((child) => textOf(child)).join('');
}

function chip(kind: LearnerStatusKind, locale: UiLocale = 'en', onActivate?: () => void): ReactTestInstance {
  lang.locale = locale;
  const words = statusWords(status(kind), NOW, locale);
  if (!words) throw new Error('no words');
  let r: ReturnType<typeof create> | null = null;
  act(() => {
    r = create(<StatusChip words={words} onActivate={onActivate} />);
  });
  return (r as unknown as ReturnType<typeof create>).root.find((n) => n.props['data-testid'] === 'learner-status' && typeof n.type === 'string');
}

describe('StatusChip', () => {
  it.each(LOCALES)('%s: every kind has text', (locale) => {
    for (const kind of KINDS) expect(textOf(chip(kind, locale)).length).toBeGreaterThan(1);
  });

  it('an action chip is a button at least touchTarget.min tall, named "{chip}: {reason}", and its tap calls onActivate', () => {
    const tapped = vi.fn();
    const button = chip('relink', 'en', tapped);
    expect(button.type).toBe('button');
    expect(button.props.style.minHeight).toBeGreaterThanOrEqual(touchTarget.min);
    expect(button.props['aria-label']).toBe('Needs your OK: New device · 8 min left');
    act(() => (button.props.onClick as () => void)());
    expect(tapped).toHaveBeenCalledTimes(1);
    expect(chip('move_yours', 'en', tapped).props['aria-label']).toBe('Needs your OK: Class move: Class D');
  });

  it('an action chip with nothing to open is the amber span, never a button that does nothing', () => {
    const node = chip('relink', 'en');
    expect(node.type).toBe('span');
    expect(node.props['data-tone']).toBe('action');
    expect(node.props.style.border).toContain(colors.feedback.nudge);
    expect(textOf(node)).toBe('Needs your OK');
  });

  it('relinkSettled: answered or closed meanwhile settles; a network error or a 5xx leaves the request open', () => {
    expect(relinkSettled({ ok: true, data: {} })).toBe(true);
    expect(relinkSettled({ ok: false, error: 'unknown', status: 409, code: 'expired' })).toBe(true);
    expect(relinkSettled({ ok: false, error: 'not_found', status: 404 })).toBe(true);
    expect(relinkSettled({ ok: false, error: 'unknown', status: 409, code: 'not_a_member' })).toBe(false);
    expect(relinkSettled({ ok: false, error: 'unknown', status: 503 })).toBe(false);
    expect(relinkSettled({ ok: false, error: 'network', status: 0 })).toBe(false);
  });

  it('revealAnswers scrolls the answers into view and focuses the first; nothing drawn is a no-op', () => {
    const focus = vi.fn();
    const scrollIntoView = vi.fn();
    revealAnswers({ scrollIntoView, querySelector: () => ({ focus }) } as unknown as HTMLElement);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(() => revealAnswers(null)).not.toThrow();
    expect(() => revealAnswers({ querySelector: () => null } as unknown as HTMLElement)).not.toThrow();
  });

  it('amber only on the action states; quiet and info states carry no nudge colour', () => {
    for (const kind of KINDS) {
      const node = chip(kind, 'en', () => undefined);
      const styles = JSON.stringify([node.props.style, ...node.findAll((n) => typeof n.type === 'string').map((n) => n.props.style)]);
      if (kind === 'relink' || kind === 'move_yours') expect(styles).toContain(colors.feedback.nudge);
      else {
        expect(node.type).toBe('span');
        expect(styles).not.toContain(colors.feedback.nudge);
      }
      expect(styles).not.toContain(colors.feedback.danger);
      expect(node.props.style.color).toBe(colors.text.primary);
    }
  });

  it('In class carries the success dot; the colour is never the only cue (it has text)', () => {
    const node = chip('in_class');
    expect(node.props.style.backgroundColor).toBe(colors.feedback.successLight);
    expect(JSON.stringify(node.findAll((n) => n.type === 'span').map((n) => n.props.style))).toContain(colors.feedback.success);
    expect(textOf(node)).toBe('In class');
  });

  it('the parts use tokens only: no colour literal, no danger colour', () => {
    const src = readFileSync(new URL('../LearnerStatusParts.tsx', import.meta.url), 'utf8');
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(src).not.toContain('feedback.danger');
  });
});

describe('useDecided', () => {
  it('holds a decided line for 5 s, pinning the card, then lets it go', () => {
    vi.useFakeTimers();
    const box: { view: ReturnType<typeof useDecided> | null } = { view: null };
    function Probe(): null {
      box.view = useDecided();
      return null;
    }
    let r: ReturnType<typeof create> | null = null;
    act(() => {
      r = create(<Probe />);
    });
    act(() => box.view?.note('profile:a', 'Done'));
    expect(box.view?.lines).toEqual({ 'profile:a': 'Done' });
    expect([...(box.view?.pinned ?? [])]).toEqual(['profile:a']);
    act(() => box.view?.note('profile:a', 'Done again'));
    act(() => {
      vi.advanceTimersByTime(DECIDED_HOLD_MS - 1);
    });
    expect(box.view?.lines).toEqual({ 'profile:a': 'Done again' });
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(box.view?.lines).toEqual({});
    act(() => box.view?.note('profile:b', 'Later'));
    act(() => (r as unknown as ReturnType<typeof create>).unmount());
    vi.useRealTimers();
  });
});
