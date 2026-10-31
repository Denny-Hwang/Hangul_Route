import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { questsAll } from '../../../content';
import { LESSON_STAGE_MODULES } from '../../../content/__tests__/helpers/lesson-stages';
import { localizeScope } from '../../../logic/content-locale';
import { tileId } from '../../../logic/cloze-pick/round';
import { scopeFor, type MinigameScope } from '../../../logic/minigame-config';
import { byTestId, hostNodes, press, render, screenTexts, unmount } from '../../../test-support/render';
import { ClozePickStep, FLAG_DECIDE_TIMEOUT_MS, type ClozePickRendered } from '../cloze-pick-entry';
import { ClozePickFallback } from '../cloze-pick-fallback';
import { ClozePickGame } from '../ClozePickGame';
import type { MinigameHost } from '../host';
import { WriteFrameGame } from '../WriteFrameGame';

/**
 * F-CURR-002 row CM-3A S7 (sections 12.2 and 14, "every quest renders with each game.<kind> off"): every round of
 * every Stage 7 Check step renders at 320 px in en, es and ko, in the Check host (`mode: 'check'`). A Cloze Pick Check
 * draws Cloze Pick with `game.cloze-pick` on and its Listen & Pick fallback (text prompt, the same tiles) with it off;
 * a Write Frame Check draws its word bank, the "Quick check" header and no Skip, before and after the pick (the Check
 * is the quest's only evidence, `logic/quest-flow/check-launcher.ts`). Every Check is a shipped game or behind a
 * switch with a fallback, so no switch leaves a Stage 7 Check unplayable. The screens draw in each UI language's
 * messages (the Check pill is the locale's own), and each Cloze Pick Check also mounts through its step door,
 * `ClozePickStep`, with the switch off and with it left undecided past `FLAG_DECIDE_TIMEOUT_MS` (a Check has no Skip,
 * so it must never wait on a switch that is never decided).
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  playPrompt: vi.fn(() => Promise.resolve('played' as const)),
  stop: vi.fn(),
  hasClip: vi.fn(() => false),
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => true }));
// The UI language of the screens: each locale's own messages, as the device's locale would give them.
const ui = vi.hoisted(() => ({ locale: 'en' as UiLocale }));
vi.mock('../../../i18n/use-messages', async (importOriginal) => {
  const { getMessages: messagesOf } = await import('@hangul-route/i18n');
  return { ...(await importOriginal<object>()), useMessages: () => messagesOf(ui.locale), useLocale: () => ui.locale };
});
// `game.cloze-pick` as the step door reads it: off (false) or never decided (null).
const flag = vi.hoisted(() => ({ value: false as boolean | null }));
vi.mock('../../../store/remote-config-store', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCurrFlagDecided: (name: string) => (name === 'game.cloze-pick' ? flag.value : null),
}));
// The Cloze Pick chunk carries the fixture build's e2e hook, which imports the native navigation package (no Node build).
vi.mock('@react-navigation/native', () => ({ useNavigation: () => ({ dispatch: () => undefined }), StackActions: { push: () => undefined } }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));

const host: MinigameHost = { mode: 'check', answer: () => undefined, complete: () => undefined };
/** No game draws a Skip in the Check (any `*-skip` test id). */
const skips = (r: ReactTestRenderer): number => hostNodes(r.root, (n) => typeof n.props['data-testid'] === 'string' && n.props['data-testid'].endsWith('-skip')).length;
const LOCALES: readonly UiLocale[] = ['en', 'es', 'ko'];
/** The locale's own Check pill ("Quick check" in English). */
const pillOf = (locale: UiLocale): string => getMessages(locale).learner.minigame.listenPick.checkTitle.pill;
const overlaysOf = (ref: string) => Object.values(LESSON_STAGE_MODULES).find((m) => ref in m.LESSON_SCOPES)?.LESSON_SCOPE_OVERLAYS;

const checks = questsAll
  .filter((q) => q.id.startsWith('quest:stage7-'))
  .map((q) => {
    const ref = q.steps.find((s) => s.kind === 'check')?.minigameRef as string;
    return { questId: q.id, ref, scope: scopeFor(ref) as MinigameScope };
  });

