import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISMISS_LABEL,
  hoyaDismissLabel,
  starRowLabel,
} from '../labels';
import {
  KOREAN_LANGUAGE,
  KOREAN_TEXT_SIZES,
  koreanTextLabel,
  koreanTextView,
} from '../korean-text';
import { touchTarget, typography } from '../tokens';

describe('koreanTextLabel (screen reader label)', () => {
  it('uses the caller-supplied, already-localised label verbatim', () => {
    expect(koreanTextLabel('강아지', 'gangaji', 'Korean: 강아지, gangaji, puppy')).toBe(
      'Korean: 강아지, gangaji, puppy',
    );
    expect(koreanTextLabel('강아지', 'gangaji', '한글: 강아지, gangaji')).toBe('한글: 강아지, gangaji');
  });

  it('defaults to "ko, romanization" when the label is omitted', () => {
    expect(koreanTextLabel('강아지', 'gangaji')).toBe('강아지, gangaji');
  });

  it('treats an empty or blank label as omitted', () => {
    expect(koreanTextLabel('강아지', 'gangaji', '')).toBe('강아지, gangaji');
    expect(koreanTextLabel('강아지', 'gangaji', '   ')).toBe('강아지, gangaji');
  });

  it('falls back to the Hangul alone when there is no romanization', () => {
    expect(koreanTextLabel('강아지', '')).toBe('강아지');
  });
});

describe('koreanTextView (what the component draws)', () => {
  const base = { ko: '강아지', romanization: 'gangaji', gloss: 'puppy' } as const;

  it('shows chip, romanization and gloss by default (D2: romanization visible by default)', () => {
    const v = koreanTextView(base);
    expect(v.showRomanization).toBe(true);
    expect(v.showGloss).toBe(true);
    expect(v.label).toBe('강아지, gangaji');
  });

  it('romanizationShown wiring: only the romanization line goes, never the gloss', () => {
    const hidden = koreanTextView({ ...base, romanizationShown: false });
    expect(hidden.showRomanization).toBe(false);
    expect(hidden.showGloss).toBe(true);
    expect(koreanTextView({ ...base, romanizationShown: true }).showRomanization).toBe(true);
    expect(koreanTextView({ ...base, romanizationShown: undefined }).showRomanization).toBe(true);
  });

  it('draws no romanization line for an empty romanization, shown or not', () => {
    expect(koreanTextView({ ...base, romanization: '' }).showRomanization).toBe(false);
    expect(koreanTextView({ ...base, romanization: '  ' }).showRomanization).toBe(false);
  });

  it('draws no gloss line when the gloss is missing or blank', () => {
    expect(koreanTextView({ ko: '가', romanization: 'ga' }).showGloss).toBe(false);
    expect(koreanTextView({ ...base, gloss: '' }).showGloss).toBe(false);
    expect(koreanTextView({ ...base, gloss: '  ' }).showGloss).toBe(false);
  });

  it('shows the speaker affordance only when the item is pressable', () => {
    expect(koreanTextView(base).pressable).toBe(false);
    expect(koreanTextView(base).showSpeaker).toBe(false);
    const pressable = koreanTextView({ ...base, pressable: true });
    expect(pressable.pressable).toBe(true);
    expect(pressable.showSpeaker).toBe(true);
  });

  it('passes the caller label through the view model', () => {
    expect(koreanTextView({ ...base, accessibilityLabel: 'Korean: 강아지, gangaji, puppy' }).label).toBe(
      'Korean: 강아지, gangaji, puppy',
    );
  });

  it('defaults to the md size tier and resolves the others from tokens', () => {
    expect(koreanTextView(base).hangulSize).toBe(typography.size.display);
    expect(koreanTextView({ ...base, size: 'sm' }).hangulSize).toBe(typography.size.title);
    expect(koreanTextView({ ...base, size: 'lg' }).hangulSize).toBe(typography.size.hero);
  });
});

describe('KOREAN_TEXT_SIZES', () => {
  it('keeps every size at or above the 18 body floor and orders the tiers', () => {
    for (const tier of Object.values(KOREAN_TEXT_SIZES)) {
      expect(tier.hangul).toBeGreaterThanOrEqual(typography.size.body);
      expect(tier.romanization).toBeGreaterThanOrEqual(typography.size.bodySm);
    }
    expect(KOREAN_TEXT_SIZES.sm.hangul).toBeLessThan(KOREAN_TEXT_SIZES.md.hangul);
    expect(KOREAN_TEXT_SIZES.md.hangul).toBeLessThan(KOREAN_TEXT_SIZES.lg.hangul);
  });

  it('sizes the pressable target from the touchTarget floor', () => {
    expect(koreanTextView({ ko: '가', romanization: 'ga', pressable: true }).minTarget).toBe(touchTarget.min);
  });
});

describe('speech language', () => {
  it('is Korean (BCP 47 "ko") for iOS accessibilityLanguage and web lang', () => {
    expect(KOREAN_LANGUAGE).toBe('ko');
  });
});

describe('label props (StarRow, HoyaBubble)', () => {
  it('StarRow keeps the current English label when no override is passed', () => {
    expect(starRowLabel(0)).toBe('0 of 3 stars earned');
    expect(starRowLabel(2)).toBe('2 of 3 stars earned');
    expect(starRowLabel(3, undefined)).toBe('3 of 3 stars earned');
  });

  it('StarRow uses the caller label (m.a11y.stars(n)) when given', () => {
    expect(starRowLabel(2, '2 de 3 estrellas')).toBe('2 de 3 estrellas');
  });

  it('StarRow treats an empty override as omitted', () => {
    expect(starRowLabel(1, '')).toBe('1 of 3 stars earned');
  });

  it('HoyaBubble keeps "Close Hoya message" by default', () => {
    expect(DEFAULT_DISMISS_LABEL).toBe('Close Hoya message');
    expect(hoyaDismissLabel()).toBe('Close Hoya message');
    expect(hoyaDismissLabel('')).toBe('Close Hoya message');
  });

  it('HoyaBubble uses the caller dismissLabel when given', () => {
    expect(hoyaDismissLabel('Cerrar mensaje de Hoya')).toBe('Cerrar mensaje de Hoya');
  });
});
