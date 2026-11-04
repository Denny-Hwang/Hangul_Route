/*
 * BL-D glyphs, drawn on the Icon grid (24 x 24, round caps and joins, outline width 2.2; glyphs.ts rules).
 * `class` is NEW (proposed for BL-7 to add to packages/design-system/src/components/Icon/glyphs.ts): a board on
 * an easel, two outline parts. `replay` and `lock` are copied from glyphs.ts on main. Colour is currentColor,
 * so the glyph takes the token colour of the text it sits in.
 */
window.RB_GLYPHS = {
  class: [['stroke', 'M4 4.5 H20 V14.5 H4 Z', 2.2], ['stroke', 'M8 19.5 L12 14.5 L16 19.5', 2.2], ['stroke', 'M7.5 9.5 H13', 2.2]],
  replay: [['stroke', 'M19.5 12 A7.5 7.5 0 1 1 12 4.5', 2.2], ['fill', 'M12 1 L17 4.5 L12 8 Z']],
  lock: [['stroke', 'M8.5 11 V8 A3.5 3.5 0 0 1 15.5 8 V11', 2.2], ['fill', 'M7.5 11 H16.5 Q18 11 18 12.5 V18.5 Q18 20 16.5 20 H7.5 Q6 20 6 18.5 V12.5 Q6 11 7.5 11 Z']],
  check: [['stroke', 'M5 12.5 L10 17.5 L19 6.5', 2.6]],
};
window.glyph = (name, size = 16) =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${window.RB_GLYPHS[name]
    .map(([kind, d, w]) => kind === 'fill'
      ? `<path d="${d}" style="fill: currentColor"/>`
      : `<path d="${d}" style="fill: none; stroke: currentColor; stroke-width: ${w}; stroke-linecap: round; stroke-linejoin: round"/>`)
    .join('')}</svg>`;
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-glyph]').forEach((el) => { el.outerHTML = window.glyph(el.dataset.glyph, Number(el.dataset.size ?? 16)); });
}, { once: true });
