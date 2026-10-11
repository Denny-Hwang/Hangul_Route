import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Issue #237: every "View progress" link on the /parent demo dashboard reaches its
 * child's page over the static export, never the exported 404 page.
 *
 * The production host does not serve a file name with a colon (it redirects
 * `/parent/profile:mina` to `/parent/profile%3Amina` and answers 404), while the local
 * server decodes paths. So the check also pins that the exported child pages and the
 * links are colon-free and need no percent-encoding.
 */
const NOT_FOUND = 'This page could not be found';
/** The heading Next's exported 404 page renders (every page also carries the 404 template in its RSC payload, so the text alone is not a signal). */
const NOT_FOUND_HEADING = '<h1 class="next-error-h1"';
const out = join(__dirname, '..', 'out');
const exported = join(out, 'parent');
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every path under `dir`, relative to `out`, files and directories alike. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    const rel = relative(out, full);
    return entry.isDirectory() ? [rel, ...walk(full)] : [rel];
  });
}

test('no exported path holds a colon or a percent-escape the host would not serve', () => {
  const paths = walk(out);
  expect(paths.length).toBeGreaterThan(0);
  expect(paths.filter((path) => /[:%]/.test(path))).toEqual([]);
});

test('the exported child pages have URL-safe names and hold real pages', () => {
  const entries = readdirSync(exported);
  for (const name of entries) expect(name).toMatch(/^[a-z0-9-]+(\.html|\.txt)?$/);
  const pages = entries.filter((name) => name.endsWith('.html'));
  expect(pages.length).toBeGreaterThan(0);
  for (const name of pages) {
    const html = readFileSync(join(exported, name), 'utf8');
    expect(html, name).toContain('<main');
    expect(html, name).not.toContain(NOT_FOUND_HEADING);
  }
});

test('clicking each child link on /parent reaches that child, not the 404 page', async ({ page }) => {
  const kidCards = page.getByRole('article').filter({ has: page.getByRole('link', { name: /View progress/ }) });
  await page.goto('/parent');
  const count = await kidCards.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    await page.goto('/parent');
    const card = kidCards.nth(i);
    const name = (await card.getByRole('heading', { level: 3 }).textContent())?.trim() ?? '';
    expect(name).not.toBe('');
    const link = card.getByRole('link', { name: /View progress/ });
    const href = (await link.getAttribute('href')) ?? '';
    expect(href).toMatch(/^\/parent\/[a-z0-9-]+$/);

    await link.click();
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(href)}/?$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0);

    const response = await page.request.get(href);
    expect(response.status(), href).toBe(200);
  }
});
