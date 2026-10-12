import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NOTE_LINK_TLDS,
  NOTE_TEXT_MAX,
  NOTE_TONE_ALLOW,
  checkNoteText,
  normalizeNoteText,
  type NoteTextProblem,
} from '../note-text';

// F-FEEDBACK-001 §6.4: the one text guard for a note's free text (console and Worker).

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(SRC, '..');

function problemOf(raw: string): NoteTextProblem | null {
  const result = checkNoteText(raw);
  return result.ok ? null : result.problem;
}

describe('NOTE_TEXT_MAX and the lists', () => {
  it('caps a note at 120 characters (OD-4)', () => {
    expect(NOTE_TEXT_MAX).toBe(120);
  });

  it('keeps the fixed TLD list of §6.4', () => {
    expect([...NOTE_LINK_TLDS]).toEqual([
      'com', 'net', 'org', 'io', 'co', 'kr', 'me', 'app', 'ly', 'gg', 'tv', 'info', 'biz', 'xyz', 'link',
      'site', 'online', 'us', 'uk', 'ca', 'es', 'mx', 'edu', 'gov', 'page', 'dev', 'to', 'so',
    ]);
  });

  it('starts the tone allow-list with one Korean word', () => {
    expect(NOTE_TONE_ALLOW).toEqual({ en: [], es: [], ko: ['뒤처리'] });
  });
});

describe('normalizeNoteText', () => {
  it('trims and folds runs of spaces and tabs into one space', () => {
    expect(normalizeNoteText('  Great \t\t work   today \t')).toBe('Great work today');
  });

  it('composes to NFC', () => {
    const decomposed = 'Jose\u0301 and \u1100\u1161';
    expect(normalizeNoteText(decomposed)).toBe('José and 가');
  });

  it('is idempotent', () => {
    const samples = ['  a  b ', 'Jose\u0301\t\tok', '가나다', '', '   '];
    for (const sample of samples) {
      const once = normalizeNoteText(sample);
      expect(normalizeNoteText(once)).toBe(once);
    }
  });

  describe('on a runtime without String.prototype.normalize', () => {
    const original = String.prototype.normalize;

    afterEach(() => {
      String.prototype.normalize = original;
    });

    it('still trims and folds spaces, leaving the code points as typed', () => {
      // @ts-expect-error -- simulate a runtime that lacks the method
      String.prototype.normalize = undefined;
      expect(normalizeNoteText('  Jose\u0301   ok ')).toBe('Jose\u0301 ok');
    });
  });
});

describe('checkNoteText: a good note', () => {
  it('returns the normalized text', () => {
    expect(checkNoteText('  Loved your work on ㄱ and ㄴ today  ')).toEqual({
      ok: true,
      text: 'Loved your work on ㄱ and ㄴ today',
    });
  });

  it('passes Spanish and Korean notes', () => {
    expect(checkNoteText('¡Muy bien, María! Sigue así.')).toEqual({ ok: true, text: '¡Muy bien, María! Sigue así.' });
    expect(checkNoteText('오늘 정말 잘했어요')).toEqual({ ok: true, text: '오늘 정말 잘했어요' });
  });
});

describe('checkNoteText: invalid', () => {
  it.each([
    ['NUL', 'a\u0000b'],
    ['bell', 'a\u0007b'],
    ['unit separator', 'a\u001fb'],
    ['DEL', 'a\u007fb'],
    ['C1 control', 'a\u0085b'],
    ['C1 end', 'a\u009fb'],
    ['LRE', 'a\u202ab'],
    ['RLO', 'a\u202eb'],
    ['LRI', 'a\u2066b'],
    ['PDI', 'a\u2069b'],
    ['lone high surrogate', 'a\ud83db'],
    ['lone high surrogate at the end', 'ab\ud83d'],
    ['lone low surrogate', 'a\ude00b'],
  ])('rejects a %s', (_name, raw) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'invalid' });
  });

  it('allows a tab (folded to a space)', () => {
    expect(checkNoteText('Well\tdone')).toEqual({ ok: true, text: 'Well done' });
  });

  it('comes before every other problem', () => {
    expect(problemOf('\u0000\nwww.kim.com \u{1F600}')).toBe('invalid');
  });
});

