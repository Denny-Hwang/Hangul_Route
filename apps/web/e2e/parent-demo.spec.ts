import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
const exported = join(__dirname, '..', 'out', 'parent');

test('the exported child pages have URL-safe names and hold real pages', () => {
  const pages = readdirSync(exported).filter((name) => name.endsWith('.html'));
  expect(pages.length).toBeGreaterThan(0);
  for (const name of pages) {
    expect(name).toMatch(/^[a-z0-9-]+\.html$/);
    const html = readFileSync(join(exported, name), 'utf8');
    expect(html, name).toContain('<main');
    expect(html, name).not.toContain(NOT_FOUND_HEADING);
  }
});

test('clicking each child link on /parent reaches that child, not the 404 page', async ({ page }) => {
  await page.goto('/parent');
  const links = page.getByRole('link', { name: /View progress/ });
  const count = await links.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    await page.goto('/parent');
    const card = page.locator('article').nth(i);
    const name = (await card.getByRole('heading', { level: 3 }).textContent())?.trim() ?? '';
    expect(name).not.toBe('');
    const link = card.getByRole('link', { name: /View progress/ });
    const href = (await link.getAttribute('href')) ?? '';
    expect(href).toMatch(/^\/parent\/[a-z0-9-]+$/);

    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}/?$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
    await expect(page.getByText(NOT_FOUND)).toHaveCount(0);

    const response = await page.request.get(href);
    expect(response.status(), href).toBe(200);
  }
});
