import { describe, expect, it } from 'vitest';
import { PSEUDO_LOCALE, pseudoLocalize, pseudoText } from '../pseudo';

describe('pseudoText', () => {
  it('brackets, accents and pads to at least +40%', () => {
    const out = pseudoText('Hello world');
    expect(out.startsWith('[')).toBe(true);
    expect(out.endsWith(']')).toBe(true);
    expect(out).toContain('Hélló wórld');
    const inner = out.slice(1, -1);
    expect(inner.length).toBeGreaterThanOrEqual(Math.ceil('Hello world'.length * 1.4));
    expect(inner.endsWith('~')).toBe(true);
  });

  it('accents every vowel case and leaves digits and punctuation alone', () => {
    expect(pseudoText('aeiouyAEIOUY cnCN 12, !?')).toContain('áéíóúýÁÉÍÓÚÝ çñÇÑ 12, !?');
  });

  it('transforms an empty string to brackets only', () => {
    expect(pseudoText('')).toBe('[]');
  });
});

describe('pseudoLocalize', () => {
  const tree = {
    title: 'Hello',
    nested: { deep: { label: 'Back' } },
    list: ['one', 'two'],
    count: 3,
    flag: true,
    nothing: null,
    plural: (n: number) => `${n} days`,
    greet: (name: string, loud: boolean) => (loud ? `HEY ${name}` : `hi ${name}`),
  };

  it('maps every string, array element and function output', () => {
    const out = pseudoLocalize(tree);
    expect(out.title).toBe(pseudoText('Hello'));
    expect(out.nested.deep.label).toBe(pseudoText('Back'));
    expect(out.list).toEqual([pseudoText('one'), pseudoText('two')]);
    expect(out.plural(3)).toBe(pseudoText('3 days'));
    expect(out.greet('Jin', true)).toBe(pseudoText('HEY Jin'));
    expect(out.count).toBe(3);
    expect(out.flag).toBe(true);
    expect(out.nothing).toBeNull();
  });

  it('does not mutate its input', () => {
    pseudoLocalize(tree);
    expect(tree.title).toBe('Hello');
    expect(tree.plural(2)).toBe('2 days');
  });

  it('exposes the pseudo locale id', () => {
    expect(PSEUDO_LOCALE).toBe('en-XA');
  });
});
