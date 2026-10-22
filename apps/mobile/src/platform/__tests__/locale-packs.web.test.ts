import { OVERLAYS } from '@hangul-route/content-schema/overlays';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { loadLocalePack as nativeLoader } from '../locale-packs';
import { loadLocalePack } from '../locale-packs.web';

/**
 * The learner PWA's locale chunks (F-CURR-002 §10): each literal `import()` reaches the chunk of its locale,
 * which carries that locale's whole message overlay and content overlays (the tests read the packages' eager
 * tables, which hold the same text). The native build has no loader.
 */
describe('locale chunk loaders', () => {
  it('the web loader reaches each locale\'s chunk, with its marker, its messages and its content text', async () => {
    expect(loadLocalePack).not.toBeNull();
    for (const locale of ['es', 'ko'] as const) {
      const chunk = await loadLocalePack!(locale);
      expect(chunk.LOCALE_PACK).toBe(`locale-pack:${locale}`);
      expect(chunk.LOCALE_CONTENT).toEqual(OVERLAYS[locale]);
      expect(Object.keys(chunk.LOCALE_CONTENT).length).toBeGreaterThan(100);
      expect(chunk.LOCALE_MESSAGES.common?.buttons?.ok).toBe(getMessages(locale).common.buttons.ok);
      expect(Object.keys(chunk.LOCALE_MESSAGES).sort()).toEqual(['a11y', 'caregiver', 'common', 'console', 'landing', 'learner', 'report']);
    }
  });

  it('native carries every locale in its one bundle: no loader', () => {
    expect(nativeLoader).toBeNull();
  });
});
