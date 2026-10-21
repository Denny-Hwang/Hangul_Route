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

/**
 * The other half of the fit rule: no text is clipped. A line laid out inside a box that hides its
 * overflow (`overflow: hidden` or `clip` on that axis, a fixed tile, a disc, a card with rounded
 * corners) must sit wholly inside it: a line that is partly inside and partly cut off is clipped
 * (one that is wholly outside is a page of a pager, hidden by design, and is not counted). A
 * deliberate clamp (`numberOfLines`: a line clamp, or one line with an ellipsis) is not counted.
 * And a text field shows all of what it holds: a field with a value scrolls neither sideways
 * (`scrollWidth`) nor, for a many-line field, down (`scrollHeight`), which would hide its end.
 */
export async function expectNoClippedText(page: Page, where: string): Promise<void> {
  const found = await page.evaluate(() => {
    const TOLERANCE = 1;
    const shown = (el: Element): boolean => {
      const check = (el as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility;
      if (typeof check === 'function') return check.call(el, { opacityProperty: true, visibilityProperty: true });
      const cs = getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.opacity !== '0';
    };
    const clamped = (el: Element | null): boolean => {
      for (let p = el; p; p = p.parentElement) {
        const cs = getComputedStyle(p) as CSSStyleDeclaration & { webkitLineClamp?: string };
        if ((cs.webkitLineClamp ?? 'none') !== 'none' || cs.textOverflow === 'ellipsis') return true;
      }
      return false;
    };
    /**
     * The nearest box that hides what passes its edge on that axis; none when the nearest box that
     * does not show its overflow scrolls on that axis (what passes its edge is reached by scrolling).
     */
    const clipper = (el: Element, axis: 'x' | 'y'): Element | null => {
      for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
        const cs = getComputedStyle(p);
        const overflow = axis === 'x' ? cs.overflowX : cs.overflowY;
        if (overflow === 'hidden' || overflow === 'clip') return p;
        if (overflow === 'auto' || overflow === 'scroll') return null;
      }
      return null;
    };
    const cut = (r: DOMRect, box: DOMRect, axis: 'x' | 'y'): boolean => {
      const [start, end, boxStart, boxEnd] = axis === 'x' ? [r.left, r.right, box.left, box.right] : [r.top, r.bottom, box.top, box.bottom];
      const overlap = Math.min(end, boxEnd) - Math.max(start, boxStart);
      if (overlap <= TOLERANCE) return false; // wholly outside: a pager's other page
      return start < boxStart - TOLERANCE || end > boxEnd + TOLERANCE;
    };
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      const el = node.parentElement;
      if (text === '' || !el || !shown(el) || clamped(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 1 && r.height > 1);
      for (const axis of ['x', 'y'] as const) {
        const box = clipper(el, axis);
        if (!box) continue;
        const bounds = box.getBoundingClientRect();
        if (rects.some((r) => cut(r, bounds, axis))) {
          out.push(`"${text.slice(0, 40)}" cut ${axis === 'x' ? 'sideways' : 'top or bottom'} by <${box.tagName.toLowerCase()}${box.getAttribute('data-testid') ? ` data-testid=${box.getAttribute('data-testid')}` : ''}>`);
          break;
        }
      }
    }
    for (const field of Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'))) {
      if (field.value === '' || !shown(field) || (field instanceof HTMLInputElement && !['text', 'search', 'email', 'tel', 'url', ''].includes(field.type))) continue;
      const name = field.getAttribute('data-testid') ?? field.getAttribute('aria-label') ?? field.tagName.toLowerCase();
      if (field.scrollWidth > field.clientWidth + TOLERANCE) out.push(`field ${name} scrolls sideways: ${field.scrollWidth} > ${field.clientWidth}`);
      if (field instanceof HTMLTextAreaElement && field.scrollHeight > field.clientHeight + TOLERANCE) out.push(`field ${name} hides its last line: ${field.scrollHeight} > ${field.clientHeight}`);
    }
    return out;
  });
  expect(found, `${where}: clipped text`).toEqual([]);
}

/** The whole fit rule (AMENDMENTS-DISPLAY-NAV section 4): nothing scrolls sideways and no text is clipped. */
export async function expectTextFits(page: Page, where: string): Promise<void> {
  // A size that follows a layout (a code field fitted to its width) settles within a frame or two.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expectNoSidewaysScroll(page, where);
  await expectNoClippedText(page, where);
}

/** The computed font size of an element, in CSS px. */
export function fontSizeOf(target: Locator): Promise<number> {
  return target.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
}

/** The install guide's Not now (by test id, so any UI language), if it opens. */
export async function closeInstallGuide(page: Page): Promise<void> {
  const guide = page.getByTestId('install-guide');
  await guide.waitFor({ state: 'visible', timeout: 1500 }).catch(() => undefined);
  if (await guide.isVisible()) await guide.getByTestId('install-guide-not-now').click();
}
