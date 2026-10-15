import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import ledger from '../messages/review-ledger.json';
import { LOCALE_STATUS, LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { englishSha } from './es-coverage';

/**
 * The review ledger stays current for every shipped locale (F-I18N-001 §3.10 steps 3-4). `i18n-status` only
 * warns on a stale namespace, and a warning is easy to miss: #714 and #722 changed `en/learner.ts` and
 * `en/caregiver.ts` after the es / ko sign-off and nothing went red. This test is the CI guard: once a locale is
 * `'shipped'`, every namespace's ledger `enSha` must be the sha256 of today's English file, so a PR that changes
 * shipped English also runs the two-lens MAR of the changed keys and re-signs the namespace in the same PR.
 *
 * To fix a failure: run `node scripts/i18n-status.mjs`, review the changed keys (es and ko), and copy the printed
 * `enSha` into `messages/review-ledger.json` with `reviewedBy: "MAR"` and today's `reviewedAt`.
 */

type LedgerEntry = { enSha: string; reviewedBy: string; reviewedAt: string };
const LEDGER = ledger as Readonly<Record<string, Readonly<Record<string, LedgerEntry>>>>;
const SHIPPED_OVERLAYS = LOCALES.filter((locale) => locale !== 'en' && LOCALE_STATUS[locale] === 'shipped');

describe('review ledger: no stale sign-off in a shipped locale (§3.10)', () => {
  it('es and ko are shipped, so the guard below checks them', () => {
    expect(SHIPPED_OVERLAYS).toEqual(expect.arrayContaining(['es', 'ko']));
  });

  it.each(SHIPPED_OVERLAYS)('%s: every namespace is signed against the current English', (locale) => {
    const entries = LEDGER[locale] ?? {};
    const stale = Object.keys(en)
      .filter((namespace) => entries[namespace]?.enSha !== englishSha(namespace))
      .map((namespace) => `${locale}.${namespace}: ledger ${entries[namespace]?.enSha ?? '(none)'} vs English ${englishSha(namespace)}`);
    expect(stale, 'English changed since the MAR sign-off; review the changed keys and re-sign (see this file).').toEqual([]);
  });

  it('englishSha is the 64-hex sha256 that i18n-status prints for every namespace', () => {
    for (const namespace of Object.keys(en)) expect(englishSha(namespace), namespace).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('MAR of #714 / #722 (2026-10-14): the values the review kept or changed', () => {
  it('ko join confirm line reads 여기뿐 아니라 (not 여기만이 아니라)', () => {
    expect(getMessages('ko').caregiver.join.confirm.sameEverywhere).toBe('이 이름은 여기뿐 아니라 어디서나 같아요.');
  });

  it('es edit-profile class lines use the gender-neutral "quien aprende" and the shared "tengas conexión"', () => {
    const es = getMessages('es').learner.editProfile;
    expect(es.classDevice).toBe('El nombre, el nivel y el Hoya se pueden cambiar en el dispositivo de quien aprende.');
    expect(es.classNote).toBe('La lista de tu docente se actualiza la próxima vez que tengas conexión.');
  });

  it('the locked-name line names the Edit profile screen by its own title in each locale', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale);
      expect(m.caregiver.join.confirm.nameLocked, locale).toContain(m.learner.editProfile.title);
    }
  });
});
