import { describe, expect, it } from 'vitest';
import { WCAG_AAA_NORMAL, WCAG_AA_LARGE, WCAG_AA_NORMAL, compositeOver, contrastRatio, relativeLuminance } from '../contrast';
import presenterDoc from '../../../../design/tokens/presenter.v1.md?raw';
import { HOYA_VARIANTS, colors, hoyaVariantColors, presenter } from '../tokens';

describe('contrastRatio (WCAG 2.x)', () => {
  it('spans 1:1 to 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('is symmetric in its arguments', () => {
    expect(contrastRatio('#2A1F14', '#FCF8F1')).toBe(contrastRatio('#FCF8F1', '#2A1F14'));
  });

  it('matches the published reference values', () => {
    // WebAIM checker: #767676 on white is the classic 4.54:1 grey.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
    expect(relativeLuminance('#FFFFFF')).toBe(1);
    expect(relativeLuminance('#000000')).toBe(0);
  });

  it('accepts lowercase hex and rejects anything that is not #RRGGBB', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(() => relativeLuminance('#FFF')).toThrow(/#RRGGBB/);
    expect(() => relativeLuminance('rgba(0,0,0,0.4)')).toThrow(/#RRGGBB/);
  });
});

describe('compositeOver (an opacity-dimmed colour as it lands on its background)', () => {
  it('returns the foreground at full opacity and the background at zero', () => {
    expect(compositeOver('#2A1F14', '#FFFFFF', 1)).toBe('#2A1F14');
    expect(compositeOver('#2A1F14', '#FFFFFF', 0)).toBe('#FFFFFF');
  });

  it('blends each channel in sRGB the way a browser draws `opacity`', () => {
    expect(compositeOver('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(compositeOver('#2a1f14', '#ffffff', 0.8)).toBe('#554C43');
  });

  it('rejects an alpha outside 0..1 and a colour that is not #RRGGBB', () => {
    expect(() => compositeOver('#000000', '#FFFFFF', 1.2)).toThrow(/alpha/);
    expect(() => compositeOver('#000000', '#FFFFFF', Number.NaN)).toThrow(/alpha/);
    expect(() => compositeOver('#000', '#FFFFFF', 0.5)).toThrow(/#RRGGBB/);
  });
});

/**
 * UX-10 contract: every text/fill pairing the components actually render
 * meets WCAG AA. A token change that breaks one of these fails CI here.
 */
describe('token contrast contract (WCAG AA)', () => {
  const surfaces = {
    'surface.canvas': colors.surface.canvas,
    'surface.paper': colors.surface.paper,
    'surface.sunken': colors.surface.sunken,
  } as const;
  // HoyaBubble tones: idle (paper) / cheering (successLight) / thinking (nudgeLight).
  const bubbles = {
    'surface.paper': colors.surface.paper,
    'feedback.successLight': colors.feedback.successLight,
    'feedback.nudgeLight': colors.feedback.nudgeLight,
  } as const;

  const normalText: Array<[string, string, string]> = [
    // Button fills — label on resting and pressed fill.
    ['text.onPrimary on brand.primary', colors.text.onPrimary, colors.brand.primary],
    ['text.onPrimary on brand.primaryDark', colors.text.onPrimary, colors.brand.primaryDark],
    ['text.onSecondary on brand.secondary', colors.text.onSecondary, colors.brand.secondary],
    ['text.onSecondary on brand.secondaryDark', colors.text.onSecondary, colors.brand.secondaryDark],
    ['text.inverse on feedback.success', colors.text.inverse, colors.feedback.success],
    ['text.inverse on feedback.successDark', colors.text.inverse, colors.feedback.successDark],
    ['text.primary on feedback.nudge', colors.text.primary, colors.feedback.nudge],
    // Pill labels on their tints.
    ['brand.primaryDark on brand.primaryLight', colors.brand.primaryDark, colors.brand.primaryLight],
    ['brand.secondaryDark on brand.secondaryLight', colors.brand.secondaryDark, colors.brand.secondaryLight],
  ];
  // Ghost buttons, brand-tone headings, captions and tab labels sit on every surface.
  for (const [name, bg] of Object.entries(surfaces)) {
    normalText.push([`brand.primary (ghost / brand text) on ${name}`, colors.brand.primary, bg]);
    normalText.push([`text.primary on ${name}`, colors.text.primary, bg]);
    normalText.push([`text.secondary on ${name}`, colors.text.secondary, bg]);
    normalText.push([`text.muted on ${name}`, colors.text.muted, bg]);
  }
  for (const [name, bg] of Object.entries(bubbles)) {
    normalText.push([`text.primary (bubble Korean) on ${name}`, colors.text.primary, bg]);
    normalText.push([`text.secondary (bubble romanization) on ${name}`, colors.text.secondary, bg]);
  }
  // KoreanText (F-I18N-001 §3.5): Hangul sits on the sky-blue target chip.
  normalText.push(['text.primary (KoreanText Hangul) on brand.secondaryLight', colors.text.primary, colors.brand.secondaryLight]);
  // ChoiceCard (F-STORY-003 PR 3.3): option text on every state fill, and the wrong-state mark.
  normalText.push(['text.primary (ChoiceCard idle) on surface.paper', colors.text.primary, colors.surface.paper]);
  normalText.push(['text.primary (ChoiceCard correct) on feedback.successLight', colors.text.primary, colors.feedback.successLight]);
  normalText.push(['text.primary (ChoiceCard wrong + mark) on feedback.nudgeLight', colors.text.primary, colors.feedback.nudgeLight]);
  normalText.push(['text.primary (ChoiceCard disabled) on surface.sunken', colors.text.primary, colors.surface.sunken]);
  normalText.push(['text.secondary (KoreanText gloss in ChoiceCard) on feedback.successLight', colors.text.secondary, colors.feedback.successLight]);
  normalText.push(['text.secondary (KoreanText gloss in ChoiceCard) on feedback.nudgeLight', colors.text.secondary, colors.feedback.nudgeLight]);
  // RealiaSheet (F-CURR-001 G-2): trail-board romanization on amber paper, a found line's text on successLight.
  normalText.push(['text.secondary (RealiaSheet trail-board romanization) on feedback.nudgeLight', colors.text.secondary, colors.feedback.nudgeLight]);
  normalText.push(['text.primary (RealiaSheet found line) on feedback.successLight', colors.text.primary, colors.feedback.successLight]);
  normalText.push(['text.secondary (RealiaSheet found romanization) on feedback.successLight', colors.text.secondary, colors.feedback.successLight]);
  // Muted captions also sit inside brand cards (Card tone="brand").
  normalText.push(['text.muted on brand.primaryLight', colors.text.muted, colors.brand.primaryLight]);

  it.each(normalText)('%s ≥ 4.5:1', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
  });

  // Pressed ghost button: Button swaps its label to primaryDark on the primaryLight fill.
  it('pressed ghost label (brand.primaryDark on brand.primaryLight) ≥ 4.5:1, resting brand.primary there is not', () => {
    expect(contrastRatio(colors.brand.primaryDark, colors.brand.primaryLight)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    expect(contrastRatio(colors.brand.primary, colors.brand.primaryLight)).toBeLessThan(WCAG_AA_NORMAL);
  });

  // Large glyphs on a theme-coloured card tile (CardDetail 80px, Results 28px bold) use text.primary.
  it.each(Object.entries(colors.theme))('text.primary on theme.%s tile ≥ 3:1 (large text)', (_key, fill) => {
    expect(contrastRatio(colors.text.primary, fill)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  // Stage tints are accents only (stage1-4 are 2.3-3.0:1 as text on canvas); a label on a stage fill is text.primary.
  it.each(Object.entries(colors.stage))('text.primary on stage.%s fill ≥ 3:1 (large text)', (_key, fill) => {
    expect(contrastRatio(colors.text.primary, fill)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  // The focus ring is a UI graphic: 3:1 against every surface it can sit on.
  it.each(Object.entries(surfaces))('border.focus on %s ≥ 3:1 (non-text)', (_name, bg) => {
    expect(contrastRatio(colors.border.focus, bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  // F-ROUTE-001 R-2b: pip outlines, the dotted trail connector and the cursor / start
  // markers are UI graphics: 3:1 on every surface (and on the brand tint of a hero card).
  it.each([...Object.entries(surfaces), ['brand.primaryLight', colors.brand.primaryLight] as const])(
    'border.shape on %s ≥ 3:1 (non-text)',
    (_name, bg) => {
      expect(contrastRatio(colors.border.shape, bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    },
  );

  // The cursor triangle and the start pin are drawn in text.primary on whatever surface the row
  // sits on; the start pin's paper dot sits on the text.primary drop.
  it.each([...Object.entries(surfaces), ['brand.primaryLight', colors.brand.primaryLight] as const])(
    'PipRow markers (text.primary) on %s ≥ 3:1 (non-text)',
    (_name, bg) => {
      expect(contrastRatio(colors.text.primary, bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    },
  );

  it('the start pin dot (surface.paper) on its text.primary drop ≥ 3:1 (non-text)', () => {
    expect(contrastRatio(colors.surface.paper, colors.text.primary)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  // border.strong stays a quiet divider: it is NOT a 3:1 graphic, which is why the pips need border.shape.
  it('border.strong on paper < 3:1, so pips and the connector use border.shape', () => {
    expect(contrastRatio(colors.border.strong, colors.surface.paper)).toBeLessThan(WCAG_AA_LARGE);
  });

  // KoreanText target chip border and speaker icon are UI graphics: 3:1 on the surfaces they sit on.
  it.each(Object.entries(surfaces))('KoreanText chip border (brand.secondary) on %s ≥ 3:1 (non-text)', (_name, bg) => {
    expect(contrastRatio(colors.brand.secondary, bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  it.each(Object.entries(surfaces))('KoreanText speaker icon (brand.secondaryDark) on %s ≥ 3:1 (non-text)', (_name, bg) => {
    expect(contrastRatio(colors.brand.secondaryDark, bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  // ChoiceCard non-text cues (WCAG 1.4.11): the correct check on its tint, and the hint ring on the surfaces a card sits on.
  it('ChoiceCard correct check mark (feedback.success) on feedback.successLight ≥ 3:1 (non-text)', () => {
    expect(contrastRatio(colors.feedback.success, colors.feedback.successLight)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  // The amber nudge border alone is under 3:1 on paper (1.86:1), which is why the wrong state also carries a mark.
  it('ChoiceCard wrong state cannot rely on the amber border alone: nudge on paper < 3:1, so the mark is required', () => {
    expect(contrastRatio(colors.feedback.nudge, colors.surface.paper)).toBeLessThan(WCAG_AA_LARGE);
  });

  // SparkMeter (F-VOC-004 S-4): a lit spark is a non-text cue on the header surfaces and on the full-meter backdrop.
  it.each([
    ['surface.canvas', colors.surface.canvas],
    ['surface.paper', colors.surface.paper],
    ['brand.primaryLight', colors.brand.primaryLight],
  ])('SparkMeter lit spark (brand.primary) on %s ≥ 3:1 (non-text)', (_name, bg) => {
    expect(contrastRatio(colors.brand.primary, bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  // hoya.furDark replaces the Tile literal elsewhere; on the nudge tint it is under 3:1, so ChoiceCard does not use it there.
  it('hoya.furDark reads on surface.paper (≥ 3:1) but not on feedback.nudgeLight (< 3:1)', () => {
    expect(contrastRatio(colors.hoya.furDark, colors.surface.paper)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    expect(contrastRatio(colors.hoya.furDark, colors.feedback.nudgeLight)).toBeLessThan(WCAG_AA_LARGE);
  });

  it('a correct tile label (large text) reads on its success tint', () => {
    expect(contrastRatio(colors.feedback.success, colors.feedback.successLight)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  it('pressed fills stay darker than resting fills (visible press feedback)', () => {
    expect(relativeLuminance(colors.brand.primaryDark)).toBeLessThan(relativeLuminance(colors.brand.primary));
    expect(relativeLuminance(colors.brand.secondaryDark)).toBeLessThan(relativeLuminance(colors.brand.secondary));
    expect(relativeLuminance(colors.feedback.successDark)).toBeLessThan(relativeLuminance(colors.feedback.success));
  });

  it('keeps the text hierarchy: muted is lighter than secondary, secondary lighter than primary', () => {
    expect(relativeLuminance(colors.text.muted)).toBeGreaterThan(relativeLuminance(colors.text.secondary));
    expect(relativeLuminance(colors.text.secondary)).toBeGreaterThan(relativeLuminance(colors.text.primary));
  });
});

/**
 * F-LEARN-001 §3.6 — Hoya fur variants. The fur is a fill, not text, so the bar
 * is the 3:1 non-text minimum (WCAG 1.4.11): the stripes and eyes must read on
 * the fur, and the shade used for the avatar ring / chip must read on every
 * surface the cub sits on. Colour is never the only cue (the English label
 * names the cub), and the five variants are checked for colour-blind
 * distinctness in design review.
 */
describe('Hoya fur variant contrast (non-text, WCAG 1.4.11)', () => {
  const surfaces = {
    'surface.paper': colors.surface.paper,
    'surface.canvas': colors.surface.canvas,
  } as const;

  it.each(HOYA_VARIANTS)('%s fur against hoya.stripes ≥ 3:1', (variant) => {
    expect(contrastRatio(hoyaVariantColors(variant).fur, colors.hoya.stripes)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  for (const [name, bg] of Object.entries(surfaces)) {
    // The ring and the chip use the shade, so every variant (orange included) is held to it.
    it.each(HOYA_VARIANTS)(`%s ring shade (furDark) against ${name} ≥ 3:1`, (variant) => {
      expect(contrastRatio(hoyaVariantColors(variant).furDark, bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    });
    // The four new tints are chosen to clear it as a fill too (gold orange is
    // the existing brand cub and cannot: it is 1.8:1 on canvas, so it uses its shade).
    it.each(HOYA_VARIANTS.filter((v) => v !== 'orange'))(`%s fur fill against ${name} ≥ 3:1`, (variant) => {
      expect(contrastRatio(hoyaVariantColors(variant).fur, bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    });
  }

  it.each(HOYA_VARIANTS)('%s shade is darker than its fur (the shading shows)', (variant) => {
    const { fur, furDark } = hoyaVariantColors(variant);
    expect(relativeLuminance(furDark)).toBeLessThan(relativeLuminance(fur));
  });

  it('the ring shade also reads on surface.sunken for the four new tints', () => {
    for (const variant of HOYA_VARIANTS.filter((v) => v !== 'orange')) {
      expect(contrastRatio(hoyaVariantColors(variant).furDark, colors.surface.sunken)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    }
  });
});

/**
 * F-TCH-004 §3.6 — the lecture presenter projects existing colour tokens, so
 * it adds no colours; design/tokens/presenter.v1.md lists every colour pair the
 * presenter may draw. Projected text is read from the back of a classroom
 * through a washed-out projector, so the bar is 7:1 (WCAG AAA) for text, and
 * 3:1 for non-text cues (quiz shape markers, the correct-option border and
 * check, the timer ring, the focus ring). The pairs are read from the doc so a
 * new pair cannot ship without passing here.
 */
describe('presenter projected colour pairs (F-TCH-004 §3.6)', () => {
  type Kind = 'text' | 'text-dimmed' | 'non-text';
  const resolve = (path: string): string => {
    const [group, key] = path.split('.') as [string, string];
    const value = (colors as unknown as Record<string, Record<string, string> | undefined>)[group]?.[key];
    if (value === undefined) throw new Error(`presenter.v1.md names an unknown colour token: ${path}`);
    return value;
  };
  // A `text-dimmed` row is drawn at presenter.dimOpacity, so it is checked as it lands on its background.
  const pairs: Array<[string, Kind, string, string]> = [];
  for (const m of presenterDoc.matchAll(/^\|\s*(text|text-dimmed|non-text)\s*\|\s*`([a-zA-Z]+\.[a-zA-Z0-9]+)`\s*\|\s*`([a-zA-Z]+\.[a-zA-Z0-9]+)`\s*\|\s*([^|]+?)\s*\|/gm)) {
    const kind = m[1] as Kind;
    const bg = resolve(m[3]!);
    const fg = kind === 'text-dimmed' ? compositeOver(resolve(m[2]!), bg, presenter.dimOpacity) : resolve(m[2]!);
    pairs.push([`${m[2]} on ${m[3]} (${m[4]})`, kind, fg, bg]);
  }
  // Every data row of the pair table, whatever its format, so a row the pattern above cannot read fails here.
  const tableRows = (() => {
    const section = presenterDoc.split(/^## Projected colour pairs$/m)[1]?.split(/^## /m)[0] ?? '';
    return section
      .split('\n')
      .filter((line) => line.startsWith('|'))
      .filter((line) => !/^\|\s*Kind\s*\|/.test(line) && !/^\|[-|\s]+\|$/.test(line));
  })();
  const isText = (kind: Kind): boolean => kind !== 'non-text';

  it('reads every row of the pair table (guards the parser itself)', () => {
    expect(tableRows.length).toBeGreaterThan(0);
    expect(pairs.length).toBe(tableRows.length);
    expect(pairs.some(([, kind]) => kind === 'text-dimmed')).toBe(true);
  });

  it('projects on white paper with warm dark text (no cream canvas on a projector)', () => {
    expect(pairs.some(([name]) => name.startsWith('text.primary on surface.paper'))).toBe(true);
    expect(pairs.some(([, , , bg]) => bg === colors.surface.canvas)).toBe(false);
  });

  it.each(pairs.filter(([, kind]) => isText(kind)))('%s ≥ 7:1 (text)', (_name, _kind, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AAA_NORMAL);
  });

  it.each(pairs.filter(([, kind]) => kind === 'non-text'))('%s ≥ 3:1 (non-text)', (_name, _kind, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
  });

  it('never projects the reserved danger colour (anti-shame quiz reveal)', () => {
    expect(pairs.some(([, , fg, bg]) => fg === colors.feedback.danger || bg === colors.feedback.danger)).toBe(false);
  });

  // Why some tempting pairs are not in the table: they miss the projected 7:1 bar.
  it('keeps text.muted, brand-fill labels and gloss-on-success off the projected stage (< 7:1)', () => {
    expect(contrastRatio(colors.text.muted, colors.surface.paper)).toBeLessThan(WCAG_AAA_NORMAL);
    expect(contrastRatio(colors.text.onPrimary, colors.brand.primary)).toBeLessThan(WCAG_AAA_NORMAL);
    expect(contrastRatio(colors.text.secondary, colors.feedback.successLight)).toBeLessThan(WCAG_AAA_NORMAL);
  });

  // The dim level is the one number PR 9 needs for the quiz reveal: text.primary stays ≥ 7:1 at it,
  // text.secondary would not (so a dimmed option sets every line in text.primary), and it still visibly dims.
  it('dims the non-correct quiz options enough to read as de-emphasised and no further than 7:1 allows', () => {
    const dimmedPrimary = compositeOver(colors.text.primary, colors.surface.paper, presenter.dimOpacity);
    const dimmedSecondary = compositeOver(colors.text.secondary, colors.surface.paper, presenter.dimOpacity);
    expect(contrastRatio(dimmedPrimary, colors.surface.paper)).toBeGreaterThanOrEqual(WCAG_AAA_NORMAL);
    expect(contrastRatio(dimmedSecondary, colors.surface.paper)).toBeLessThan(WCAG_AAA_NORMAL);
    expect(presenter.dimOpacity).toBeLessThan(1);
    expect(contrastRatio(dimmedPrimary, colors.surface.paper)).toBeLessThan(contrastRatio(colors.text.primary, colors.surface.paper) * 0.75);
  });
});
