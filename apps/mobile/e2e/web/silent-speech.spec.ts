import { expect, test } from './fixtures';

/** The suite never speaks through the developer's speakers (see fixtures.ts). */
test('the page starts with a silent speech engine, not the browser one', async ({ page }) => {
  await page.goto('/');
  const state = await page.evaluate(() => ({
    native: /\[native code\]/.test(window.speechSynthesis.speak.toString()),
    voices: window.speechSynthesis.getVoices().length,
  }));
  expect(state).toEqual({ native: false, voices: 0 });
});
