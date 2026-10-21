import { SCHOOL_ADMIN_CAP } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { scanCopy } from '../banned';
import { LOCALES } from '../locales';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';

/**
 * [SA] AMENDMENTS-SEATS-ADMINS section 9.4 (row SA-4): the Administrators panel, the invite page, the read-only school
 * Settings and the step-up lines, in en, es and ko. The admin cap is an argument (`SCHOOL_ADMIN_CAP`), never typed in
 * a string; no line blames anyone; es uses the glossary "admin" (no gender agrees with the reader) and ko the colon
 * form where a name or a school leads.
 */
const SA4_ROOTS = ['console.admins', 'console.adminInvite'] as const;
const SA4_EXTRA = ['console.settings.ownerOnly', 'console.settings.privacy.anonymizeOn', 'console.settings.privacy.anonymizeOff'] as const;
const sa4Paths = (): string[] => [...leafPaths(en).filter((p) => SA4_ROOTS.some((root) => p.startsWith(`${root}.`))), ...SA4_EXTRA];

type Fn = (...args: unknown[]) => string;
const call = (locale: (typeof LOCALES)[number], path: string, ...args: unknown[]): string => {
  const value = lookup(getMessages(locale), path);
  return typeof value === 'function' ? (value as Fn)(...args) : (value as string);
};
/** Every value of a path, called with placeholder words where it takes arguments (numbers for the cap and the count). */
const NUMERIC = new Set(['console.admins.count', 'console.admins.about', 'console.admins.full', 'console.adminInvite.full']);
const sample = (locale: (typeof LOCALES)[number], path: string): string => {
  const value = lookup(getMessages(locale), path);
  if (typeof value !== 'function') return value as string;
  const arity = (value as Fn).length;
  return NUMERIC.has(path) ? (value as Fn)(...[71, 73].slice(2 - arity)) : (value as Fn)(...Array.from({ length: arity }, (_, i) => `Name${'abcdefgh'.charAt(i)}`));
};

describe('section 9.4 in English', () => {
  it('reads the panel rows', () => {
    const a = en.console.admins;
    expect(a.title).toBe('Administrators');
    expect(a.count(1, SCHOOL_ADMIN_CAP)).toBe('1 of 2 added');
    expect(a.ownerRow('Ms Park')).toBe('Ms Park · owner');
    expect(a.adminRow('Mr Lee', 'Oct 3')).toBe('Mr Lee · admin · joined Oct 3');
    expect(a.about(SCHOOL_ADMIN_CAP)).toBe('A school can have 2 administrators besides its owner.');
    expect(a.full(SCHOOL_ADMIN_CAP)).toBe('All 2 places are taken. Remove an administrator or revoke an invite to add someone else.');
    expect(a.invite.once('Oct 27, 2026')).toBe('It works once and ends on Oct 27, 2026. It is shown only now: copy it before you close this.');
    expect(a.openInvite('Oct 18', 'Oct 25, 2026')).toBe('Invite made Oct 18 · ends Oct 25, 2026');
    expect([a.revoke.cta, a.revokeKeep.cta, a.remove.cta, a.remove.a11y('Mr Lee'), a.leave.cta]).toEqual(['Revoke', 'Keep it', 'Remove', 'Remove Mr Lee', 'Stop being an administrator']);
    expect(a.removeAsk('Mr Lee', 'Maple School')).toBe('Remove Mr Lee as an administrator of Maple School?');
    expect(a.leaveAsk('Maple School')).toBe('Stop being an administrator of Maple School?');
    expect(a.history.renamedClass('Ms Park', 'Oct 19')).toBe('Ms Park renamed a class · Oct 19');
    expect(a.history.someone).toBe('A former member');
    expect(a.newAdmin('Dr Cho', 'cho@example.org')).toBe('New administrator: Dr Cho (cho@example.org). If this is not the person you invited, remove them.');
  });

  it('reads the invite page rows', () => {
    const t = en.console.adminInvite;
    expect(t.pageTitle).toBe('Administrator invite');
    expect(t.title('Maple School')).toBe('Join Maple School as an administrator?');
    expect(t.invitedByOwner).toBe("Invited by the school's owner");
    expect(t.signedInAs('jin.cho@example.org')).toBe('Signed in as jin.cho@example.org');
    expect(t.full(SCHOOL_ADMIN_CAP)).toBe('This school already has 2 administrators.');
    expect(t.home.cta).toBe('Go to my home');
    expect(t.tryAgain).toBe("Couldn't check your invite right now. Try again in a moment.");
    expect(en.console.settings.ownerOnly).toBe("Only the school's owner can change these settings.");
  });

  it('the remove names start with the visible word (WCAG 2.5.3) in every locale', () => {
    for (const locale of LOCALES) {
      const a = getMessages(locale).console.admins;
      expect(a.remove.a11y('Kim'), locale).toContain('Kim');
      expect(a.remove.a11y('Kim').startsWith(locale === 'ko' ? '관리자에서 빼기' : a.remove.cta), locale).toBe(true);
    }
  });
});

