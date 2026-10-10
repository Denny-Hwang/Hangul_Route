import { describe, expect, it } from 'vitest';
import type { DeepPartial, Messages, Widen } from '../types';

// The contract is compile-time; `tsc --noEmit` (pnpm typecheck) is the real test.
describe('types', () => {
  it('Widen turns as-const string literals into string', () => {
    const source = { a: 'x', nested: { f: (n: number) => `n${n}` }, list: ['a', 'b'] } as const;
    const widened: Widen<typeof source> = {
      a: 'anything',
      nested: { f: (n: number) => `${n}!` },
      list: ['c'],
    };
    expect(widened.nested.f(1)).toBe('1!');
  });

  it('DeepPartial accepts omitted keys', () => {
    const overlay: DeepPartial<Messages> = {};
    const partial: DeepPartial<Messages> = { common: { buttons: { ok: 'Vale' } } };
    expect(Object.keys(overlay)).toHaveLength(0);
    expect(partial.common?.buttons?.ok).toBe('Vale');
  });

  it('rejects mistyped keys and wrong function arity (excess-property check)', () => {
    // @ts-expect-error -- "okk" is not a key of Messages['common']['buttons']
    const typo = { common: { buttons: { okk: 'Vale' } } } satisfies DeepPartial<Messages>;
    // @ts-expect-error -- a function message must keep English's parameter list
    const arity = { a11y: { stars: (n: string) => n } } satisfies DeepPartial<Messages>;
    // @ts-expect-error -- a string message cannot become a number
    const kind = { common: { buttons: { ok: 3 } } } satisfies DeepPartial<Messages>;
    expect([typo, arity, kind]).toHaveLength(3);
  });
});
