import { encodeDeck, LECTURE_MESSAGE_NS, type LectureDeckInput } from '@hangul-route/content-schema';
import { expect, test } from './fixtures';

/**
 * F-TCH-004 PR 6 (spec section 3.2 roster hand-off, TD3, section 5): the console-to-presenter
 * hand-off without a second server, first cases. `context.route` serves a tiny opener page on
 * `http://localhost:3000` (an allowed console origin) whose button runs `window.open` on the
 * presenter and answers its `ready` with a `roster` of two fixture names. The presenter then
 * counts the names it received, and no request URL, page URL or tab title ever holds a name. A
 * reload gets the names again while the opener is open; the same link opened directly (no opener)
 * uses numbers and says why; a roster posted by a window that is not the opener is ignored.
 * PR 9 extends this file with the picker drawing one of the names.
 */

const NAMES = ['Mina', 'Joon'];
const DECK: LectureDeckInput = {
  v: 1,
  id: 'lecture:roster01',
  title: 'Week 3 letters',
  createdAt: '2026-10-13T09:00:00Z',
  seed: 3,
  blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
  picker: { mode: 'names', count: 2 },
};

function openerPage(presenterUrl: string): string {
  const roster = { ns: LECTURE_MESSAGE_NS, v: 1, type: 'roster', deckId: DECK.id, mode: 'names', labels: NAMES };
  return `<!doctype html><html><body>
<button id="open">Open presenter</button>
<script>
  var opened = new Set();
  var appOrigin = new URL(${JSON.stringify(presenterUrl)}).origin;
  document.getElementById('open').addEventListener('click', function () {
    var w = window.open(${JSON.stringify(presenterUrl)}, '_blank');
    if (w) opened.add(w);
  });
  window.addEventListener('message', function (event) {
    var d = event.data || {};
    if (event.origin !== appOrigin || !opened.has(event.source)) return;
    if (d.ns !== ${JSON.stringify(LECTURE_MESSAGE_NS)} || d.type !== 'ready' || d.deckId !== ${JSON.stringify(DECK.id)}) return;
    window.__readyCount = (window.__readyCount || 0) + 1;
    event.source.postMessage(${JSON.stringify(roster)}, appOrigin);
  });
</script></body></html>`;
}

test.describe('roster hand-off', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

  test('names arrive from the opener only, and never reach a URL or the title', async ({ page, context, baseURL }) => {
    const presenterUrl = `${baseURL}/present#d=${encodeDeck(DECK)}`;
    const requested: string[] = [];
    context.on('request', (req) => requested.push(req.url()));
    await context.route('http://localhost:3000/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: openerPage(presenterUrl) }));

    await page.goto('http://localhost:3000/lecture');
    const [popup] = await Promise.all([context.waitForEvent('page'), page.click('#open')]);
    await expect(popup.getByText('2 names received')).toBeVisible({ timeout: 15_000 });
    await expect(popup.getByText(/Names come from the console page/)).toHaveCount(0);
    await expect(popup).toHaveTitle('Hangul Route lecture');
    expect(new URL(popup.url()).hash).toBe('');
    // A name is in memory only: never in the address, the title or any request.
    for (const name of NAMES) {
      expect(popup.url()).not.toContain(name);
      expect(await popup.title()).not.toContain(name);
      expect(requested.filter((u) => u.includes(name))).toEqual([]);
    }
    const historyLength = await popup.evaluate(() => history.length);
    expect(historyLength).toBeLessThanOrEqual(2);

    // A reload while the opener is open gets the names again.
    await popup.reload();
    await expect(popup.getByText('2 names received')).toBeVisible({ timeout: 15_000 });
    expect(await page.evaluate(() => (window as Window & { __readyCount?: number }).__readyCount)).toBeGreaterThanOrEqual(2);
    for (const name of NAMES) expect(requested.filter((u) => u.includes(name))).toEqual([]);
  });

  test('the same link opened directly uses numbers and ignores a roster from a window that is not the opener', async ({ page }) => {
    await page.goto(`/present#d=${encodeDeck(DECK)}`);
    await expect(page.getByText('Numbers 1 to 2')).toBeVisible();
    await expect(page.getByText('Names come from the console page that opened this lesson. Using numbers.')).toBeVisible();
    await page.evaluate(
      ({ ns, deckId, names }) => {
        window.postMessage({ ns, v: 1, type: 'roster', deckId, mode: 'names', labels: names }, window.location.origin);
      },
      { ns: LECTURE_MESSAGE_NS, deckId: DECK.id, names: NAMES },
    );
    await page.waitForTimeout(300);
    await expect(page.getByText('2 names received')).toHaveCount(0);
    await expect(page.getByText('Numbers 1 to 2')).toBeVisible();
  });
});