describe('section 9.4 in Spanish and Korean', () => {
  it('es reads the section 9.4 drafts', () => {
    const e = getMessages('es').console;
    expect(e.admins.count(1, 2)).toBe('1 de 2 agregados');
    expect(e.admins.revoked).toBe('Invitación anulada. El enlace ya no funciona.');
    expect(e.admins.history.someone).toBe('Alguien que ya salió');
    expect(e.adminInvite.title('Maple')).toBe('¿Unirte a Maple como admin?');
    expect(e.adminInvite.tryAgain).toBe('No se pudo revisar la invitación ahora. Inténtalo de nuevo en un momento.');
    expect(e.settings.privacy.anonymizeOn).toBe('Las listas muestran iniciales.');
  });

  it('ko reads the section 9.4 drafts, the colon form where a name or a school leads', () => {
    const k = getMessages('ko').console;
    expect(k.admins.count(1, 2)).toBe('추가한 관리자: 1/2명');
    expect(k.admins.left('Maple')).toBe('관리자를 그만뒀어요: Maple');
    expect(k.admins.removed('Mr Lee')).toBe('관리자에서 뺐어요: Mr Lee');
    expect(k.adminInvite.done('Maple')).toBe('이제 관리자예요: Maple');
    expect(k.adminInvite.tryAgain).toBe('지금은 초대를 확인하지 못했어요. 잠시 뒤에 다시 해 볼까요?');
    expect(k.admins.invite.stepUp.reason).toBe('공유 기기에서도 학교 명단을 안전하게 지키기 위해서예요.');
  });

  for (const [locale, overlay] of Object.entries({ es, ko })) {
    it(`${locale}: every SA-4 key, with the English kind and arity`, () => {
      const paths = sa4Paths();
      expect(paths.length).toBeGreaterThanOrEqual(69);
      for (const path of paths) {
        const own = lookup(overlay, path);
        const source = lookup(en, path);
        expect(own, `${locale}:${path}`).toBeDefined();
        expect(typeof own, `${locale}:${path}`).toBe(typeof source);
        if (typeof own === 'function' && typeof source === 'function') expect(own.length, `${locale}:${path}`).toBe(source.length);
      }
    });
  }
});

describe('section 9.4 rules in every locale', () => {
  it('no string types the admin cap (callers pass SCHOOL_ADMIN_CAP), and no other number', () => {
    for (const locale of LOCALES) {
      for (const path of sa4Paths()) {
        const text = sample(locale, path).split('71').join('').split('73').join('');
        expect(text, `${locale}:${path}`).not.toMatch(/\d/);
      }
    }
  });

  it('no banned caregiver word, no blame ("error", "failed", "denied")', () => {
    for (const locale of LOCALES) {
      const texts = sa4Paths().map((path) => sample(locale, path));
      expect(scanCopy(texts, locale, 'caregiver'), locale).toEqual([]);
    }
    for (const path of sa4Paths()) expect(sample('en', path), path).not.toMatch(/\berror\b|\bfail(ed|ure)?\b|\bdenied\b|\binvalid\b/i);
  });

  it('no emoji', () => {
    for (const locale of LOCALES) for (const path of sa4Paths()) expect(sample(locale, path), `${locale}:${path}`).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
