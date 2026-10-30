import { describe, expect, it } from 'vitest';
import { REALIA_KIND_REGISTRY } from '../../../scene-art/realia-kinds-registry';
import { REALIA_REGISTRY } from '../../../scene-art/realia-registry';
import { borderWidth, colors, spacing, touchTarget } from '../../../tokens';
import {
  REALIA_ADDED_KINDS,
  REALIA_DAY_MIN_WIDTH,
  REALIA_EDGE_HEIGHT,
  REALIA_KIND_LOOKS,
  REALIA_MAP_HEIGHT,
  REALIA_PIN_SIZE,
  REALIA_RECEIPT_MAX_WIDTH,
  REALIA_TILE,
  isRealiaAddedKind,
  realiaRowRule,
} from '../kinds-style';
import { REALIA_CARD_MIN_WIDTH, REALIA_DRESSINGS, realiaBaseKind } from '../style';

/** design/screens/minigame-realia-read/README.md D9-D12 and "Constants" (row CM-47). */
describe('the CM-47 realia looks', () => {
  it('names the eight kinds in the schema order, and only those', () => {
    expect(REALIA_ADDED_KINDS).toEqual(['recipe', 'receipt', 'label', 'forecast', 'calendar', 'timetable', 'map', 'poster']);
    expect(Object.keys(REALIA_KIND_LOOKS)).toEqual([...REALIA_ADDED_KINDS]);
    for (const kind of REALIA_ADDED_KINDS) expect(isRealiaAddedKind(kind)).toBe(true);
    for (const kind of ['menu', 'ticket', 'sign', 'price-card', 'plain', 'brochure']) expect(isRealiaAddedKind(kind), kind).toBe(false);
  });

  it('RealiaSheet draws its own four kinds and the plain sheet for any other (a CM-47 kind before its chunk, an unknown one)', () => {
    for (const kind of ['menu', 'ticket', 'sign', 'price-card', 'plain'] as const) expect(realiaBaseKind(kind)).toBe(kind);
    for (const kind of REALIA_ADDED_KINDS) expect(realiaBaseKind(kind)).toBe('plain');
    expect(Object.keys(REALIA_DRESSINGS)).toEqual(['menu', 'ticket', 'sign', 'price-card', 'plain']);
  });

  it('one anatomy per kind, from the four shared shapes', () => {
    const anatomy = Object.fromEntries(REALIA_ADDED_KINDS.map((k) => [k, REALIA_KIND_LOOKS[k].anatomy]));
    expect(anatomy).toEqual({ recipe: 'rows', receipt: 'rows', label: 'rows', forecast: 'tiles', calendar: 'tiles', timetable: 'rows', map: 'legend', poster: 'poster' });
  });

  it('dresses every kind with a CM-47 prop, never a G-2 one, and every kind is dressed', () => {
    for (const kind of REALIA_ADDED_KINDS) {
      const look = REALIA_KIND_LOOKS[kind];
      const refs = [look.top?.ref, look.bottom?.ref].filter((r): r is string => r !== undefined);
      expect(refs.length, kind).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(REALIA_KIND_REGISTRY[ref], `${kind} ${ref}`).toBeDefined();
        expect(REALIA_REGISTRY[ref], `${kind} ${ref}`).toBeUndefined();
      }
    }
    // Every CM-47 prop dresses exactly one kind.
    const used = REALIA_ADDED_KINDS.flatMap((k) => [REALIA_KIND_LOOKS[k].top?.ref, REALIA_KIND_LOOKS[k].bottom?.ref]).filter(Boolean);
    expect(new Set(used)).toEqual(new Set(Object.keys(REALIA_KIND_REGISTRY)));
  });

  it('derives its constants from tokens', () => {
    expect(REALIA_RECEIPT_MAX_WIDTH).toBe(touchTarget.hero * 4);
    expect(REALIA_EDGE_HEIGHT).toBe(spacing.md);
    expect(REALIA_DAY_MIN_WIDTH).toBe(touchTarget.hero);
    expect(REALIA_MAP_HEIGHT).toBe(touchTarget.hero);
    expect(REALIA_PIN_SIZE).toBe(spacing.xl);
    expect(REALIA_KIND_LOOKS.forecast.tileMin).toBe(REALIA_CARD_MIN_WIDTH);
    expect(REALIA_KIND_LOOKS.calendar.tileMin).toBe(REALIA_DAY_MIN_WIDTH);
    expect(REALIA_KIND_LOOKS.receipt.maxWidth).toBe(REALIA_RECEIPT_MAX_WIDTH);
  });

  it('puts every line on white paper, or on the sky band of a forecast; never a reserved colour', () => {
    for (const kind of REALIA_ADDED_KINDS) {
      const look = REALIA_KIND_LOOKS[kind];
      const ground = look.anatomy === 'tiles' ? REALIA_TILE.backgroundColor : look.paper.backgroundColor;
      expect(ground, kind).toBe(colors.surface.paper);
      expect(JSON.stringify(look), kind).not.toContain(colors.feedback.danger);
      expect(JSON.stringify(look), kind).not.toContain(colors.brand.primary);
    }
    // A forecast's title sits on its sky board (text.primary and text.secondary on brand.secondaryLight: contrast.test.ts).
    expect(REALIA_KIND_LOOKS.forecast.paper.backgroundColor).toBe(colors.brand.secondaryLight);
  });

  it('draws the row rule between rows only, dashed on a receipt, none on a poster', () => {
    expect(realiaRowRule(REALIA_KIND_LOOKS.recipe, 0).borderTopWidth).toBe(0);
    expect(realiaRowRule(REALIA_KIND_LOOKS.recipe, 1)).toEqual({ borderTopWidth: borderWidth.thin, borderStyle: 'solid', borderColor: colors.border.strong });
    expect(realiaRowRule(REALIA_KIND_LOOKS.receipt, 2).borderStyle).toBe('dashed');
    expect(realiaRowRule(REALIA_KIND_LOOKS.poster, 3).borderTopWidth).toBe(0);
  });
});