const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  ui.locale = 'en';
  flag.value = false;
});
async function mount(node: React.ReactElement): Promise<ReactTestRenderer> {
  const r = await render(<LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>{node}</LayoutProvider>, {
    createNodeMock: () => ({ focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
  mounted.push(r);
  await act(async () => undefined);
  return r;
}

describe('the Stage 7 Checks render with their switches on and off (row CM-3A S7)', () => {
  it('reaches all 27 Stage 7 Checks: 9 Cloze Pick, 9 Write Frame, 9 Sentence Builder (Volume 1 and, since rows CM-41 S7, CM-42 S7, CM-43 S7 and CM-45 S7, Nature, Play & Crafts, Food & Daily Life and Holidays & Traditions Volume 2)', () => {
    expect(checks).toHaveLength(27);
    const kinds = checks.map((c) => c.scope.kind).sort();
    expect(kinds.filter((k) => k === 'cloze-pick')).toHaveLength(9);
    expect(kinds.filter((k) => k === 'write-frame')).toHaveLength(9);
    expect(kinds.filter((k) => k === 'order-it')).toHaveLength(9);
  });

  it('each locale has a Check pill of its own (es and ko are not the English)', () => {
    expect(pillOf('en')).toBe('Quick check');
    expect(pillOf('es')).not.toBe(pillOf('en'));
    expect(pillOf('ko')).not.toBe(pillOf('en'));
  });

  for (const locale of LOCALES) {
    it(`${locale}: each Cloze Pick Check draws the game when on and the Listen & Pick fallback on the same tiles when off`, async () => {
      ui.locale = locale;
      for (const { questId, ref, scope } of checks.filter((c) => c.scope.kind === 'cloze-pick')) {
        const local = localizeScope(scope, ref, locale, overlaysOf(ref));
        expect(local.clozePick!.rounds, questId).toHaveLength(2);
        for (const [i, round] of local.clozePick!.rounds.entries()) {
          // Each round on its own, so every round of the Check is drawn, not only the first.
          const one = { ...local, rounds: 1, clozePick: { ...local.clozePick!, rounds: [round] } };
          const where = `${questId} ${round.id}`;
          const on = await mount(<ClozePickGame scope={one} host={host} />);
          expect(byTestId(on.root, 'cloze-pick-sentence').length, `${where} on`).toBeGreaterThan(0);
          expect(byTestId(on.root, `cloze-pick-tile-${tileId(round.id, round.answerIndex)}`).length, `${where} on`).toBeGreaterThan(0);
          expect(skips(on), `${where} on`).toBe(0);
          const off = await mount(<ClozePickFallback scope={one} host={host} />);
          expect(byTestId(off.root, 'listen-pick-text-prompt').length, `${where} off`).toBeGreaterThan(0);
          expect(byTestId(off.root, `listen-pick-option-${tileId(round.id, round.answerIndex)}`).length, `${where} off`).toBeGreaterThan(0);
          expect(skips(off), `${where} off`).toBe(0);
          expect(screenTexts(off.root), `${where} off`).toContain(pillOf(locale));
          // The meaning shown is the UI language's gloss of the sentence, never the English in es or ko.
          if (locale !== 'en') expect(screenTexts(off.root).join(' '), where).not.toContain(scope.clozePick!.rounds[i]!.sentence.en);
        }
      }
    }, 60_000);

    it(`${locale}: each round of each Write Frame Check draws its frame, its word bank and the Check header, with no Skip before or after the pick`, async () => {
      ui.locale = locale;
      for (const { questId, ref, scope } of checks.filter((c) => c.scope.kind === 'write-frame')) {
        const local = localizeScope(scope, ref, locale, overlaysOf(ref));
        expect(local.writeFrame!.rounds, questId).toHaveLength(2);
        for (const round of local.writeFrame!.rounds) {
          const where = `${questId} ${round.id}`;
          const one = { ...local, rounds: 1, writeFrame: { rounds: [round] } };
          const r = await mount(<WriteFrameGame scope={one} host={host} />);
          const texts = screenTexts(r.root).join(' ');
          for (const word of round.slots[0]!.bank) expect(texts, `${where} ${word.ko}`).toContain(word.ko);
          expect(texts, where).toContain(pillOf(locale));
          expect(skips(r), where).toBe(0);
          // After the pick (typing on the keyboard, or the next slot's bank): still no Skip.
          const first = byTestId(r.root, 'write-frame-word-0').find((n) => typeof n.props.onClick === 'function');
          await press(first!);
          expect(skips(r), `${where} after the pick`).toBe(0);
        }
      }
    }, 120_000);
  }
});

describe('each Stage 7 Cloze Pick Check through its step door (row CM-3A S7, the CM-30 switch rules)', () => {
  const clozeChecks = checks.filter((c) => c.scope.kind === 'cloze-pick');
  async function door(scope: MinigameScope): Promise<{ r: ReactTestRenderer; rendered: ClozePickRendered[] }> {
    const rendered: ClozePickRendered[] = [];
    const r = await mount(<ClozePickStep scope={scope} host={host} onRendered={(k) => rendered.push(k)} />);
    return { r, rendered };
  }

  it('with game.cloze-pick off, every Check plays its Listen & Pick fallback at once, with the Check pill and no Skip', async () => {
    flag.value = false;
    expect(clozeChecks).toHaveLength(9);
    for (const { questId, scope } of clozeChecks) {
      const { r, rendered } = await door(scope);
      expect(rendered, questId).toEqual(['listen-pick']);
      expect(byTestId(r.root, 'listen-pick-text-prompt').length, questId).toBeGreaterThan(0);
      expect(screenTexts(r.root), questId).toContain(pillOf('en'));
      expect(skips(r), questId).toBe(0);
    }
  });

  it('with game.cloze-pick never decided, every Check waits, then plays its fallback after the deadline', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      flag.value = null;
      for (const { questId, scope } of clozeChecks) {
        const { r, rendered } = await door(scope);
        expect(byTestId(r.root, 'lesson-waiting').length, `${questId} before`).toBeGreaterThan(0);
        expect(rendered, `${questId} before`).toEqual([]);
        await act(async () => {
          vi.advanceTimersByTime(FLAG_DECIDE_TIMEOUT_MS);
        });
        expect(byTestId(r.root, 'lesson-waiting'), `${questId} after`).toHaveLength(0);
        expect(rendered, `${questId} after`).toEqual(['listen-pick']);
        expect(byTestId(r.root, 'listen-pick-text-prompt').length, `${questId} after`).toBeGreaterThan(0);
        expect(skips(r), `${questId} after`).toBe(0);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
