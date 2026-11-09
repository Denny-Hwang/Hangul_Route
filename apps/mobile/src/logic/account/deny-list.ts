import type { UiLocale } from '@hangul-route/i18n';

/**
 * F-AUTH-004 section 9.2 (row NS-2; CS-N5, CS-N10) and F-BILL-002 section 4.8: the words no native screen may show.
 * One module for both lists, so they grow together: the Plan screen's (moved here from `PaywallScreen.test.tsx`) and
 * the native grown-up screens' (the sign-in, the lock, the account card, the rows, the homes, the reports and every
 * state of each). The render tests scan the text tree and every `accessibilityLabel` and `accessibilityHint` with
 * these; names typed by grown-ups (a space or a school) are fixtures, never checked.
 */

/**
 * F-BILL-002 section 4.8 rule 1: no native string on the Plan screen mentions the web, a website or buying elsewhere.
 * Whole words in en and es, substrings in ko (`planScreenHasWord`).
 */
export const PLAN_SCREEN_DENY: Readonly<Record<UiLocale, readonly string[]>> = {
  en: ['web', 'website', 'browser', 'hangulroute.com', 'billing page', 'console'],
  es: ['web', 'sitio', 'navegador', 'hangulroute.com', 'página de facturación', 'consola'],
  ko: ['웹', '사이트', '브라우저', 'hangulroute.com', '결제 페이지', '콘솔'],
};

/** The Plan screen's match: whole-word in en and es, substring in ko (as the copy checks read words). */
export function planScreenHasWord(text: string, word: string, locale: UiLocale): boolean {
  const lower = text.toLowerCase();
  if (locale === 'ko') return lower.includes(word);
  return new RegExp(`(^|[^a-zà-ɏ])${word.replace(/\./g, '\\.')}([^a-zà-ɏ]|$)`).test(lower);
}

/**
 * Section 9.2: the native grown-up screens' words. en: whole words, any case (`card` is singular only: the account
 * screens never show heritage cards, and "cards" in a learner line is not a purchase word). es: word starts, any case
 * and any accent, so a stem (`suscrib`, `renov`, `gestion`) catches every form. ko: substrings (Korean attaches
 * particles to the word).
 */
export const ACCOUNT_DENY_WORDS: Readonly<Record<UiLocale, readonly string[]>> = {
  en: [
    'buy',
    'purchase',
    'price',
    'cost',
    'upgrade',
    'subscribe',
    'subscription',
    'renew',
    'manage',
    'trial',
    'refund',
    'invoice',
    'checkout',
    'receipt',
    'promo',
    'billing',
    'payment',
    'pay',
    'card',
    'premium',
    'unlock',
    'web',
    'website',
    'browser',
    'console',
    'computer',
    'laptop',
    'desktop',
    'stripe',
    'app store',
    'google play',
    'sign up',
    'create an account',
  ],
  es: [
    'comprar',
    'compra',
    'precio',
    'costo',
    'mejorar',
    'suscrib',
    'renov',
    'gestion',
    'prueba gratis',
    'reembolso',
    'factura',
    'recibo',
    'promo',
    'facturación',
    'pago',
    'pagar',
    'tarjeta',
    'premium',
    'desbloquear',
    'web',
    'sitio',
    'navegador',
    'consola',
    'computadora',
    'ordenador',
    'regístrate',
  ],
  ko: ['구매', '결제', '가격', '요금', '업그레이드', '구독', '갱신', '환불', '청구', '영수증', '프로모', '카드', '유료', '프리미엄', '잠금 해제', '웹', '사이트', '브라우저', '콘솔', '컴퓨터', '가입'],
};

/** Section 9.2: substrings in every language (money, the site's address, any link). */
export const ACCOUNT_DENY_SYMBOLS: readonly string[] = ['$', '€', '£', '₩', 'USD', 'hangulroute.com', 'http'];

/** A digit followed by 원 (a won amount), in every language. */
const WON_AMOUNT = /\d\s?원/u;

/** Lower case with the accents taken off, so `gestión` meets `gestion` and `regístrate` meets `registrate`. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const escape = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const LETTER = '[\\p{L}\\p{N}]';

function wordPattern(word: string, locale: UiLocale): RegExp {
  const body = escape(fold(word)).replace(/ /g, '\\s+');
  // es entries are word starts (stems); en entries are whole words.
  const end = locale === 'es' ? '' : `(?!${LETTER})`;
  return new RegExp(`(?<!${LETTER})${body}${end}`, 'u');
}

const PATTERNS: Readonly<Record<'en' | 'es', readonly { word: string; re: RegExp }[]>> = {
  en: ACCOUNT_DENY_WORDS.en.map((word) => ({ word, re: wordPattern(word, 'en') })),
  es: ACCOUNT_DENY_WORDS.es.map((word) => ({ word, re: wordPattern(word, 'es') })),
};

/**
 * Every entry of section 9.2 that `text` shows in `locale` (its words, then the symbols of every language); empty
 * when the text is clean. A test reads the hits to name what it found.
 */
export function accountDenyHits(text: string, locale: UiLocale): string[] {
  const hits: string[] = [];
  if (locale === 'ko') {
    for (const word of ACCOUNT_DENY_WORDS.ko) if (text.includes(word)) hits.push(word);
  } else {
    const folded = fold(text);
    for (const { word, re } of PATTERNS[locale]) if (re.test(folded)) hits.push(word);
  }
  for (const symbol of ACCOUNT_DENY_SYMBOLS) if (text.includes(symbol)) hits.push(symbol);
  if (WON_AMOUNT.test(text)) hits.push('<digit>원');
  return hits;
}
