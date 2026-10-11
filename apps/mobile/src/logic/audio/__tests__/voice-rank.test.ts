import { describe, expect, it } from 'vitest';
import {
  KO_EXCLUDED_NAMES,
  effectiveQuality,
  normLang,
  pickVoice,
  rankVoices,
  type VoiceCandidate,
} from '../voice-rank';

function v(over: Partial<VoiceCandidate> & Pick<VoiceCandidate, 'id' | 'name'>): VoiceCandidate {
  return { lang: 'ko-KR', local: true, isDefault: false, quality: 'standard', ...over };
}

/** The real `say -v '?'` ko_KR list, in macOS order (novelty voices first, Yuna last). */
const MAC_KO: VoiceCandidate[] = [
  'Eddy (한국어(한국))',
  'Flo (한국어(한국))',
  'Grandma (한국어(한국))',
  'Grandpa (한국어(한국))',
  'Reed (한국어(한국))',
  'Rocko (한국어(한국))',
  'Sandy (한국어(한국))',
  'Shelley (한국어(한국))',
  'Yuna',
].map((name) => v({ id: `mac:${name}`, name, lang: 'ko_KR' }));

describe('normLang', () => {
  it('lower-cases, trims and turns an underscore into a hyphen', () => {
    expect(normLang('ko_KR')).toBe('ko-kr');
    expect(normLang('  KO-kr ')).toBe('ko-kr');
    expect(normLang('es_419')).toBe('es-419');
  });
});

describe('rankVoices: Korean eligibility', () => {
  it('picks Yuna from the real macOS list and excludes all eight novelty voices', () => {
    const ranked = rankVoices(MAC_KO, 'ko-KR', { online: true });
    expect(ranked.map((x) => x.name)).toEqual(['Yuna']);
    expect(pickVoice(MAC_KO, 'ko-KR', { online: true })?.name).toBe('Yuna');
  });

  it('lists exactly the eight novelty names', () => {
    expect([...KO_EXCLUDED_NAMES].sort()).toEqual(
      ['Eddy', 'Flo', 'Grandma', 'Grandpa', 'Reed', 'Rocko', 'Sandy', 'Shelley'],
    );
  });

  it('never selects a novelty voice even when it is the only Korean voice', () => {
    const only = MAC_KO.slice(0, 8);
    expect(rankVoices(only, 'ko-KR', { online: true })).toEqual([]);
    expect(pickVoice(only, 'ko-KR', { online: true })).toBeNull();
  });

  it('matches a novelty name as a leading word only, bare or with a suffix', () => {
    const bare = v({ id: 'a', name: 'Flo' });
    const longer = v({ id: 'b', name: 'Floyd' });
    const notLeading = v({ id: 'c', name: 'Google Eddy' });
    const ranked = rankVoices([bare, longer, notLeading], 'ko-KR', { online: true }).map((x) => x.id);
    expect(ranked).not.toContain('a');
    expect(ranked).toContain('b');
    expect(ranked).toContain('c');
  });

  it('never makes a non-Korean voice eligible for Korean', () => {
    const list = [v({ id: 'en', name: 'Samantha', lang: 'en-US' }), v({ id: 'ja', name: 'Kyoko', lang: 'ja-JP' })];
    expect(rankVoices(list, 'ko-KR', { online: true })).toEqual([]);
  });

  it('accepts a bare "ko" or a "ko-*" language but not a different language that starts with k', () => {
    const list = [
      v({ id: 'ko', name: 'Plain', lang: 'ko' }),
      v({ id: 'kok', name: 'Konkani', lang: 'kok-IN' }),
      v({ id: 'kp', name: 'North', lang: 'ko-KP' }),
    ];
    expect(rankVoices(list, 'ko-KR', { online: true }).map((x) => x.id).sort()).toEqual(['ko', 'kp']);
  });

  it('offline excludes every local:false voice, keeps local:null and local:true', () => {
    const net = v({ id: 'net', name: 'Google 한국의', local: false });
    const unknown = v({ id: 'unk', name: 'Mystery', local: null });
    const local = v({ id: 'loc', name: 'Yuna', local: true });
    expect(rankVoices([net, unknown, local], 'ko-KR', { online: false }).map((x) => x.id)).toEqual(['loc', 'unk']);
    expect(rankVoices([net, unknown, local], 'ko-KR', { online: true }).map((x) => x.id)).toEqual(['loc', 'net', 'unk']);
  });
});