describe('checkNoteText: line_break', () => {
  it.each([
    ['LF', 'Good\nwork'],
    ['CR', 'Good\rwork'],
    ['CRLF', 'Good\r\nwork'],
    ['line separator', 'Good\u2028work'],
    ['paragraph separator', 'Good\u2029work'],
    ['trailing LF', 'Good work\n'],
  ])('rejects a %s', (_name, raw) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'line_break' });
  });

  it('comes before empty', () => {
    expect(problemOf('\n')).toBe('line_break');
  });
});

describe('checkNoteText: empty', () => {
  it.each([[''], ['   '], ['\t \t']])('rejects %j', (raw) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'empty' });
  });
});

describe('checkNoteText: too_long', () => {
  it('passes exactly 120 characters and rejects 121', () => {
    expect(checkNoteText('a'.repeat(120))).toEqual({ ok: true, text: 'a'.repeat(120) });
    expect(checkNoteText('a'.repeat(121))).toEqual({ ok: false, problem: 'too_long' });
  });

  it('counts a Hangul syllable as one character', () => {
    expect(checkNoteText('가'.repeat(120)).ok).toBe(true);
    expect(problemOf('가'.repeat(121))).toBe('too_long');
  });

  it('counts an accented letter as one character, after composing', () => {
    const composed = 'é'.repeat(120);
    const decomposed = 'e\u0301'.repeat(120);
    expect(checkNoteText(composed).ok).toBe(true);
    expect(checkNoteText(decomposed)).toEqual({ ok: true, text: composed });
    expect(problemOf('é'.repeat(121))).toBe('too_long');
  });

  it('measures after trimming and folding spaces', () => {
    expect(checkNoteText(`   ${'a'.repeat(120)}   `).ok).toBe(true);
  });

  it('comes before link', () => {
    expect(problemOf(`www.kim.com ${'a'.repeat(120)}`)).toBe('too_long');
  });
});

describe('checkNoteText: link', () => {
  it.each([
    ['https://kim.com', 'https://kim.com'],
    ['see http://x', 'http://x'],
    ['go to WWW.KIM', 'WWW.KIM'],
    ['kim.com', 'kim.com'],
    ['Visit kim.com today', 'kim.com'],
    ['look a-b.co.kr/x', 'a-b.co.kr'],
    ['abc.io:8080', 'abc.io'],
    ['Try hangul.app.', 'hangul.app'],
    ['Try hangul.app!', 'hangul.app'],
    ['(kim.com)', 'kim.com'],
    ['KIM.COM', 'KIM.COM'],
    ['Visit Kim.Com now', 'Kim.Com'],
    ['my-site.dev', 'my-site.dev'],
    ['find it at x.kim.net', 'kim.net'],
  ])('rejects %j and quotes %j as typed', (raw, word) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'link', word });
  });

  it.each([
    ['Good job.See you'],
    ['Mr.Kim says hi'],
    ['ㄱ.ㄴ'],
    ['3.5'],
    ['kim.comfort'],
    ['a.com'],
    ['Great job.Keep going'],
  ])('passes the ordinary typo %j', (raw) => {
    expect(checkNoteText(raw).ok).toBe(true);
  });

  it('comes before contact', () => {
    expect(problemOf('kim.com kim@x')).toBe('link');
  });
});

