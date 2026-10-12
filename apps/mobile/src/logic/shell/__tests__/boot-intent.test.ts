import { describe, expect, it } from 'vitest';
import { parseBootIntent } from '../boot-intent';

/**
 * F-APP-001 section 3.9 (PIN path in the learner app) and section 3.11 (boot intents): the
 * learner root reads `gate=grown-up&next=` once, keeps every other query key (the `?lang=`
 * hand-off among them) and takes `next` only when `safeNextPath` accepts it.
 */
describe('parseBootIntent', () => {
  it('gate=grown-up with a grown-up next is the PIN path to that page', () => {
    expect(parseBootIntent('?gate=grown-up&next=%2Fparent')).toEqual({
      intent: { kind: 'grown-up', next: '/parent' },
      search: '',
      changed: true,
    });
    expect(parseBootIntent('?gate=grown-up&next=/teach/space?id=sp_1').intent).toEqual({ kind: 'grown-up', next: '/teach/space?id=sp_1' });
  });

  it('keeps the query of next, escapes included (the console encodes it once)', () => {
    const next = '/teach/space/learner?id=sp_1&learner=lr_2&period=week';
    expect(parseBootIntent(`?gate=grown-up&next=${encodeURIComponent(next)}`).intent).toEqual({ kind: 'grown-up', next });
    const escaped = '/account/billing?checkout=a%3Ab%26c';
    expect(parseBootIntent(`?gate=grown-up&next=${encodeURIComponent(escaped)}`).intent).toEqual({ kind: 'grown-up', next: escaped });
  });

  it('drops a fragment from next', () => {
    expect(parseBootIntent(`?gate=grown-up&next=${encodeURIComponent('/parent#x')}`).intent).toEqual({ kind: 'grown-up', next: '/parent' });
  });

  it('a next that safeNextPath refuses gives no intent, and both keys still leave the address', () => {
    for (const next of ['https://evil.example', '//evil.example', '/', '/browse', '/teacher', '/\\evil', 'javascript:alert(1)', '/teach/../x', '%2F%2Fevil.example', 'x'.repeat(600)]) {
      const parsed = parseBootIntent(`?gate=grown-up&next=${encodeURIComponent(next)}`);
      expect(parsed.intent, next).toBeNull();
      expect(parsed.search, next).toBe('');
      expect(parsed.changed, next).toBe(true);
    }
  });

  it('gate=grown-up without next gives no intent and is removed', () => {
    expect(parseBootIntent('?gate=grown-up')).toEqual({ intent: null, search: '', changed: true });
    expect(parseBootIntent('?gate=grown-up&next=')).toEqual({ intent: null, search: '', changed: true });
  });

  it('leaves lang untouched for the locale hand-off, and keeps other keys in order', () => {
    const parsed = parseBootIntent('?lang=es&gate=grown-up&next=%2Fparent&from=site');
    expect(parsed.intent).toEqual({ kind: 'grown-up', next: '/parent' });
    expect(parsed.search).toBe('?lang=es&from=site');
    expect(new URLSearchParams(parsed.search).get('lang')).toBe('es');
  });

  it('removes every copy of gate and next, and takes the first next', () => {
    const parsed = parseBootIntent('?gate=grown-up&next=%2Fparent&next=%2Fteach&gate=grown-up');
    expect(parsed.intent).toEqual({ kind: 'grown-up', next: '/parent' });
    expect(parsed.search).toBe('');
  });

  it('ignores unknown keys and unknown gate values: nothing read, nothing removed', () => {
    for (const search of ['', '?', '?lang=ko', '?next=%2Fparent', '?gate=other&next=%2Fparent', '?gate=Grown-up&next=%2Fparent', '?x=1&y=2']) {
      const parsed = parseBootIntent(search);
      expect(parsed.intent, search).toBeNull();
      expect(parsed.changed, search).toBe(false);
      expect(parsed.search, search).toBe(search);
    }
  });

  it('accepts a search without the leading question mark', () => {
    expect(parseBootIntent('gate=grown-up&next=%2Fsignin').intent).toEqual({ kind: 'grown-up', next: '/signin' });
  });
});
