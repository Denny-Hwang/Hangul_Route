import type { UiLocale } from './locales';

/**
 * A whole number from 0 to 999 written out in words, as a reader of the UI language says it ([FN]
 * AMENDMENTS-FINISH-2026-11 FN-1: the check before a new PIN). Hand-rolled: the platform has no spell-out format.
 * en: US style, no "and" ("three hundred forty-seven"); es: neutral ("trescientos cuarenta y siete", "cien",
 * "ciento uno"); ko: Sino-Korean in Hangul, no 일 before 십 or 백 ("삼백사십칠"). Throws a RangeError outside 0 to 999.
 */
export function numberInWords(locale: UiLocale, n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999) throw new RangeError(`numberInWords: ${n} is not a whole number from 0 to 999`);
  if (locale === 'ko') return korean(n);
  return locale === 'es' ? spanish(n) : english(n);
}

const EN_SMALL = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
] as const;
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const;

function englishBelow100(n: number): string {
  if (n < 20) return EN_SMALL[n]!;
  const ones = n % 10;
  const tens = EN_TENS[Math.floor(n / 10)]!;
  return ones === 0 ? tens : `${tens}-${EN_SMALL[ones]!}`;
}

function english(n: number): string {
  if (n < 100) return englishBelow100(n);
  const rest = n % 100;
  const head = `${EN_SMALL[Math.floor(n / 100)]!} hundred`;
  return rest === 0 ? head : `${head} ${englishBelow100(rest)}`;
}

const ES_SMALL = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
  'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
] as const;
const ES_TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'] as const;
const ES_HUNDREDS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
] as const;

function spanishBelow100(n: number): string {
  if (n < 30) return ES_SMALL[n]!;
  const ones = n % 10;
  const tens = ES_TENS[Math.floor(n / 10)]!;
  return ones === 0 ? tens : `${tens} y ${ES_SMALL[ones]!}`;
}

function spanish(n: number): string {
  if (n < 100) return spanishBelow100(n);
  if (n === 100) return 'cien';
  const rest = n % 100;
  const head = ES_HUNDREDS[Math.floor(n / 100)]!;
  return rest === 0 ? head : `${head} ${spanishBelow100(rest)}`;
}

const KO_DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'] as const;

/** One place of a Sino-Korean number: nothing for 0, the unit alone for 1 (백, 십), else digit and unit. */
function koreanPlace(digit: number, unit: string): string {
  if (digit === 0) return '';
  return digit === 1 ? unit : `${KO_DIGITS[digit]!}${unit}`;
}

function korean(n: number): string {
  if (n === 0) return '영';
  return `${koreanPlace(Math.floor(n / 100), '백')}${koreanPlace(Math.floor(n / 10) % 10, '십')}${KO_DIGITS[n % 10]!}`;
}
