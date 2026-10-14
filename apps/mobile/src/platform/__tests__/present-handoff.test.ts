import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
  removeKey: vi.fn(async () => undefined),
}));
vi.mock('../telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: () => undefined }));

import * as native from '../present-handoff';
import * as web from '../present-handoff.web';
import { PRESENTER_PATH } from '../presenter.web';

/**
 * F-BROWSE-001 BR-13: [ Present this ] opens the presenter in a new tab of
 * this origin. The web build has the presenter root (F-TCH-004 PR 6); a
 * native build has none, so it never shows the button and never opens.
 */
type Tab = { opener: unknown };

describe('platform/present-handoff (web)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('counts the presenter root the chooser picks for /present (index.ts mounts PresenterApp for it, #591)', () => {
    expect(web.presenterRootExists()).toBe(true);
  });

  it('accepts the link presentHref builds from the one PRESENTER_PATH', () => {
    vi.stubGlobal('open', () => ({ opener: null }));
    expect(web.openPresenter(`${PRESENTER_PATH}#d=1.abc`)).toBe(true);
  });

  it('opens the same-origin link in a new tab and clears its opener, so no handle comes back', () => {
    const tab: Tab = { opener: {} };
    const open = vi.fn((_url: string, _target: string): Tab | null => tab);
    vi.stubGlobal('open', open);
    expect(web.openPresenter('/present#d=1.abc')).toBe(true);
    expect(open).toHaveBeenCalledWith('/present#d=1.abc', '_blank');
    expect(tab.opener).toBeNull();
  });

  it('reports a blocked pop-up or a throwing open as not opened', () => {
    vi.stubGlobal('open', () => null);
    expect(web.openPresenter('/present#d=1.abc')).toBe(false);
    vi.stubGlobal('open', () => {
      throw new Error('blocked');
    });
    expect(web.openPresenter('/present#d=1.abc')).toBe(false);
  });

  it('counts the tab as opened when the browser will not let its opener be cleared', () => {
    const tab = {};
    Object.defineProperty(tab, 'opener', {
      get: () => ({}),
      set: () => {
        throw new Error('read only');
      },
    });
    vi.stubGlobal('open', () => tab);
    expect(web.openPresenter('/present#d=1.abc')).toBe(true);
  });

  it('opens nothing where there is no window.open', () => {
    vi.stubGlobal('open', undefined);
    expect(web.openPresenter('/present#d=1.abc')).toBe(false);
  });

  it('opens nothing but a /present link', () => {
    const open = vi.fn(() => ({ opener: null }));
    vi.stubGlobal('open', open);
    expect(web.openPresenter('https://example.org/present#d=1.abc')).toBe(false);
    expect(web.openPresenter('/browse#d=1.abc')).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });
});

describe('platform/present-handoff (native)', () => {
  it('has no presenter root and opens nothing', () => {
    expect(native.presenterRootExists()).toBe(false);
    expect(native.openPresenter('/present#d=1.abc')).toBe(false);
  });
});
