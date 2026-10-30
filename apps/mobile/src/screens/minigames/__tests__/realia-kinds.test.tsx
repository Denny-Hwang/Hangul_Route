import { RealiaSheet, touchTarget } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';
import { RomanizationModeOverride } from '../../../i18n/use-romanization-mode';
import { lineBaseLabel, sheetSummary } from '../../../logic/realia-read-flow';
import { REALIA_FIXTURES } from '../../../navigation/realia-read-e2e-fixture';
import { REALIA_KIND_FIXTURES } from '../../../navigation/realia-kinds-e2e-fixture';
import { cleanup, render } from '../../../test-support/render';
import { ClozeRealia } from '../ClozeRealia';
import type { MinigameHost } from '../host';
import { RealiaReadGame } from '../RealiaReadGame';
import { RealiaSheetView } from '../realia-kinds-entry';

/**
 * F-CURR-002 row CM-47: the eight added realia layouts in the learner's renderers (Realia Read and Cloze Pick's realia
 * card, through the start bundle's door `RealiaSheetView` and its lazy chunk), design/screens/minigame-realia-read/
 * D9-D12. Each kind draws its own layout, names its group "<kind>, n lines", keeps every line a button with the line's
 * full name at least `touchTarget.min` tall, hides its dressing, fits a 320 px column, and marks the answer line found.
 */

// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const ADDED = ['recipe', 'receipt', 'label', 'forecast', 'calendar', 'timetable', 'map', 'poster'] as const;
const a11y = getMessages('en').a11y.minigame;
const host: MinigameHost = { mode: 'quest', answer: () => undefined, complete: () => undefined };
type Node = ReactTestInstance;

const byTestId = (root: Node, id: string): Node[] => root.findAll((n) => typeof n.type !== 'string' && n.props.testID === id);
/** The outermost composite with this testID that carries `prop` (the Pressable of a line, the View of the group). */
const carrying = (root: Node, id: string, prop: string): Node | undefined => byTestId(root, id).find((n) => n.props[prop] !== undefined);
const flat = (style: unknown): Record<string, unknown> =>
  Array.isArray(style) ? Object.assign({}, ...style.map(flat)) : typeof style === 'object' && style !== null ? (style as Record<string, unknown>) : {};

/** Lets the door's `import()` of the realia kinds chunk resolve and re-render. */
async function chunkIn(): Promise<void> {
  await act(async () => {
    await import('../realia-kinds-chunk');
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function play(kind: (typeof ADDED)[number]): Promise<ReactTestRenderer> {
  const r = await render(
    <RomanizationModeOverride mode="always">
      <RealiaReadGame scope={REALIA_KIND_FIXTURES[kind]} host={host} />
    </RomanizationModeOverride>,
  );
  await chunkIn();
  return r;
}

afterEach(async () => {
  await cleanup();
});

describe('the door: a CM-47 sheet is the plain sheet until its chunk is in, a G-2 sheet never asks for it', () => {
  // First in the file: the chunk is not loaded yet in this module graph.
  it('first draws a timetable as the plain sheet, with the same line buttons and the same group name', () => {
    const realia = REALIA_KIND_FIXTURES.timetable.realiaRead.realia;
    const props = {
      kind: 'timetable' as const,
      lines: realia.entries.map((e) => ({ id: e.id, text: { ko: e.text.ko, romanization: e.text.romanization }, mark: 'none' as const, accessibilityLabel: lineBaseLabel(e, a11y) })),
      accessibilityLabel: sheetSummary(realia, a11y),
      lineHint: a11y.realia.lineHint,
      testID: 'door',
    };
    let r!: ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<RealiaSheetView {...props} />);
    });
    expect(r.root.findAllByType(RealiaSheet)).toHaveLength(1);
    expect(byTestId(r.root, 'door-kind-timetable')).toHaveLength(0);
    expect(carrying(r.root, 'door-line-busan', 'accessibilityRole')?.props.accessibilityLabel).toBe('부산, busan, 두 시, du si');
    expect(carrying(r.root, 'door', 'role')?.props.accessibilityLabel).toBe('Timetable, 3 lines');
    act(() => r.unmount());
  });

  it('a menu stays the start bundle sheet', async () => {
    const r = await render(<RealiaReadGame scope={REALIA_FIXTURES.menu} host={host} />);
    await chunkIn();
    expect(r.root.findAllByType(RealiaSheet)).toHaveLength(1);
    expect(r.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('realia-read-sheet-kind-'))).toHaveLength(0);
  });
});

