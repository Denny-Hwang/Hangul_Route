import { expect, test } from '@playwright/test';

/**
 * Launch-invite signup in a real browser over the static export. The API is
 * mocked at the network layer, so no data leaves the machine.
 *
 * The form talks to NEXT_PUBLIC_API_BASE_URL, which Next inlines at build time,
 * so build the export with it set, for example:
 *   NEXT_PUBLIC_API_BASE_URL=https://api.e2e.test pnpm --filter @hangul-route/web build
 *   NEXT_PUBLIC_API_BASE_URL=https://api.e2e.test pnpm --filter @hangul-route/web test:e2e
 * Without it the form renders its "not working right now" fallback and these tests skip.
 */
const API = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
test.skip(!API, 'build the export with NEXT_PUBLIC_API_BASE_URL to exercise the signup');

const endpoint = (): string => `${API}/api/waitlist`;
const ok = { status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: true, data: { subscribed: true } }) };

test('a valid address shows the confirmation without leaving the page, and posts JSON to our API', async ({ page }) => {
  const requests: string[] = [];
  await page.route(endpoint(), async (route) => {
    requests.push(route.request().postData() ?? '');
    await route.fulfill(ok);
  });
  await page.goto('/');
  const start = page.url();
  await page.getByLabel('Your email').fill('learner@example.com');
  await page.getByRole('button', { name: 'Get launch news' }).click();
  await expect(page.getByRole('status').filter({ hasText: "You're on the list" })).toBeVisible();
  expect(page.url()).toBe(start);
  expect(requests).toHaveLength(1);
  expect(JSON.parse(requests[0] as string)).toMatchObject({ email: 'learner@example.com', source: 'landing', locale: 'en', website: '' });
  await expect(page.getByLabel('Your email')).toHaveCount(0);
});

test('a typo is caught in the page, with no request', async ({ page }) => {
  let calls = 0;
  await page.route(endpoint(), async (route) => {
    calls += 1;
    await route.fulfill(ok);
  });
  await page.goto('/');
  await page.getByLabel('Your email').fill('not-an-email');
  await page.getByRole('button', { name: 'Get launch news' }).click();
  await expect(page.locator('#waitlist-message')).toContainText('valid email address');
  await expect(page.getByLabel('Your email')).toHaveAttribute('aria-invalid', 'true');
  expect(calls).toBe(0);
});

test('a network failure offers a retry that then succeeds', async ({ page }) => {
  let attempt = 0;
  await page.route(endpoint(), async (route) => {
    attempt += 1;
    if (attempt === 1) await route.abort('failed');
    else await route.fulfill(ok);
  });
  await page.goto('/');
  await page.getByLabel('Your email').fill('learner@example.com');
  await page.getByRole('button', { name: 'Get launch news' }).click();
  await expect(page.locator('#waitlist-message')).toContainText('could not reach the server');
  await expect(page.getByLabel('Your email')).toHaveValue('learner@example.com');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('status').filter({ hasText: "You're on the list" })).toBeVisible();
  expect(attempt).toBe(2);
});

// [SN] AMENDMENTS-SITE-NEWUSER §3.3 item 6: the home's form sits in the quiet launch-news section after the band.
test('[SN] the form is the plain-tone one in #news, after the closing band, with 64 px controls', async ({ page }) => {
  await page.route(endpoint(), (route) => route.fulfill(ok));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const field = page.locator('#news').getByLabel('Your email');
  await expect(field).toBeVisible();
  const band = await page.locator('section.hr-site-band').boundingBox();
  const form = await page.locator('#news form').boundingBox();
  expect((form?.y ?? 0)).toBeGreaterThan((band?.y ?? Infinity) + (band?.height ?? 0));
  for (const control of [field, page.locator('#news').getByRole('button', { name: 'Send me the invite' })]) {
    expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(64);
  }
  await field.fill('learner@example.com');
  await page.locator('#news').getByRole('button', { name: 'Send me the invite' }).click();
  await expect(page.locator('#news').getByRole('status').filter({ hasText: "You're on the list" })).toBeVisible();
});

test('the consent line links to the privacy policy', async ({ page }) => {
  await page.goto('/');
  const consent = page.locator('#waitlist-consent');
  await expect(consent).toContainText('only to send Hangul Route launch news');
  await expect(consent.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy');
});
