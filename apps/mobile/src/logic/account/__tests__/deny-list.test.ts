import { LOCALES, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_DENY_SYMBOLS, ACCOUNT_DENY_WORDS, PLAN_SCREEN_DENY, accountDenyHits, planScreenHasWord } from '../deny-list';

/**
 * F-AUTH-004 section 9.2 (rows NS-2, NS-5; CS-N5, CS-N10; D14, D15): one module for the Plan screen's list and the
 * native grown-up screens' list. Pins the section 9.2 entries and how each language matches.
 */

/** Every word section 9.2 names, per language (as amended by D14 and D15: payment-card phrases, the free lessons). */
const SPEC_WORDS = {
  en: [
    'buy', 'purchase', 'price', 'cost', 'upgrade', 'subscribe', 'subscription', 'renew', 'manage', 'trial', 'refund', 'invoice', 'checkout', 'receipt', 'promo', 'billing', 'payment', 'pay',
    'credit card', 'debit card', 'gift card', 'prepaid card', 'card number', 'card details', 'card on file', 'add a card', 'update your card', 'declined',
    'premium', 'unlock', 'web', 'website', 'browser', 'console', 'computer', 'laptop', 'desktop', 'Stripe', 'App Store', 'Google Play', 'sign up', 'create an account', 'free lessons',
  ],
  es: [
    'comprar', 'compra', 'precio', 'costo', 'mejorar', 'suscribirse', 'renovar', 'gestión', 'prueba gratis', 'reembolso', 'factura', 'recibo', 'promo', 'facturación', 'pago', 'pagar',
    'tarjeta de crédito', 'tarjeta de débito', 'tarjeta regalo', 'tarjeta de regalo', 'tarjeta prepago', 'número de tarjeta', 'datos de la tarjeta', 'agregar una tarjeta', 'añadir una tarjeta', 'lecciones gratuitas',
    'premium', 'desbloquear', 'web', 'sitio', 'navegador', 'consola', 'computadora', 'ordenador', 'regístrate',
  ],
  ko: [
    '구매', '결제', '가격', '요금', '업그레이드', '구독', '갱신', '환불', '청구', '영수증', '프로모',
    '신용카드', '체크카드', '기프트카드', '선불카드', '카드번호', '카드결제', '카드등록', '카드변경', '상품권', '무료레슨',
    '유료', '프리미엄', '잠금 해제', '웹', '사이트', '브라우저', '콘솔', '컴퓨터', '가입',
  ],
} as const;

describe('the lists of section 9.2', () => {
  it('every word the spec names is caught, in its language', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      for (const word of SPEC_WORDS[locale]) expect(accountDenyHits(word, locale), `${locale}: ${word}`).not.toEqual([]);
    }
    expect(ACCOUNT_DENY_SYMBOLS).toEqual(['$', '€', '£', '₩', 'USD', 'hangulroute.com', 'http']);
    expect(ACCOUNT_DENY_WORDS.ko).toContain('관리');
  });

  it('the forms the spec’s whole words missed are caught too (manages, renews, prices, paid, Subscriptions)', () => {
    for (const text of ['The person who set up this family manages this plan.', 'Renews on May 1', 'Learners never see prices or receipts.', 'Managed by Maple', 'Subscriptions', 'Paid plan', 'Upgraded', 'Unlocked', 'Bought']) {
      expect(accountDenyHits(text, 'en'), text).not.toEqual([]);
    }
    expect(accountDenyHits('Se renueva el 1 de mayo', 'es')).toEqual(['renuev']);
    expect(accountDenyHits('La escuela administra este plan', 'es')).toEqual(['administr']);
    expect(accountDenyHits('학교를 만든 분이 이 플랜을 관리해요.', 'ko')).toEqual(['관리']);
  });

  it('positive control: the console’s own billing lines that ND-8 forbids are caught in en, es and ko', () => {
    for (const locale of LOCALES) {
      const billing = getMessages(locale).console.billing;
      const lines = [
        ...Object.values(billing.readOnly),
        billing.status.renewsOn('2027-01-31'),
        billing.help.learners,
        billing.manage.cta,
      ];
      for (const line of lines) expect(accountDenyHits(line, locale), `${locale}: ${line}`).not.toEqual([]);
    }
  });

  it('the Plan screen list moved here unchanged (F-BILL-002 section 4.8 rule 1)', () => {
    expect(PLAN_SCREEN_DENY).toEqual({
      en: ['web', 'website', 'browser', 'hangulroute.com', 'billing page', 'console'],
      es: ['web', 'sitio', 'navegador', 'hangulroute.com', 'página de facturación', 'consola'],
      ko: ['웹', '사이트', '브라우저', 'hangulroute.com', '결제 페이지', '콘솔'],
    });
  });
});

