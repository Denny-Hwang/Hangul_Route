import type { Locator, Page } from '@playwright/test';
import { LIBRARY_SCENE } from '@hangul-route/content-schema/testing/role-play';
import { expect, test } from './fixtures';
import { keepSidewaysIfAsked, seedStored } from './helpers';
import { shot } from './shots';
import { expectNoHorizontalOverflow } from './viewport';

/**
 * F-CURR-002 row CM-35: Role Play, read and tap (design/wireframes/minigame/role-play.md, design/screens/minigame-variety/
 * mock/role-play.html, boards R, R1, R2, R3). No shipped lesson cell plays `role-play` until the Stage 4 and pack rows,
 * so this suite hands the fixture scene (`@hangul-route/content-schema/testing/role-play`) to the fixture bundle's
 * `window.__hrRolePlayE2E` (served from dist-e2e/):
 *
 *   pnpm --filter @hangul-route/mobile build:web:fixtures
 *   STORY_FIXTURES=1 pnpm --filter @hangul-route/mobile exec playwright test role-play
 *
 * The file name starts with `sentence-builder` so the fixture e2e run of .github/workflows/web-app.yml, whose file
 * filters match by name prefix, selects it (Role Play pairs with Sentence Builder in the Stage 4 Food quests, section
 * 7.1). A `role-play` entry of its own in that list is an owner change to the workflow; the file can then drop the prefix.
 *
 * `game.role-play` ships at built-in pct 0, so each case sets it through the stored remote copy, as the quest screen
 * reads it: on, the Role Play chunk; off, Tap to Respond on the same turns. This browser has no Korean voice (the
 * fixture's silent engine), so every line is read from the screen. In the production build the suite is skipped.
 */

const FIXTURE_BUILD = process.env.STORY_FIXTURES === '1';
const AMBER = 'rgb(242, 179, 61)'; // colors.feedback.nudge
const RED = 'rgb(200, 75, 61)'; // colors.feedback.danger: never on a learner's miss
/** The 48 dp floor of section 14 (touchTarget.min is 64, the reply bubbles touchTarget.child, 80). */
const FLOOR = 48;

interface Log {
  answers: Array<{ key: string; correct: boolean; itemId?: string; hinted?: boolean }>;
  completes: number;
}
interface TelemetryEvent {
  name: string;
  payload?: Record<string, unknown>;
}
type E2eWindow = Window & { __hrRolePlayE2E?: { open(params: { scene: unknown }): void; log(): Log; events(): TelemetryEvent[] } };

async function open(page: Page, flag: { on: boolean; pct: number }, settings?: Record<string, unknown>): Promise<void> {
  await page.goto('/');
  await keepSidewaysIfAsked(page);
  await seedStored(page, 'remote-config', { v: 1, fetchedAt: Date.now(), maxAgeS: 300, flags: { 'game.role-play': flag } });
  if (settings) await seedStored(page, 'device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z', ...settings });
  await page.waitForFunction(() => Boolean((window as E2eWindow).__hrRolePlayE2E), undefined, { timeout: 10_000 });
  await page.evaluate((scene) => (window as E2eWindow).__hrRolePlayE2E?.open({ scene }), LIBRARY_SCENE as unknown);
  await page.addStyleTag({ content: '[data-testid="pwa-banners"] { display: none !important; }' });
}
const ON = { on: true, pct: 100 };
const reply = (page: Page, id: string): Locator => page.getByTestId(`role-play-reply-${id}`);
const log = (page: Page): Promise<Log> => page.evaluate(() => (window as E2eWindow).__hrRolePlayE2E!.log());
const events = (page: Page): Promise<TelemetryEvent[]> => page.evaluate(() => (window as E2eWindow).__hrRolePlayE2E!.events());

async function box(target: Locator) {
  const b = await target.boundingBox();
  expect(b, 'has a box').not.toBeNull();
  return b!;
}
/** Whether `inner` lies fully inside `outer` (the visible part of a scrolling area). */
async function inside(inner: Locator, outer: Locator): Promise<boolean> {
  const [i, o] = [await box(inner), await box(outer)];
  return i.y >= o.y - 0.5 && i.y + i.height <= o.y + o.height + 0.5;
}
/** Send a reply and wait for the partner's next line (the reply is said for at least 900 ms first). */
async function send(page: Page, id: string, next: string): Promise<void> {
  await reply(page, id).click();
  await expect(page.getByTestId('role-play-partner-newest')).toContainText(next);
}