describe.each(ADDED)('Realia Read on a %s (row CM-47)', (kind) => {
  const realia = REALIA_KIND_FIXTURES[kind].realiaRead.realia;

  it('draws its own layout, named as a group with its line count', async () => {
    const r = await play(kind);
    expect(byTestId(r.root, `realia-read-sheet-kind-${kind}`)).toHaveLength(1);
    const group = carrying(r.root, 'realia-read-sheet', 'role')!;
    expect(group.props.accessibilityLabel).toBe(`${a11y.realia.kind[kind]}, ${realia.entries.length} line${realia.entries.length === 1 ? '' : 's'}`);
    expect(group.props.role).toBe('group');
  });

  it('keeps every line a button with its full name, at least touchTarget.min (48 dp or more) tall', async () => {
    const r = await play(kind);
    expect(touchTarget.min).toBeGreaterThanOrEqual(48);
    for (const entry of realia.entries) {
      const line = carrying(r.root, `realia-read-sheet-line-${entry.id}`, 'accessibilityRole');
      expect(line, entry.id).toBeDefined();
      expect(line!.props.accessibilityRole).toBe('button');
      expect(line!.props.accessibilityLabel).toBe(lineBaseLabel(entry, a11y));
      expect(flat(line!.props.style).minHeight).toBeGreaterThanOrEqual(touchTarget.min);
    }
  });

  it('hides its dressing from assistive tech, and draws nothing wider than a 320 px column', async () => {
    const r = await play(kind);
    const sheet = byTestId(r.root, `realia-read-sheet-kind-${kind}`)[0]!;
    const svgs = sheet.findAll((n) => (n.type as unknown) === 'svg-Svg');
    expect(svgs.length, 'a dressing').toBeGreaterThan(0);
    for (const svg of svgs) {
      let node: Node | null = svg;
      let hiddenAbove = false;
      while (node && !hiddenAbove) {
        hiddenAbove = node.props['aria-hidden'] === true || node.props.accessibilityElementsHidden === true;
        node = node.parent;
      }
      expect(hiddenAbove).toBe(true);
    }
    // A 320 px phone leaves 288 px between the 16 px gutters: no fixed width or minimum width is wider (a receipt's
    // 384 is a maximum width, which a narrow column overrides).
    for (const n of sheet.findAll((x) => typeof x.type !== 'string' && x.props.style !== undefined)) {
      const style = flat(n.props.style);
      for (const key of ['width', 'minWidth', 'flexBasis'] as const) {
        if (typeof style[key] === 'number') expect(style[key] as number, `${key}`).toBeLessThanOrEqual(288);
      }
    }
  });

  it('marks the answer line found (with its gloss) on the right answer', async () => {
    const r = await play(kind);
    const round = REALIA_KIND_FIXTURES[kind].realiaRead.rounds[0]!;
    const option = carrying(r.root, `realia-read-option-${round.answerId}`, 'onPress')!;
    await act(async () => {
      (option.props.onPress as () => void)();
    });
    const line = carrying(r.root, `realia-read-sheet-line-${round.answerEntryId}`, 'accessibilityRole')!;
    expect(line.props.accessibilityLabel).toMatch(new RegExp(`${a11y.realia.found}$`));
  });
});

describe('Cloze Pick realia card on a CM-47 sheet', () => {
  it.each(['receipt', 'timetable'] as const)('the %s card draws its own layout through the same door', async (kind) => {
    const r = await render(<ClozeRealia realia={REALIA_KIND_FIXTURES[kind].realiaRead.realia} testID="cloze-realia" />);
    await chunkIn();
    expect(byTestId(r.root, `cloze-realia-kind-${kind}`)).toHaveLength(1);
    expect(carrying(r.root, 'cloze-realia', 'role')?.props.accessibilityLabel).toBe(`${a11y.realia.kind[kind]}, ${REALIA_KIND_FIXTURES[kind].realiaRead.realia.entries.length} lines`);
  });
});
