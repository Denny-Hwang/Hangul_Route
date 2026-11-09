import { LOCALES, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_DENY_SYMBOLS, ACCOUNT_DENY_WORDS, PLAN_SCREEN_DENY, accountDenyHits, planScreenHasWord } from '../deny-list';

/**
 * F-AUTH-004 section 9.2 (row NS-2; CS-N5, CS-N10): one module for the Plan screen's list and the native grown-up
 * screens' list. Pins the section 9.2 entries and how each language matches.
 */

/** Every word section 9.2 names, per language. */
const SPEC_WORDS = {
  en: ['buy', 'purchase', 'price', 'cost', 'upgrade', 'subscribe', 'subscription', 'renew', 'manage', 'trial', 'refund', 'invoice', 'checkout', 'receipt', 'promo', 'billing', 'payment', 'pay', 'card', 'premium', 'unlock', 'web', 'website', 'browser', 'console', 'computer', 'laptop', 'desktop', 'Stripe', 'App Store', 'Google Play', 'sign up', 'create an account'],
  es: ['comprar', 'compra', 'precio', 'costo', 'mejorar', 'suscribirse', 'renovar', 'gestión', 'prueba gratis', 'reembolso', 'factura', 'recibo', 'promo', 'facturación', 'pago', 'pagar', 'tarjeta', 'premium', 'desbloquear', 'web', 'sitio', 'navegador', 'consola', 'computadora', 'ordenador', 'regístrate'],
  ko: ['구매', '결제', '가격', '요금', '업그레이드', '구독', '갱신', '환불', '청구', '영수증', '프로모', '카드', '유료', '프리미엄', '잠금 해제', '웹', '사이트', '브라우저', '콘솔', '컴퓨터', '가입'],
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
    expect(accountDenyHits('Paid by card.', 'en')).toEqual(['paid', 'card']);
  });

  it('en: not inside other words, and `card` is singular only', () => {
    for (const clean of ['Your cards stay', 'A payload', 'Webster', 'costume', 'Sign in', 'Signed in as Mina', 'Billie', 'Trialogue']) {
      expect(accountDenyHits(clean, 'en'), clean).toEqual([]);
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
