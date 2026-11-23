import { a11yRomanization, JAMO_SOUND_VALUES } from '@hangul-route/content-schema';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

/**
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD row SO-1b (owner decisions 2026-11-23), in the three UI languages
 * (F-I18N-001 §3.10: Spanish neutral; Korean plain nouns):
 * - OD-SO8: the presenter's stroke panel caption for a letter whose stroke order nobody has checked is "Letter shape";
 *   a taught letter keeps "Simplified stroke guide" (`strokeCaption`, unchanged).
 * - OD-SO10: `a11yRomanization` reads a slash between romanization alternatives (ㅇ "silent/ng") as the UI locale's
 *   word for "or" (`a11y.romanizationOr`); the English output is unchanged.
 */
const VALUES = {
  en: { shape: 'Letter shape', stroke: 'Simplified stroke guide', or: 'or', ieung: 'silent or ng', giyeok: 'g or k' },
  es: { shape: 'Forma de la letra', stroke: 'Guía de trazos simplificada', or: 'o', ieung: 'silent o ng', giyeok: 'g o k' },
  ko: { shape: '글자 모양', stroke: '간단한 획순 안내', or: '또는', ieung: 'silent 또는 ng', giyeok: 'g 또는 k' },
} as const;

describe('stroke-order standard SO-1b strings', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: the presenter captions, untaught and taught (OD-SO8)', (locale) => {
    const slide = getMessages(locale).learner.presenter.slide;
    expect(slide.shapeCaption).toBe(VALUES[locale].shape);
    expect(slide.strokeCaption).toBe(VALUES[locale].stroke);
    expect(slide.shapeCaption).not.toBe(slide.strokeCaption);
  });

  it.each(['en', 'es', 'ko'] as const)('%s: a11yRomanization joins alternatives with the locale word for "or" (OD-SO10)', (locale) => {
    const m = getMessages(locale);
    expect(m.a11y.romanizationOr).toBe(VALUES[locale].or);
    expect(a11yRomanization('silent/ng', m.a11y.romanizationOr)).toBe(VALUES[locale].ieung);
    expect(a11yRomanization('g/k', m.a11y.romanizationOr)).toBe(VALUES[locale].giyeok);
    expect(a11yRomanization('eo', m.a11y.romanizationOr)).toBe('eo');
    // The shape guide's label carries it: "silent o ng, guía de la forma."
    expect(m.a11y.minigame.strokeOrder.shape(a11yRomanization('silent/ng', m.a11y.romanizationOr))).toContain(VALUES[locale].ieung);
  });

  it('Spanish "o" never meets an alternative that starts with an o sound (Spanish would write "u")', () => {
    // The Spanish word is a plain "o"; before a word that starts with "o" or "ho" Spanish writes "u". No romanization
    // with a slash has such an alternative: neither a jamo sound value (g/k, d/t, r/l, b/p, silent/ng, kk/k, ss/t) nor
    // any romanization in content/ (particle pairs such as eul/reul, i/ga, ieyo/yeyo; ne/nye), so the plain word fits.
    const slashed = [...Object.values(JAMO_SOUND_VALUES).flat(), ...contentRomanizations()].filter((value) => value.includes('/'));
    expect(slashed.length).toBeGreaterThan(20);
    for (const value of slashed) {
      expect(value.split('/').slice(1).some((alt) => /^\s*h?o/i.test(alt)), value).toBe(false);
    }
  });
});

/** Every `romanization` string in the JSON under content/ (episodes, stories, vocab, placement, weekly, fixtures). */
function contentRomanizations(): string[] {
  const root = fileURLToPath(new URL('../../../../content', import.meta.url));
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.json')) {
        for (const match of readFileSync(path, 'utf8').matchAll(/"romanization"\s*:\s*"([^"]*)"/g)) out.push(match[1]!);
      }
    }
  };
  walk(root);
  return out;
}
