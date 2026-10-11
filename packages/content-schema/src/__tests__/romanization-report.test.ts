import { describe, expect, it } from 'vitest';
import { formatRomanizationFinding, lineOfText, type RomanizationIssue } from '../index';

const issue: RomanizationIssue = {
  rule: 'romanization-mismatch',
  severity: 'error',
  message: '윷놀이: given "yutnori", Revised Romanization is "yunnori"',
  ko: '윷놀이',
  given: 'yutnori',
};

describe('formatRomanizationFinding (F-CNT-002 §3.9)', () => {
  it('prints a GitHub annotation line with file, line, rule and message', () => {
    expect(formatRomanizationFinding('apps/mobile/src/content/heritage-cards.ts', 62, issue)).toBe(
      '::error file=apps/mobile/src/content/heritage-cards.ts,line=62::romanization-mismatch: ' + issue.message,
    );
  });

  it('omits the line when it is unknown', () => {
    expect(formatRomanizationFinding('content/a.json', undefined, issue)).toBe(
      '::error file=content/a.json::romanization-mismatch: ' + issue.message,
    );
  });

  it('uses a warning annotation for a warning', () => {
    expect(formatRomanizationFinding('content/a.json', 3, { ...issue, severity: 'warning' }).startsWith('::warning file=')).toBe(true);
  });
});

describe('lineOfText', () => {
  const source = ['a', "b '윷놀이'", 'c 윷놀이', ''].join('\n');

  it('returns the 1-based line of the first occurrence', () => {
    expect(lineOfText(source, '윷놀이')).toBe(2);
    expect(lineOfText(source, 'c ')).toBe(3);
  });

  it('returns undefined when the text is absent', () => {
    expect(lineOfText(source, '한글날')).toBeUndefined();
  });
});