/**
 * Turn 2 at the wireframe's worst case: the newest line and its Hear it in the log, the first reply in the pinned area.
 * At Largest on 320 x 568 the whole bubble cannot sit beside the instruction row and a reply, so the log opens on the
 * bubble's top (its role and Korean line in view) and its Hear it is a scroll of the log away.
 */
async function checkTurnTwo(page: Page, where: string, largest = false): Promise<void> {
  const logArea = page.getByTestId('role-play-log');
  const pinned = page.getByTestId('role-play-replies');
  const newest = page.getByTestId('role-play-partner-newest');
  if (largest) {
    await expect.poll(() => inside(newest.getByText('무슨 책을 찾아요?'), logArea), { message: `${where}: the newest Korean line is in the log's visible part` }).toBe(true);
  } else {
    await expect.poll(() => inside(newest, logArea), { message: `${where}: the newest partner bubble is in the log's visible part` }).toBe(true);
    await expect.poll(() => inside(page.getByTestId('role-play-hear'), logArea), { message: `${where}: its Hear it is in view` }).toBe(true);
  }
  const ids = await pinned.locator('[data-testid^="role-play-reply-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
  expect(ids).toHaveLength(3);
  await expect.poll(() => inside(page.getByTestId(ids[0]!), pinned), { message: `${where}: the first reply is in the pinned area's visible part` }).toBe(true);
  if (largest) {
    const hear = page.getByTestId('role-play-hear');
    await expect
      .poll(
        async () => {
          await hear.scrollIntoViewIfNeeded();
          return inside(hear, logArea);
        },
        { message: `${where}: Hear it is reached by scrolling the log` },
      )
      .toBe(true);
  }
}

test.describe('Role Play: read and tap (F-CURR-002 row CM-35)', () => {
  test.skip(!FIXTURE_BUILD, 'needs the fixture bundle (STORY_FIXTURES=1, build:web:fixtures)');

  test('320 x 568: a branch, an amber nudge that sends nothing, the scroll cue, a good ending with Continue', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ON);
    await expect(page.getByTestId('role-play')).toBeVisible();
    await expect(page.getByText('Tap a reply')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Chat' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Turn 1: a less natural reply locks in amber, Hoya says why, nothing joins the chat.
    await reply(page, 'meal').click();
    await expect(page.getByTestId('role-play-why')).toContainText('That one is for the start of a meal. Try a greeting.');
    await expect(reply(page, 'meal')).toHaveAttribute('aria-label', 'Not this one: 잘 먹겠습니다!, jal meokgetseumnida');
    await expect(reply(page, 'meal')).toHaveCSS('border-top-color', AMBER);
    await expect(page.getByTestId('role-play-me')).toHaveCount(0);
    await shot(page, 'role-play-320-nudge');
    await send(page, 'hello', '무슨 책을 찾아요?');

    // Turn 2 of 4: three replies; the area stops short of the newest line and scrolls, with the cue while one is below.
    await expect(page.getByText('2 / 4')).toBeVisible();
    await checkTurnTwo(page, '320');
    await expect(page.getByTestId('role-play-more')).toBeVisible();
    await expect(page.getByTestId('role-play-more')).toContainText('More replies below');
    await shot(page, 'role-play-320-turn2');
    await page.getByTestId('role-play-replies').evaluate((el) => {
      const scroller = el.scrollHeight > el.clientHeight ? el : (el.firstElementChild as HTMLElement);
      scroller.scrollTop = scroller.scrollHeight;
      scroller.dispatchEvent(new Event('scroll'));
    });
    await expect(page.getByTestId('role-play-more')).toHaveCount(0);

    // Show meanings: the replies' meanings appear for this turn; the answer is recorded as hinted.
    await page.getByTestId('role-play-show-meanings').click();
    await expect(page.getByText('Meanings shown')).toBeVisible();
    await expect(page.getByText('I am looking for a Hangul book.')).toBeVisible();
    await send(page, 'hangeul', '한글 책은 여기 있어요.');
    await send(page, 'thanks', '또 오세요!');

    // Turn 4: the why line quotes Korean as taught Korean with its romanization.
    await reply(page, 'go').click();
    await expect(page.getByTestId('role-play-why')).toContainText('안녕히 계세요');
    await expect(page.getByTestId('role-play-why')).toContainText('annyeonghi gyeseyo');
    await reply(page, 'stay').click();
    await expect(page.getByTestId('role-play-end')).toBeVisible();
    await expect(page.getByText('You found your book!')).toBeVisible();
    await shot(page, 'role-play-320-end');

    // No red anywhere, no speaking UI.
    const colours = await page.getByTestId('role-play').evaluate((root) =>
      [...root.querySelectorAll('*')].flatMap((el) => {
        const s = getComputedStyle(el);
        return [s.color, s.backgroundColor, s.borderTopColor];
      }),
    );
    expect(colours).not.toContain(RED);
    await expect(page.getByText(/microphone|say it|speak|record/i)).toHaveCount(0);

    await page.getByTestId('role-play-continue').click();
    expect(await log(page)).toEqual({
      answers: [
        { key: 't1', correct: false, itemId: 't1/hello' },
        { key: 't2', correct: true, itemId: 't2/hangeul', hinted: true },
        { key: 't3b', correct: true, itemId: 't3b/thanks' },
        { key: 't4', correct: false, itemId: 't4/stay' },
      ],
      completes: 1,
    });
    // Telemetry names the kind and ids only: never the branch taken, a line or a reply.
    const finished = (await events(page)).filter((e) => e.name === 'minigame.finished');
    expect(finished.map((e) => e.payload)).toEqual([{ kind: 'role-play', questId: 'e2e-role-play', stepIndex: 0 }]);
    expect(JSON.stringify(await events(page))).not.toMatch(/[ㄱ-ㆎ가-힣]|t3b|hangeul/);
  });

  test('768 x 1024: everything fits, no scroll cue; bubbles keep to 80 % of the column', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await open(page, ON);
    await send(page, 'hello', '무슨 책을 찾아요?');
    await checkTurnTwo(page, '768');
    await expect(page.getByTestId('role-play-more')).toHaveCount(0);
    // There is room, so the scene title stays above the log.
    await expect(page.getByTestId('role-play-title')).toBeVisible();
    await expect(page.getByTestId('role-play-log').getByTestId('role-play-title')).toHaveCount(0);
    for (const id of ['storybook', 'hangeul', 'fine']) await expect.poll(() => inside(reply(page, id), page.getByTestId('role-play-replies')), { message: id }).toBe(true);
    const column = await box(page.getByTestId('role-play-log'));
    const bubble = await box(page.getByTestId('role-play-partner-newest'));
    expect(bubble.width).toBeLessThanOrEqual(column.width * 0.8 + 1);
    await shot(page, 'role-play-768-turn2');
  });

  test('Largest text at 320 x 568: the newest line and a reply stay in view, nothing sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ON, { textSize: 'largest' });
    await send(page, 'hello', '무슨 책을 찾아요?');
    await checkTurnTwo(page, 'Largest', true);
    await expect(page.getByTestId('role-play-more')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'role-play-320-largest');
  });

  test('Largest text at 320 x 568 in a font with taller lines: the title joins the log, the newest line and a reply stay in view', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ON, { textSize: 'largest' });
    // Line heights of a fallback font with tall metrics (a Linux browser's Korean font): every line 1.5 times its size.
    await page.addStyleTag({ content: '[data-testid="role-play"] * { line-height: 1.5 !important; }' });
    await send(page, 'hello', '무슨 책을 찾아요?');
    await checkTurnTwo(page, 'Largest, taller lines', true);
    // The scene title is now the log's first item, above the chat, so it scrolls away with it.
    await expect(page.getByTestId('role-play-log').getByTestId('role-play-title')).toHaveCount(1);
    await expect(page.getByTestId('role-play-more')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await shot(page, 'role-play-320-largest-tall');
  });

  test('targets: every control at least 48 dp, every reply bubble at least 80 tall', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ON);
    await send(page, 'hello', '무슨 책을 찾아요?');
    const controls = page.getByTestId('role-play').getByRole('button');
    const n = await controls.count();
    expect(n).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < n; i += 1) {
      const b = await box(controls.nth(i));
      expect(Math.min(b.width, b.height), (await controls.nth(i).getAttribute('aria-label')) ?? `button ${i}`).toBeGreaterThanOrEqual(FLOOR);
    }
    for (const id of ['storybook', 'hangeul', 'fine']) expect((await box(reply(page, id))).height, id).toBeGreaterThanOrEqual(80 - 0.5);
  });

  test('screen-reader order: the title, the chat in order (partner by role, my reply), then the instruction and the replies', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ON);
    await send(page, 'hello', '무슨 책을 찾아요?');
    const items = await page.getByRole('list', { name: 'Chat' }).getByRole('listitem').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(items).toEqual([
      'librarian says: 안녕하세요!, annyeonghaseyo. Hello!',
      'You said: 안녕하세요!, annyeonghaseyo',
      'librarian says: 무슨 책을 찾아요?, museun chaegeul chajayo. What book are you looking for?',
    ]);
    // Document order is reading order: title, log, instruction row, replies; the cue is hidden from screen readers.
    const order = await page.getByTestId('role-play').evaluate((root) => {
      const at = (sel: string) => root.querySelector(sel) as Element;
      const els = [at('[data-testid="role-play-title"]'), at('[role="list"]'), at('[data-testid="role-play-show-meanings"]'), at('[data-testid="role-play-replies"]')];
      return els.every((el, i) => i === 0 || Boolean(els[i - 1]!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(order).toBe(true);
    await expect(page.getByTestId('role-play-more')).toHaveAttribute('aria-hidden', 'true');
    // The newest partner bubble is a polite live region, so a new line is announced.
    await expect(page.getByTestId('role-play-partner-newest')).toHaveAttribute('aria-live', 'polite');
  });

  test('reduced motion: a new bubble is simply there (no rise), and the log sits at the newest line', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, ON);
    await expect(page.getByTestId('role-play')).toBeVisible();
    /** The vertical offset of each element from the newest `testId` bubble up to the chat list (the rise is a translate). */
    const offsets = (testId: string): Promise<number[]> =>
      page
        .getByTestId(testId)
        .last()
        .evaluate((el) => {
          const out: number[] = [];
          for (let at: Element | null = el; at && at.getAttribute('role') !== 'list'; at = at.parentElement) {
            const t = getComputedStyle(at).transform;
            out.push(t === 'none' ? 0 : new DOMMatrixReadOnly(t).m42);
          }
          return out;
        });
    // My reply joins the chat in place at once: read on the frame it shows, with no offset left to settle.
    await reply(page, 'hello').click();
    await expect(page.getByTestId('role-play-me')).toHaveCount(1);
    expect((await offsets('role-play-me')).every((y) => Math.abs(y) < 0.5)).toBe(true);
    // The partner's answer too, and the log is at the newest line with no smooth scroll.
    await expect(page.getByTestId('role-play-partner-newest')).toContainText('무슨 책을 찾아요?');
    expect((await offsets('role-play-partner-newest')).every((y) => Math.abs(y) < 0.5)).toBe(true);
    await expect.poll(() => inside(page.getByTestId('role-play-partner-newest'), page.getByTestId('role-play-log')), { message: 'the newest bubble is in view' }).toBe(true);
    expect(await page.getByTestId('role-play-log').evaluate((el) => [el, ...el.querySelectorAll('*')].every((n) => getComputedStyle(n).scrollBehavior !== 'smooth'))).toBe(true);
    await shot(page, 'role-play-320-reduced-motion');
  });

  test('game.role-play off: Tap to Respond on the same turns (the main path), and its telemetry names tap-respond', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page, { on: false, pct: 100 });
    await expect(page.getByText('Choose your reply')).toBeVisible();
    await expect(page.getByText('Someone says')).toBeVisible();
    await expect(page.getByTestId('role-play')).toHaveCount(0);
    const turns = [
      ['안녕하세요!', '안녕하세요!'],
      ['무슨 책을 찾아요?', '동화책을 찾아요.'],
      ['동화책은 여기 있어요.', '감사합니다!'],
      ['또 오세요!', '안녕히 계세요!'],
    ] as const;
    const shownLine = (line: string): Locator => page.getByRole('heading', { name: line }).or(page.getByText(line, { exact: true }).first());
    for (const [i, [line, right]] of turns.entries()) {
      await expect(shownLine(line)).toBeVisible();
      // The second natural reply of turn 2 is not offered: every option left has one right answer.
      await expect(page.getByText('한글 책을 찾아요.')).toHaveCount(0);
      await page.getByRole('button', { name: new RegExp(`^${right.replace(/[.!?]/g, '\\$&')}`) }).click();
      // Paced by what shows, not by a clock: the next turn's line, or after the last turn the finished game.
      const next = turns[i + 1];
      if (next) await expect(shownLine(next[0])).toBeVisible();
    }
    await expect
      .poll(async () => (await events(page)).filter((e) => e.name === 'minigame.finished').map((e) => e.payload?.kind), { message: 'the fallback finishes as tap-respond' })
      .toEqual(['tap-respond']);
    await shot(page, 'role-play-320-fallback');
  });
});
