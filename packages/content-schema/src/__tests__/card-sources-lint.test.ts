import { describe, expect, it } from 'vitest';
import { lintCardSources } from '../lesson-lint';

/** F-CURR-002 §5.1, §6.6 and §7.2 (row CM-23): `culture-source` on the back-face facts of the upper-cell cards. */
const FILE = 'apps/mobile/src/content/upper-cell-card-sources.ts';
const KHS = {
  title: '국가무형유산 추석',
  publisher: '국가유산청 (Korea Heritage Service)',
  url: 'https://www.heritage.go.kr/heri/cul/culSelectDetail.do?ccbaKdcd=17',
  accessed: '2026-10-14',
};

describe('lintCardSources (culture-source on cards)', () => {
  it('passes a card with an allowlisted source on its own host, under its name on the access date', () => {
    expect(lintCardSources([{ cardId: 'card:full-moon', sources: [KHS] }], FILE)).toEqual([]);
  });

  it('fails a card with no source, or only sources off the allowlist', () => {
    const none = lintCardSources([{ cardId: 'card:a', sources: [] }], FILE);
    const off = lintCardSources(
      [{ cardId: 'card:b', sources: [{ title: '추석', publisher: 'Academy of Korean Studies', url: 'https://encykorea.aks.ac.kr/Article/E0057862', accessed: '2026-10-14' }] }],
      FILE,
    );
    expect(none).toEqual([expect.objectContaining({ rule: 'culture-source', severity: 'error', file: FILE, path: 'card:a.sources' })]);
    expect(off.map((f) => f.path)).toEqual(['card:b.sources']);
  });

  it('fails an allowlisted name on a host the institution does not run', () => {
    const found = lintCardSources([{ cardId: 'card:c', sources: [{ ...KHS, url: 'https://example.com/chuseok' }] }], FILE);
    expect(found.map((f) => f.path)).toEqual(['card:c.sources']);
  });

  it('names the institution as it was called on the access date', () => {
    const before = { ...KHS, publisher: 'Korea Heritage Service', accessed: '2024-01-10' };
    const after = { ...KHS, publisher: 'Cultural Heritage Administration', accessed: '2026-10-14' };
    const found = lintCardSources([{ cardId: 'card:d', sources: [before, after] }], FILE);
    expect(found.map((f) => [f.path, f.message])).toEqual([
      ['card:d.sources[0].publisher', 'on 2024-01-10 the institution was called the Cultural Heritage Administration (문화재청)'],
      ['card:d.sources[1].publisher', 'on 2026-10-14 the institution was called the Korea Heritage Service (국가유산청)'],
    ]);
  });
});
