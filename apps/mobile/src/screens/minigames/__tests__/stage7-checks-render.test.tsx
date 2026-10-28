import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import type { UiLocale } from '@hangul-route/i18n';
import { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { questsAll } from '../../../content';
import { LESSON_STAGE_MODULES } from '../../../content/__tests__/helpers/lesson-stages';
import { localizeScope } from '../../../logic/content-locale';
import { tileId } from '../../../logic/cloze-pick/round';
import { scopeFor, type MinigameScope } from '../../../logic/minigame-config';
import { byTestId, hostNodes, press, render, screenTexts, unmount } from '../../../test-support/render';
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
 * switch with a fallback, so no switch leaves a Stage 7 Check unplayable.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  playPrompt: vi.fn(() => Promise.resolve('played' as const)),
  stop: vi.fn(),
  hasClip: vi.fn(() => false),
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => true }));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({ ...(await importOriginal<object>()), track: vi.fn(async () => undefined) }));

const host: MinigameHost = { mode: 'check', answer: () => undefined, complete: () => undefined };
/** No game draws a Skip in the Check (any `*-skip` test id). */
const skips = (r: ReactTestRenderer): number => hostNodes(r.root, (n) => typeof n.props['data-testid'] === 'string' && n.props['data-testid'].endsWith('-skip')).length;
const LOCALES: readonly UiLocale[] = ['en', 'es', 'ko'];
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
  it('reaches all 15 Stage 7 Checks: 5 Cloze Pick, 5 Write Frame, 5 Sentence Builder', () => {
    expect(checks).toHaveLength(15);
    const kinds = checks.map((c) => c.scope.kind).sort();
    expect(kinds.filter((k) => k === 'cloze-pick')).toHaveLength(5);
    expect(kinds.filter((k) => k === 'write-frame')).toHaveLength(5);
    expect(kinds.filter((k) => k === 'order-it')).toHaveLength(5);
  });

  for (const locale of LOCALES) {
    it(`${locale}: each Cloze Pick Check draws the game when on and the Listen & Pick fallback on the same tiles when off`, async () => {
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
          // The meaning shown is the UI language's gloss of the sentence, never the English in es or ko.
          if (locale !== 'en') expect(screenTexts(off.root).join(' '), where).not.toContain(scope.clozePick!.rounds[i]!.sentence.en);
        }
      }
    }, 60_000);

    it(`${locale}: each round of each Write Frame Check draws its frame, its word bank and the Check header, with no Skip before or after the pick`, async () => {
      for (const { questId, ref, scope } of checks.filter((c) => c.scope.kind === 'write-frame')) {
        const local = localizeScope(scope, ref, locale, overlaysOf(ref));
        expect(local.writeFrame!.rounds, questId).toHaveLength(2);
        for (const round of local.writeFrame!.rounds) {
          const where = `${questId} ${round.id}`;
          const one = { ...local, rounds: 1, writeFrame: { rounds: [round] } };
          const r = await mount(<WriteFrameGame scope={one} host={host} />);
          const texts = screenTexts(r.root).join(' ');
          for (const word of round.slots[0]!.bank) expect(texts, `${where} ${word.ko}`).toContain(word.ko);
          expect(texts, where).toContain('Quick check');
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