describe('rankVoices: score', () => {
  it('known-good names outrank everything else, including a premium unknown voice', () => {
    const premium = v({ id: 'p', name: 'Mystery', quality: 'premium', isDefault: true });
    const yuna = v({ id: 'y', name: 'Yuna' });
    expect(rankVoices([premium, yuna], 'ko-KR', { online: true })[0]?.id).toBe('y');
  });

  it.each([
    ['Yuna'],
    ['yuna'],
    ['Yuna (Premium)'],
    ['유나'],
    ['유나 (향상됨)'],
    ['Google 한국의'],
    ['Google한국어'],
    ['Microsoft SunHi Online (Natural) - Korean (Korea)'],
    ['Microsoft InJoon'],
    ['Microsoft Heami Desktop'],
  ])('%s is a known-good name', (name) => {
    const other = v({ id: 'z', name: 'Mystery', quality: 'premium' });
    const good = v({ id: 'k', name });
    expect(rankVoices([other, good], 'ko-KR', { online: true })[0]?.id).toBe('k');
  });

  it('does not treat an ASCII superstring of Yuna as known-good', () => {
    const other = v({ id: 'z', name: 'Mystery', quality: 'premium' });
    const fake = v({ id: 'k', name: 'Yunalesca' });
    expect(rankVoices([fake, other], 'ko-KR', { online: true })[0]?.id).toBe('z');
  });

  it('orders premium > enhanced > default-flagged > local > the rest', () => {
    const rest = v({ id: '5', name: 'A', local: false });
    const local = v({ id: '4', name: 'B', local: true });
    const def = v({ id: '3', name: 'C', local: false, isDefault: true });
    const enh = v({ id: '2', name: 'D', local: false, quality: 'enhanced' });
    const prem = v({ id: '1', name: 'E', local: false, quality: 'premium' });
    const ranked = rankVoices([rest, local, def, enh, prem], 'ko-KR', { online: true });
    expect(ranked.map((x) => x.id)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('prefers an exact ko-KR tag over a prefix match when all else is equal', () => {
    const prefix = v({ id: 'a', name: 'A', lang: 'ko' });
    const exact = v({ id: 'b', name: 'B', lang: 'ko_KR' });
    expect(rankVoices([prefix, exact], 'ko-KR', { online: true }).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('breaks ties by id ascending so the result is deterministic', () => {
    const a = v({ id: 'b-id', name: 'Same' });
    const b = v({ id: 'a-id', name: 'Same' });
    expect(rankVoices([a, b], 'ko-KR', { online: true }).map((x) => x.id)).toEqual(['a-id', 'b-id']);
    expect(rankVoices([b, a], 'ko-KR', { online: true }).map((x) => x.id)).toEqual(['a-id', 'b-id']);
  });

  it('does not mutate its input', () => {
    const input = [...MAC_KO];
    rankVoices(input, 'ko-KR', { online: true });
    expect(input).toEqual(MAC_KO);
  });
});

describe('effectiveQuality', () => {
  it('keeps the engine value and upgrades a standard voice by its name', () => {
    expect(effectiveQuality(v({ id: '1', name: 'X', quality: 'premium' }))).toBe('premium');
    expect(effectiveQuality(v({ id: '2', name: 'X (Premium)' }))).toBe('premium');
    expect(effectiveQuality(v({ id: '3', name: 'X (Enhanced)' }))).toBe('enhanced');
    expect(effectiveQuality(v({ id: '4', name: 'X (프리미엄)' }))).toBe('premium');
    expect(effectiveQuality(v({ id: '5', name: 'X (향상됨)' }))).toBe('enhanced');
    expect(effectiveQuality(v({ id: '6', name: 'X' }))).toBe('standard');
  });

  it('never downgrades the engine quality because of the name', () => {
    expect(effectiveQuality(v({ id: '1', name: 'X (Enhanced)', quality: 'premium' }))).toBe('premium');
    expect(effectiveQuality(v({ id: '2', name: 'X', quality: 'enhanced' }))).toBe('enhanced');
  });

  it('ranks a premium-by-name voice above a plain default voice (iOS reports Premium as Default)', () => {
    const named = v({ id: 'n', name: 'Somebody (Premium)' });
    const plain = v({ id: 'p', name: 'Somebody', isDefault: true });
    expect(rankVoices([plain, named], 'ko-KR', { online: true })[0]?.id).toBe('n');
  });
});

describe('rankVoices: other languages', () => {
  const es = [
    v({ id: 'any', name: 'Other', lang: 'es-ES' }),
    v({ id: '419', name: 'Latam', lang: 'es_419' }),
    v({ id: 'mx', name: 'Mexico', lang: 'es-MX' }),
    v({ id: 'us', name: 'Estados', lang: 'es-US' }),
    v({ id: 'en', name: 'English', lang: 'en-US' }),
  ];

  it('es-US prefers es-us, es-mx, es-419, then any es-*, and never a non-Spanish voice', () => {
    expect(rankVoices(es, 'es-US', { online: true }).map((x) => x.id)).toEqual(['us', 'mx', '419', 'any']);
  });

  it('en-US prefers en-us then any en-*; the Korean exclusion list does not apply', () => {
    const list = [
      v({ id: 'gb', name: 'Daniel', lang: 'en-GB' }),
      v({ id: 'us', name: 'Samantha', lang: 'en-US' }),
      v({ id: 'flo', name: 'Flo', lang: 'en-US' }),
      v({ id: 'ko', name: 'Yuna', lang: 'ko-KR' }),
    ];
    expect(rankVoices(list, 'en-US', { online: true }).map((x) => x.id)).toEqual(['flo', 'us', 'gb']);
  });

  it('known-good Korean names give no bonus to other languages', () => {
    const list = [
      v({ id: 'a', name: 'Yuna', lang: 'en-US' }),
      v({ id: 'b', name: 'Other', lang: 'en-US', isDefault: true }),
    ];
    expect(rankVoices(list, 'en-US', { online: true })[0]?.id).toBe('b');
  });
});
