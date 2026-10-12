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
      'be', 'gl', 'ai', 'ru', 'jp', 'live', 'chat', 'club', 'gd', 'cc',
    ]);
  });

  it('keeps the tone allow-list of §6.4 (each entry has its own test below)', () => {
    expect(NOTE_TONE_ALLOW).toEqual({ en: ['missed you', 'behind you'], es: [], ko: ['뒤처리'] });
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
    ['soft hyphen', 'a\u00adb'],
    ['combining grapheme joiner', 'a\u034fb'],
    ['bidi Arabic letter mark', 'a\u061cb'],
    ['Hangul choseong filler', 'a\u115fb'],
    ['Hangul jungseong filler', 'a\u1160b'],
    ['Khmer inherent vowel', 'a\u17b4b'],
    ['Khmer inherent vowel aa', 'a\u17b5b'],
    ['Mongolian free variation selector', 'a\u180bb'],
    ['Mongolian vowel separator', 'a\u180eb'],
    ['Mongolian last selector', 'a\u180fb'],
    ['zero-width space', 'a\u200bb'],
    ['zero-width non-joiner', 'a\u200cb'],
    ['left-to-right mark', 'a\u200eb'],
    ['right-to-left mark', 'a\u200fb'],
    ['word joiner', 'a\u2060b'],
    ['zero-width invisible plus', 'a\u2064b'],
    ['deprecated format character', 'a\u206ab'],
    ['last deprecated format character', 'a\u206fb'],
    ['Braille blank', 'a\u2800b'],
    ['Hangul filler', 'a\u3164b'],
    ['variation selector 1', 'a\ufe00b'],
    ['text presentation selector', 'a\ufe0eb'],
    ['byte order mark', 'a\ufeffb'],
    ['halfwidth Hangul filler', 'a\uffa0b'],
    ['interlinear annotation', 'a\ufff9b'],
    ['interlinear annotation end', 'a\ufffbb'],
    ['tag character', 'a\u{E0041}b'],
    ['last tag character', 'a\u{E007F}b'],
    ['supplementary variation selector', 'a\u{E0100}b'],
    ['mathematical bold letter', '\u{1D424}\u{1D422}\u{1D426}'],
    ['mathematical digit', 'call \u{1D7CE}'],
    ['last mathematical code point', 'a\u{1D7FF}'],
    ['run of three combining marks', 'a\u0301\u0302\u0303'],
    ['run of combining marks from another block', 'a\u1ab0\u1dc0\u20d0'],
    ['run of half marks', 'a\ufe20\ufe21\ufe2f'],
  ])('rejects a %s', (_name, raw) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'invalid' });
  });

  it.each([
    ['a zero-width space inside a domain', 'Visit kim\u200b.com'],
    ['a zero-width space after the dot', 'kim.\u200bcom'],
    ['a word joiner inside a domain', 'kim\u2060.com'],
    ['a soft hyphen inside a domain', 'kim\u00ad.com'],
    ['a left-to-right mark inside a domain', 'kim\u200e.com'],
    ['zero-width spaces between digits', 'Call 010\u200b1234\u200b5678'],
    ['Hangul fillers between digits', 'Call 010\u31641234\u31645678'],
    ['zero-width spaces inside a banned word', 'la\u200bzy'],
    ['a zero-width space inside a Korean banned word', '실\u200b패'],
    ['a note of only a zero-width space', '\u200b'],
    ['a note of only a Hangul filler', '\u3164'],
    ['sixteen stacked marks', `a${'\u0301'.repeat(16)}`],
  ])('rejects %s, so nothing hidden slips past the other rules', (_name, raw) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'invalid' });
  });

  it('allows up to two combining marks in a row (decomposed Vietnamese or Spanish letters)', () => {
    expect(checkNoteText('Vie\u0323\u0302t and Jose\u0301').ok).toBe(true);
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
    ['find it at x.kim.net', 'x.kim.net'],
    ['a.com', 'a.com'],
    ['message me at t.me/kimteacher', 't.me'],
    ['m.me/kim.teacher', 'm.me'],
    ['wa.me/15551234', 'wa.me'],
    ['x.com/kimteach', 'x.com'],
    ['t.co/abc', 't.co'],
    ['youtu.be/abcd1234', 'youtu.be'],
    ['goo.gl/abcd', 'goo.gl'],
    ['is.gd/abc', 'is.gd'],
    ['kim.ai', 'kim.ai'],
    ['kim.live today', 'kim.live'],
    ['the full-width \uff4b\uff49\uff4d\uff0e\uff43\uff4f\uff4d', '\uff4b\uff49\uff4d\uff0e\uff43\uff4f\uff4d'],
    ['an ideographic full stop kim\u3002com', 'kim\u3002com'],
    ['a halfwidth ideographic full stop kim\uff61com', 'kim\uff61com'],
    ['circled letters \u24da\u24d8\u24dc.\u24d2\u24de\u24dc', '\u24da\u24d8\u24dc.\u24d2\u24de\u24dc'],
    ['capital circled letters \u24c0\u24be\u24c2.\u24b8\u24c4\u24c2', '\u24c0\u24be\u24c2.\u24b8\u24c4\u24c2'],
    ['a combining mark inside kim.c\u0335om', 'kim.c\u0335om'],
    ['two combining marks at the end of kim.com\u0335\u0336 now', 'kim.com\u0335\u0336'],
    ['a full-width scheme \uff48\uff54\uff54\uff50\uff53\uff1a\uff0f\uff0fx', '\uff48\uff54\uff54\uff50\uff53\uff1a\uff0f\uff0fx'],
    ['see (www.kim) now', '(www.kim)'],
    ['Proud of you.Me too', 'you.Me'],
  ])('rejects %j and quotes %j as typed', (raw, word) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'link', word });
  });

  it.each([
    ['Good job.See you'],
    ['Mr.Kim says hi'],
    ['ㄱ.ㄴ'],
    ['3.5'],
    ['kim.comfort'],
    ['Great job.Keep going'],
    ['i.e. and e.g.'],
    ['U.S. and a.m. and p.s.'],
    ['No.1 reader'],
    ['Awww. So proud of you'],
    ['Awwwww.'],
    ['josé.comida'],
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
    ['a small at sign', 'kim\ufe6bexample'],
    ['a phone with commas', 'Call 010,1234,5678'],
    ['a phone with slashes', '010/1234/5678'],
    ['a phone with underscores', '010_1234_5678'],
    ['a phone with middle dots', '010\u00b71234\u00b75678'],
    ['a phone with en dashes', '010\u20131234\u20135678'],
    ['a phone with non-breaking hyphens', '010\u20111234\u20115678'],
    ['a phone with minus signs', '010\u22121234\u22125678'],
    ['a phone with katakana middle dots', '010\u30fb1234\u30fb5678'],
    ['a phone with tildes', '010~1234~5678'],
    ['a phone with wave dashes', '010\u301c1234\u301c5678'],
    ['a full-width phone with full-width hyphens', '\uff10\uff11\uff10\uff0d\uff11\uff12\uff13\uff14\uff0d\uff15\uff16\uff17\uff18'],
    ['a phone with full-width commas', '010\uff0c1234\uff0c5678'],
    ['circled digits', '\u24ea\u2460\u2461\u2462\u2463\u2464\u2465'],
    ['superscript digits', '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076'],
    ['subscript digits', '\u2080\u2081\u2082\u2083\u2084\u2085\u2089'],
    ['a combining mark between digits', 'Call 010\u03051234\u03055678'],
    ['a phone next to a date', 'Call 010 2026.10.11'],
    ['a phone glued to a date', '010-2026-10-11'],
    ['a date followed by more digits', 'On 2026.10.11 5678'],
    ['two dates in a row', '2026.10.11 2026.10.12'],
    ['a phone in brackets before a date', 'Call (010) 2026.10.11'],
    ['a date-shaped number that is no date', '2026.13.45'],
    ['a year outside the date range', '1850.10.11'],
  ])('rejects %s', (_name, raw) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'contact' });
  });

  it.each([
    ['six digits 123456'],
    ['Day 3, 4, 5, 6, 7, 8, 9'],
    ['Room 12 at 3 on the 4th'],
    ['See you 2026.10.11'],
    ['See you 2026.10.11.'],
    ['Due (2026.10.11)'],
    ['Class on 2026-10-11 at 3'],
    ['Due 2026/10/11, well done'],
    ['오늘은 2026. 10. 11.'],
    ['On 10/12/2026 we read'],
    ['El 12.10.2026 leímos'],
    ['From 2026-10-11 to 2026-10-18'],
    ['Pages 10~20 and 1,000 words'],
    ['Steps \u2460 read \u2461 write'],
    ['x\u00b2 and H\u2082O'],
  ])('passes %j', (raw) => {
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
    ['a keycap', '1\u20e3'],
    ['a watch', 'a\u231a'],
    ['an hourglass', 'a\u231b'],
    ['fast forward', 'a\u23e9'],
    ['an alarm clock', 'Time \u23f0'],
    ['the end of the clock block', 'a\u23f3'],
    ['pause', 'a\u23f8'],
    ['record', 'a\u23fa'],
    ['a small white square', 'a\u25fd'],
    ['a small black square', 'a\u25fe'],
    ['an arrow pointing up', 'a\u2934'],
    ['an arrow pointing down', 'a\u2935'],
    ['a left arrow', 'a\u2b05'],
    ['a down arrow', 'a\u2b07'],
    ['a large black square', 'a\u2b1b'],
    ['a large white square', 'a\u2b1c'],
    ['a star (U+2B50)', 'Great job \u2b50'],
    ['a circle', 'a\u2b55'],
    ['a wavy dash', 'a\u3030'],
    ['a part alternation mark', 'a\u303d'],
    ['a circled ideograph', 'a\u3297'],
    ['the last circled ideograph', 'a\u3299'],
  ])('rejects %s', (_name, raw) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'emoji' });
  });

  it('passes symbols just outside the ranges', () => {
    expect(checkNoteText('a\u25ff b\u27c0 c\u{1FB00} d\u2319 e\u23fb f\u2b08 g\u2b56 h\u3298').ok).toBe(true);
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

  it.each([
    ['We missed you today'],
    ['We MISSED YOU in class, welcome back'],
    ['I am right behind you'],
    ['Everyone is behind you all the way'],
  ])('passes the warm English phrase on the allow-list: %j', (raw) => {
    expect(checkNoteText(raw).ok).toBe(true);
  });

  it.each([
    ['You missed the quiz', 'missed'],
    ['You missed your chance', 'missed'],
    ['You are behind', 'behind'],
    ['We missed you but you are behind', 'behind'],
    ['Behind your friends', 'behind'],
  ])('still rejects %j next to or near an allowed phrase', (raw, word) => {
    expect(checkNoteText(raw)).toEqual({ ok: false, problem: 'tone', word });
  });

  it('catches a full-width banned word', () => {
    expect(checkNoteText('\uff4c\uff41\uff5a\uff59')).toEqual({ ok: false, problem: 'tone', word: 'lazy' });
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

  const CHAIN = ['note-text.ts', 'banned.ts', 'locales.ts', 'env.ts'];

  function runtimeImports(file: string): string[] {
    const text = readFileSync(join(SRC, file), 'utf8');
    const out: string[] = [];
    // Static imports and re-exports alike; `import type` and `export type` are erased at build time.
    for (const match of text.matchAll(/^(?:import|export)\s+(type\s+)?[^'"]*?from\s+'([^']+)';/gm)) {
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

  it('counts a re-export as a run-time import', () => {
    expect(runtimeImports('index.ts')).toContain('./messages/en');
  });

  it.each(CHAIN)('%s loads nothing dynamically (no import() and no require())', (file) => {
    const text = readFileSync(join(SRC, file), 'utf8');
    expect(/\bimport\s*\(/.test(text)).toBe(false);
    expect(/\brequire\s*\(/.test(text)).toBe(false);
  });
});
