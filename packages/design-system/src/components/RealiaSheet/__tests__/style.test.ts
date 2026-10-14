import { describe, expect, it } from 'vitest';
import { REALIA_REGISTRY } from '../../../scene-art/realia-registry';
import { borderWidth, colors, spacing, touchTarget } from '../../../tokens';
import {
  REALIA_BOTTOM_DRESSING,
  REALIA_DRESSINGS,
  REALIA_GOODS_HEIGHT,
  REALIA_STUB,
  REALIA_TOP_DRESSING,
  realiaGoodsRef,
  realiaLineLook,
  realiaPaper,
} from '../style';

/** design/screens/minigame-realia-read/README.md ("Constants", D4, D5, S11). */
describe('RealiaSheet looks', () => {
  it('derives its constants from tokens (40 / 32 / 56)', () => {
    expect(REALIA_TOP_DRESSING).toBe(40);
    expect(REALIA_BOTTOM_DRESSING).toBe(spacing.xxl);
    expect(REALIA_GOODS_HEIGHT).toBe(touchTarget.min - spacing.sm);
  });

  it('dresses each kind with registered realia props; the plain sheet has none', () => {
    const refs = [...Object.values(REALIA_DRESSINGS).flatMap((d) => [d.top, d.bottom]), REALIA_STUB, ...(['apples', 'fan', 'hanji'] as const).map(realiaGoodsRef)].filter(
      (r): r is string => r !== undefined,
    );
    for (const ref of refs) expect(REALIA_REGISTRY[ref], ref).toBeDefined();
    expect(REALIA_DRESSINGS.plain).toEqual({});
  });

  it('found: green fill and ring with a check; look here: a dashed focus ring with a pointer; none: no mark', () => {
    expect(realiaLineLook('found')).toMatchObject({ borderColor: colors.feedback.success, borderStyle: 'solid', icon: { name: 'check' } });
    expect(realiaLineLook('lookHere')).toMatchObject({ borderColor: colors.border.focus, borderStyle: 'dashed', icon: { name: 'arrow-right' } });
    expect(realiaLineLook('none')).toMatchObject({ backgroundColor: undefined, icon: null });
    // Every state keeps the same border width, so a mark never moves the text.
    expect(new Set((['none', 'found', 'lookHere'] as const).map((m) => realiaLineLook(m).borderWidth))).toEqual(new Set([borderWidth.thick]));
  });

  it('never paints a realia line in the reserved red', () => {
    for (const mark of ['none', 'found', 'lookHere'] as const) {
      expect(JSON.stringify(realiaLineLook(mark))).not.toContain(colors.feedback.danger);
    }
  });

  it('puts trail boards on amber paper and the rest on white paper', () => {
    expect(realiaPaper('sign').backgroundColor).toBe(colors.feedback.nudgeLight);
    expect(realiaPaper('menu').backgroundColor).toBe(colors.surface.paper);
    expect(realiaPaper('plain').borderColor).toBe(colors.border.shape);
  });
});