describe('accountDenyHits', () => {
  it('en: whole words, any case; phrases across spaces', () => {
    expect(accountDenyHits('Buy the plan', 'en')).toEqual(['buy']);
    expect(accountDenyHits('Manage it on the WEB', 'en')).toEqual(['manag*', 'web']);
    expect(accountDenyHits('Sign  up today', 'en')).toEqual(['sign up']);
    expect(accountDenyHits('Open the App Store', 'en')).toEqual(['app store']);
    expect(accountDenyHits('Paid by credit card.', 'en')).toEqual(['paid', 'credit card']);
  });

  it('en: not inside other words', () => {
    for (const clean of ['A payload', 'Webster', 'costume', 'Sign in', 'Signed in as Mina', 'Billie', 'Trialogue']) {
      expect(accountDenyHits(clean, 'en'), clean).toEqual([]);
    }
  });

  it('D15: heritage cards are learning facts (the reports say them); payment-card phrases are caught, plural or not', () => {
    for (const locale of LOCALES) {
      const report = getMessages(locale).report;
      for (const line of [report.figure.cards, report.detail.totals(3, 1), report.detail.totals(3, 2), report.insight.cards_new(1), report.insight.cards_new(2)]) {
        expect(accountDenyHits(line, locale), `${locale}: ${line}`).toEqual([]);
      }
    }
    expect(accountDenyHits('Your cards stay. 1 card.', 'en')).toEqual([]);
    expect(accountDenyHits('1 tarjeta nueva del patrimonio. Tarjetas nuevas', 'es')).toEqual([]);
    expect(accountDenyHits('새 카드 · 카드 정보', 'ko')).toEqual([]);
    expect(accountDenyHits('Add your credit cards', 'en')).toEqual(['credit card']);
    expect(accountDenyHits('Card numbers', 'en')).toEqual(['card number']);
    expect(accountDenyHits('Tus tarjetas de crédito', 'es')).toEqual(['tarjeta de crédito']);
    expect(accountDenyHits('Números de tarjeta', 'es')).toEqual(['número de tarjeta']);
    expect(accountDenyHits('신용 카드로', 'ko')).toEqual(['신용카드']);
    expect(accountDenyHits('카드 번호를', 'ko')).toEqual(['카드번호']);
    expect(accountDenyHits('잠금해제', 'ko')).toEqual(['잠금 해제']);
  });

  it('charging a card stays caught without the bare card word (NS-5 review), hyphens too', () => {
    for (const locale of LOCALES) {
      const line = getMessages(locale).console.billing.testMode;
      expect(accountDenyHits(line, locale), `${locale}: ${line}`).not.toEqual([]);
    }
    expect(accountDenyHits('Your card will be charged.', 'en')).toEqual(['charg*']);
    expect(accountDenyHits('Card ending in 4242', 'en')).toEqual(['card ending']);
    expect(accountDenyHits('Use a saved card', 'en')).toEqual(['saved card']);
    expect(accountDenyHits('A credit-card form', 'en')).toEqual(['credit card']);
    expect(accountDenyHits('Tu tarjeta fue rechazada.', 'es')).toEqual(['rechaz']);
    expect(accountDenyHits('No se cobra nada', 'es')).toEqual(['cobr']);
  });

  it('D14: the free-end line is caught in every language', () => {
    for (const locale of LOCALES) {
      const insight = getMessages(locale).report.insight.free_days_done('Mina');
      expect(accountDenyHits(insight, locale), `${locale}: ${insight}`).not.toEqual([]);
    }
  });

  it('es: word starts, any case and accent', () => {
    expect(accountDenyHits('Suscríbete hoy', 'es')).toEqual(['suscrib']);
    expect(accountDenyHits('Renovar el plan', 'es')).toEqual(['renov']);
    expect(accountDenyHits('Gestión del plan', 'es')).toEqual(['gestion']);
    expect(accountDenyHits('REGISTRATE aquí', 'es')).toEqual(['regístrate']);
    expect(accountDenyHits('La facturación', 'es')).toEqual(['factura', 'facturación']);
    expect(accountDenyHits('Comprar ahora', 'es')).toEqual(['comprar', 'compra']);
  });

  it('es: not in the middle of a word', () => {
    for (const clean of ['Entra con tu correo', 'Siempre', 'Las tarjetitas no'.replace('tarjetitas', 'cartas'), 'Docentes: 3']) {
      expect(accountDenyHits(clean, 'es'), clean).toEqual([]);
    }
  });

  it('ko: substrings (particles attach to the word)', () => {
    expect(accountDenyHits('결제를 해요', 'ko')).toEqual(['결제']);
    expect(accountDenyHits('웹사이트에서', 'ko')).toEqual(['웹', '사이트']);
    expect(accountDenyHits('어른 로그인', 'ko')).toEqual([]);
  });

  it('symbols in every language, and a won amount', () => {
    expect(accountDenyHits('$5', 'en')).toEqual(['$']);
    expect(accountDenyHits('5 €', 'es')).toEqual(['€']);
    expect(accountDenyHits('Go to hangulroute.com', 'en')).toEqual(['hangulroute.com']);
    expect(accountDenyHits('https://x', 'ko')).toEqual(['http']);
    expect(accountDenyHits('HTTP and 5 usd', 'en')).toEqual(['USD', 'http']);
    expect(accountDenyHits('9,900원', 'ko')).toEqual(['<digit>원']);
    expect(accountDenyHits('3 원', 'ko')).toEqual(['<digit>원']);
    expect(accountDenyHits('어른 공간', 'ko')).toEqual([]);
  });
});

describe('planScreenHasWord (the Plan screen test’s match, moved here)', () => {
  it('whole words in en and es, substrings in ko', () => {
    expect(planScreenHasWord('Open the web page', 'web', 'en')).toBe(true);
    expect(planScreenHasWord('Webster', 'web', 'en')).toBe(false);
    expect(planScreenHasWord('hangulroute.com/teach', 'hangulroute.com', 'en')).toBe(true);
    expect(planScreenHasWord('hangulroutexcom', 'hangulroute.com', 'en')).toBe(false);
    expect(planScreenHasWord('웹에서', '웹', 'ko')).toBe(true);
  });
});
