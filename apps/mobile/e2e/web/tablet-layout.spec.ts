import { expect, test } from './fixtures';

/**
 * Tablet / desktop web shell (F-LAYOUT-001 §3.3, PR 2a): the window is the
 * app. `#root` is as wide as the window (the content cap lives inside
 * `Screen`, not on the shell) and the manifest no longer locks portrait.
 * Panes, the portrait guard and the tab bar are later PRs of the spec.
 */
const WIDE_VIEWPORTS = [
  { name: 'iPad portrait', width: 768, height: 1024 },
  { name: 'iPad Air landscape / laptop', width: 1180, height: 820 },
] as const;

for (const vp of WIDE_VIEWPORTS) {
  test.describe(`${vp.name} ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('#root is as wide as the window, with no cap and no side borders', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
      const root = await page.evaluate(() => {
        const el = document.getElementById('root');
        if (!el) return null;
        const css = getComputedStyle(el);
        return {
          width: el.getBoundingClientRect().width,
          left: el.getBoundingClientRect().left,
          maxWidth: css.maxWidth,
          borderLeft: css.borderLeftWidth,
          borderRight: css.borderRightWidth,
        };
      });
      expect(root, '#root exists').not.toBeNull();
      expect(root!.width).toBe(vp.width);
      expect(root!.left).toBe(0);
      expect(root!.maxWidth).toBe('none');
      expect(root!.borderLeft).toBe('0px');
      expect(root!.borderRight).toBe('0px');
    });
  });
}

test('the web manifest does not lock the orientation', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = (await res.json()) as { orientation?: string };
  expect(manifest.orientation).toBe('any');
});
