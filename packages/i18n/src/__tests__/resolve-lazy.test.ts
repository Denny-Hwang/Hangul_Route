import { describe, expect, it, vi } from 'vitest';
import { en } from '../messages/en';
import { es as esSource } from '../../messages-es';
import { ko as koSource } from '../../messages-ko';
import { es } from '../messages/es/index';
import { ko } from '../messages/ko';
import { fallbackPaths, getMessages, hasMessageOverlay, registerMessageOverlay } from '../resolve';
import { BUNDLED_MESSAGE_OVERLAYS as WEB_BUNDLED } from '../bundled-messages.web';

// The learner PWA's build: Metro resolves `./bundled-messages` to its `.web.ts` twin, which carries no
// overlay, and the app registers the active locale's overlay when its chunk arrives (F-CURR-002 §10).
vi.mock('../bundled-messages', async () => import('../bundled-messages.web'));

describe('message overlays registered at run time (the learner PWA)', () => {
  it('the web twin carries no overlay, and the root subpaths serve the shipped ones', () => {
    expect(WEB_BUNDLED).toEqual({});
    expect(esSource).toBe(es);
    expect(koSource).toBe(ko);
  });

  it('before its overlay is in, a locale reads English, unmemoised; English and the pseudo-locale need none', () => {
    expect(hasMessageOverlay('en')).toBe(true);
    expect(hasMessageOverlay('en-XA')).toBe(true);
    expect(hasMessageOverlay('es')).toBe(false);
    expect(getMessages('es')).toBe(en);
    expect(fallbackPaths('es').length).toBeGreaterThan(100);
  });

  it('once registered, the locale merges its overlay; a new overlay replaces the memoised dictionary', () => {
    registerMessageOverlay('es', es);
    expect(hasMessageOverlay('es')).toBe(true);
    const first = getMessages('es');
    expect(first).not.toBe(en);
    expect(first.common).toEqual(getMessages('es').common);
    expect(getMessages('es')).toBe(first);
    expect(fallbackPaths('es')).toEqual([]);
    // The same overlay again keeps the memo.
    registerMessageOverlay('es', es);
    expect(getMessages('es')).toBe(first);
    registerMessageOverlay('es', { common: { buttons: { ok: 'Vale' } } });
    expect(getMessages('es')).not.toBe(first);
    expect(getMessages('es').common.buttons.ok).toBe('Vale');
    expect(getMessages('es').common.buttons.cancel).toBe(en.common.buttons.cancel);
    // Korean is still out.
    expect(hasMessageOverlay('ko')).toBe(false);
    expect(getMessages('ko')).toBe(en);
  });
});
