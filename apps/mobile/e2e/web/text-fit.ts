import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The fit rule of AMENDMENTS-DISPLAY-NAV section 4 (text size), shared by the specs that check it.
 *
 * No sideways scroll and no text past the window's edge. The page is never wider than the window
 * (measured against the emulated viewport's width, not `innerWidth`, which a mobile browser widens
 * to fit a page that overflows). And because react-native-web's vertical ScrollView clips its
 * content sideways (`overflow-x: hidden`), so a line laid out too wide never reaches the document's
 * scroll width, every line of text on the page is measured too: each one must sit inside the
 * window, unless it is inside a row that scrolls sideways by design.
 */
export async function expectNoSidewaysScroll(page: Page, where: string): Promise<void> {
  const viewport = page.viewportSize()!.width;
  const widths = await page.evaluate(() => ({ html: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(Math.max(widths.html, widths.body), `${where}: ${JSON.stringify(widths)} > ${viewport}`).toBeLessThanOrEqual(viewport);
  const outside = await page.evaluate((vw) => {
    const scrollsSideways = (el: Element | null): boolean => {
      for (let p = el; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true;
      }
      return false;
    };
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      const el = node.parentElement;
      if (text === '' || !el || getComputedStyle(el).visibility === 'hidden') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of Array.from(range.getClientRects())) {
        if (r.width <= 1 || r.height <= 1) continue;
        if ((r.right > vw + 1 || r.left < -1) && !scrollsSideways(el)) out.push(`"${text.slice(0, 40)}" at ${Math.round(r.left)}..${Math.round(r.right)}`);
      }
    }
    return out;
  }, viewport);
  expect(outside, `${where}: text past the ${viewport} px window`).toEqual([]);
}

/** The computed font size of an element, in CSS px. */
export function fontSizeOf(target: Locator): Promise<number> {
  return target.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
}

/** The install guide's Not now, if it opens. */
export async function closeInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByRole('button', { name: 'Not now' }).click();
}