describe('checkNoteText: contact', () => {
  it.each([
    ['an email', 'write me at kim@example'],
    ['a handle', 'find @kim_teacher'],
    ['a bare at sign', '@'],
    ['a full-width at sign', 'kim\uff20example'],
    ['seven digits', 'call 1234567'],
    ['a phone with dashes', 'call 555-123-4567'],
    ['a phone with spaces and brackets', '(555) 123 4567'],
    ['a phone with a plus and dots', '+1.555.123.4567'],
    ['digits across separators', '1 2 3 4 5 6 7'],
    ['full-width digits', '\uff11\uff12\uff13\uff14\uff15\uff16\uff17'],
  ])('rejects %s', (_name, raw) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'contact' });
  });

  it.each([['six digits 123456'], ['Day 3, 4, 5, 6, 7, 8, 9'], ['Room 12 at 3 on the 4th']])('passes %j', (raw) => {
    expect(checkNoteText(raw).ok).toBe(true);
  });

  it('comes before emoji', () => {
    expect(problemOf('@kim \u{1F600}')).toBe('contact');
  });
});

describe('checkNoteText: emoji', () => {
  it.each([
    ['a face', 'Great work \u{1F600}'],
    ['the first code point of the range', 'a\u{1F000}'],
    ['the last code point of the range', 'a\u{1FAFF}'],
    ['a star', 'Well done \u2605 today'],
    ['a heart', 'Love \u2764'],
    ['the end of the dingbats', 'a\u27bf'],
    ['a variation selector', 'a\ufe0f'],
    ['a zero-width joiner', 'a\u200db'],
  ])('rejects %s', (_name, raw) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'emoji' });
  });

  it('passes symbols just outside the ranges', () => {
    expect(checkNoteText('a\u25ff b\u27c0 c\u{1FB00}').ok).toBe(true);
  });

  it('comes before tone', () => {
    expect(problemOf('lazy \u{1F600}')).toBe('emoji');
  });
});

describe('checkNoteText: tone', () => {
  it.each([
    ['en learner word', 'You failed the quiz', 'failed'],
    ['en caregiver word', 'Do not be lazy', 'lazy'],
    ['es learner word', 'No fallaste nada', 'fallaste'],
    ['es caregiver word', 'No seas vago', 'vago'],
    ['ko learner word', '실패해도 괜찮아요', '실패'],
    ['ko caregiver word as a substring', '조금 뒤처졌어요', '뒤처'],
    ['ko word inside an English note', 'Hi 게으른 friend', '게으른'],
  ])('rejects the %s and names it', (_name, raw, word) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'tone', word });
  });

  it('checks every locale whatever the language of the note', () => {
    expect(checkNoteText('Great work, not perezoso at all')).toEqual({ ok: false, problem: 'tone', word: 'perezoso' });
  });

  it('passes a Korean word on the allow-list (뒤처리)', () => {
    expect(checkNoteText('뒤처리까지 깔끔하게 했어요')).toEqual({ ok: true, text: '뒤처리까지 깔끔하게 했어요' });
  });

  it('still rejects a banned word next to an allowed one', () => {
    expect(checkNoteText('뒤처리 잘했지만 뒤처졌어요')).toEqual({ ok: false, problem: 'tone', word: '뒤처' });
  });

  it('matches whole tokens in en and es', () => {
    expect(checkNoteText('You dismissed nothing; the behindhand note is fine').ok).toBe(true);
  });
});

describe('the subpath module', () => {
  it('is exported as @hangul-route/i18n/note-text', () => {
    const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8')) as { exports: Record<string, string> };
    expect(pkg.exports['./note-text']).toBe('./src/note-text.ts');
  });

  function runtimeImports(file: string): string[] {
    const text = readFileSync(join(SRC, file), 'utf8');
    const out: string[] = [];
    for (const match of text.matchAll(/^import\s+(type\s+)?[^'"]*?from\s+'([^']+)';/gm)) {
      if (match[1] === undefined && match[2] !== undefined) out.push(match[2]);
    }
    return out;
  }

  it('imports only the banned-word finder at run time, so no dictionary reaches the Worker', () => {
    expect(runtimeImports('note-text.ts')).toEqual(['./banned']);
    expect(runtimeImports('banned.ts')).toEqual(['./banned-words.json', './locales']);
    expect(runtimeImports('locales.ts')).toEqual(['@hangul-route/content-schema', './env']);
    expect(runtimeImports('env.ts')).toEqual([]);
  });
});
