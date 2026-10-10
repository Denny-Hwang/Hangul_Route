import { describe, expect, it } from 'vitest';
import {
  FINAL_JAMO,
  INITIAL_JAMO,
  composeSyllable,
  decomposeSyllable,
  isSyllable,
  romanize,
  romanizeSyllables,
  romanizeWord,
  syllableSplit,
} from '../index';

/** F-CNT-002 §3.2 golden vectors: the converter must reproduce each exactly. */
const GOLDEN: ReadonlyArray<readonly [string, string]> = [
  ['윷놀이', 'yunnori'],
  ['한글날', 'hangeullal'],
  ['케이팝', 'keipap'],
  ['거의', 'geoui'],
  ['설날', 'seollal'],
  ['젓가락', 'jeotgarak'],
  ['세뱃돈', 'sebaetdon'],
  ['벚꽃', 'beotkkot'],
  ['감사합니다', 'gamsahamnida'],
  ['좋아요', 'joayo'],
  ['이름이 뭐예요', 'ireumi mwoyeyo'],
  ['무궁화', 'mugunghwa'],
  ['할아버지', 'harabeoji'],
  ['같이 먹기', 'gachi meokgi'],
  ['손 씻기', 'son ssitgi'],
  ['상 차리기', 'sang charigi'],
  ['잘 먹었습니다', 'jal meogeotseumnida'],
  ['한복 입기', 'hanbok ipgi'],
  ['세배 드리기', 'sebae deurigi'],
  ['떡국 먹기', 'tteokguk meokgi'],
  ['세뱃돈 받기', 'sebaetdon batgi'],
  ['편 가르기', 'pyeon gareugi'],
  ['윷 던지기', 'yut deonjigi'],
  ['말 옮기기', 'mal omgigi'],
  ['승리', 'seungni'],
  ['새해 복 많이 받으세요', 'saehae bok mani badeuseyo'],
  ['종이접기', 'jongijeopgi'],
  ['국립', 'gungnip'],
  ['신라', 'silla'],
  ['학교', 'hakgyo'],
  ['해돋이', 'haedoji'],
  ['좋다', 'jota'],
  ['놓고', 'noko'],
  ['넣는', 'neonneun'],
  ['닭고기', 'dakgogi'],
  ['읽어요', 'ilgeoyo'],
  ['맛있어요', 'masisseoyo'],
  ['부엌에', 'bueoke'],
  ['음악', 'eumak'],
  ['여덟', 'yeodeol'],
  ['강아지', 'gangaji'],
  ['호랑이', 'horangi'],
  ['거의 다 했어', 'geoui da haesseo'],
  ['아깝다', 'akkapda'],
  ['례이', 'ryei'],
  ['예리', 'yeri'],
  // audit strings called out in the spec
  ['금속활자', 'geumsokhwalja'],
  ['풍속화', 'pungsokhwa'],
];

const LETTER_NAMES: ReadonlyArray<readonly [string, string]> = [
  ['기역', 'giyeok'],
  ['니은', 'nieun'],
  ['디귿', 'digeut'],
  ['리을', 'rieul'],
  ['미음', 'mieum'],
  ['비읍', 'bieup'],
  ['시옷', 'siot'],
  ['이응', 'ieung'],
  ['지읒', 'jieut'],
  ['치읓', 'chieut'],
  ['키읔', 'kieuk'],
  ['티읕', 'tieut'],
  ['피읖', 'pieup'],
  ['히읗', 'hieut'],
];

describe('romanization golden vectors (F-CNT-002 3.2)', () => {
  it.each(GOLDEN)('%s -> %s', (ko, rr) => {
    expect(romanize(ko)).toEqual({ text: rr, unknown: [] });
  });

  it.each(LETTER_NAMES)('letter name %s -> %s', (ko, rr) => {
    expect(romanizeWord(ko)).toBe(rr);
  });
});

describe('sound-change rules', () => {
  it('liaison moves a single final onto a following silent initial', () => {
    expect(romanizeWord('음악')).toBe('eumak');
    expect(romanizeWord('옷이')).toBe('osi');
    expect(romanizeWord('꽃이')).toBe('kkochi');
  });

  it('liaison moves only the second part of a compound final', () => {
    expect(romanizeWord('읽어')).toBe('ilgeo');
    expect(romanizeWord('앉아')).toBe('anja');
    expect(romanizeWord('값이')).toBe('gapsi');
  });

  it('a doubled final moves whole (ㄲ, ㅆ)', () => {
    expect(romanizeWord('밖에')).toBe('bakke');
    expect(romanizeWord('있어')).toBe('isseo');
  });

  it('a final ㅇ never moves', () => {
    expect(romanizeWord('강아지')).toBe('gangaji');
  });

  it('ㅎ final aspirates a following plain stop and drops', () => {
    expect(romanizeWord('좋다')).toBe('jota');
    expect(romanizeWord('좋고')).toBe('joko');
    expect(romanizeWord('낳지')).toBe('nachi');
    expect(romanizeWord('좋box')).toBeNull();
    expect(romanizeWord('좋법')).toBe('jopeop');
  });

  it('compound ㅎ finals (ㄶ, ㅀ) aspirate and keep their first part', () => {
    expect(romanizeWord('않고')).toBe('anko');
    expect(romanizeWord('싫다')).toBe('silta');
  });

  it('ㅎ final before a silent initial drops and any remaining final moves', () => {
    expect(romanizeWord('좋아요')).toBe('joayo');
    expect(romanizeWord('많이')).toBe('mani');
    expect(romanizeWord('싫어')).toBe('sireo');
  });

  it('ㅎ final before ㄴ is pronounced ㄴ; compound keeps its remaining final', () => {
    expect(romanizeWord('넣는')).toBe('neonneun');
    expect(romanizeWord('않는')).toBe('anneun');
    expect(romanizeWord('옳네')).toBe('olle');
  });

  it('ㅎ final before another consonant stays a neutralised final', () => {
    expect(romanizeWord('좋소')).toBe('jotso');
  });

  it('a simple stop final keeps a following initial ㅎ (noun convention)', () => {
    expect(romanizeWord('금속활자')).toBe('geumsokhwalja');
    expect(romanizeWord('풍속화')).toBe('pungsokhwa');
    expect(romanizeWord('집현전')).toBe('jiphyeonjeon');
    expect(romanizeWord('축하')).toBe('chukha');
    expect(romanizeWord('입학')).toBe('iphak');
    expect(romanizeWord('꽃한')).toBe('kkothan');
    expect(romanizeWord('낮하')).toBe('natha');
    expect(romanizeWord('몇해')).toBe('myeothae');
    expect(romanizeWord('밖한')).toBe('bakhan');
  });

  it('a compound stop final aspirates a following initial ㅎ (verb and adjective stems)', () => {
    expect(romanizeWord('읽히')).toBe('ilki');
    expect(romanizeWord('밟히')).toBe('balpi');
    expect(romanizeWord('앉히')).toBe('anchi');
    expect(romanizeWord('넓히')).toBe('neolpi');
    expect(romanizeWord('값하')).toBe('gapta');
  });

  it('a non-stop final does not change an initial ㅎ', () => {
    expect(romanizeWord('한히')).toBe('hanhi');
    expect(romanizeWord('말하')).toBe('malha');
  });

  it('ㄷ and ㅌ before 이 palatalise', () => {
    expect(romanizeWord('해돋이')).toBe('haedoji');
    expect(romanizeWord('같이')).toBe('gachi');
    expect(romanizeWord('굳이')).toBe('guji');
    expect(romanizeWord('핥이')).toBe('halchi');
  });

  it('ㄷ and ㅌ before other vowels do not palatalise', () => {
    expect(romanizeWord('같아')).toBe('gata');
    expect(romanizeWord('곧아')).toBe('goda');
  });

  it('finals neutralise to k t p l m n ng', () => {
    expect(romanizeWord('꽃')).toBe('kkot');
    expect(romanizeWord('부엌')).toBe('bueok');
    expect(romanizeWord('앞')).toBe('ap');
    expect(romanizeWord('밖')).toBe('bak');
    expect(romanizeWord('낮')).toBe('nat');
    expect(romanizeWord('달')).toBe('dal');
    expect(romanizeWord('밤')).toBe('bam');
    expect(romanizeWord('산')).toBe('san');
    expect(romanizeWord('강')).toBe('gang');
    expect(romanizeWord('닭')).toBe('dak');
    expect(romanizeWord('삶')).toBe('sam');
    expect(romanizeWord('값')).toBe('gap');
    expect(romanizeWord('여덟')).toBe('yeodeol');
    expect(romanizeWord('핥')).toBe('hal');
    expect(romanizeWord('읊')).toBe('eup');
    expect(romanizeWord('앉')).toBe('an');
    expect(romanizeWord('많')).toBe('man');
    expect(romanizeWord('않')).toBe('an');
    expect(romanizeWord('넓')).toBe('neol');
    expect(romanizeWord('몫')).toBe('mok');
    expect(romanizeWord('옳')).toBe('ol');
    expect(romanizeWord('좋')).toBe('jot');
  });

  it('nasalisation: k t p become ng n m before ㄴ or ㅁ', () => {
    expect(romanizeWord('윷놀이')).toBe('yunnori');
    expect(romanizeWord('국물')).toBe('gungmul');
    expect(romanizeWord('낱말')).toBe('nanmal');
    expect(romanizeWord('입니다')).toBe('imnida');
    expect(romanizeWord('앞마당')).toBe('ammadang');
  });

  it('liquid assimilation: ㄹ after m ng k p t becomes n, then nasalisation follows', () => {
    expect(romanizeWord('심리')).toBe('simni');
    expect(romanizeWord('종로')).toBe('jongno');
    expect(romanizeWord('국립')).toBe('gungnip');
    expect(romanizeWord('합리')).toBe('hamni');
    expect(romanizeWord('몇리')).toBe('myeonni');
  });

  it('liquid assimilation: n before ㄹ and l before ㄴ both become ll', () => {
    expect(romanizeWord('신라')).toBe('silla');
    expect(romanizeWord('한글날')).toBe('hangeullal');
    expect(romanizeWord('설날')).toBe('seollal');
  });

  it('ㄹ is r between vowels and l after a final ㄹ', () => {
    expect(romanizeWord('라면')).toBe('ramyeon');
    expect(romanizeWord('달라')).toBe('dalla');
    expect(romanizeWord('다리')).toBe('dari');
  });

  it('tensification is not marked', () => {
    expect(romanizeWord('학교')).toBe('hakgyo');
    expect(romanizeWord('아깝다')).toBe('akkapda');
    expect(romanizeWord('국밥')).toBe('gukbap');
  });

  it('a neutralised final before a plain consonant is unchanged', () => {
    expect(romanizeWord('젓가락')).toBe('jeotgarak');
  });

  it('one-syllable and empty input', () => {
    expect(romanizeWord('가')).toBe('ga');
    expect(romanizeSyllables('')).toEqual([]);
    expect(romanizeWord('')).toBe('');
  });
});

describe('documented converter limits (known output, a fix is a conscious change)', () => {
  it('does not insert ㄴ in compounds', () => {
    expect(romanizeWord('꽃잎')).toBe('kkochip');
    expect(romanizeWord('솔잎')).toBe('sorip');
    expect(romanizeWord('한여름')).toBe('hanyeoreum');
    expect(romanizeWord('색연필')).toBe('saegyeonpil');
    expect(romanizeWord('담요')).toBe('damyo');
  });

  it('does not know the special final of 밟-', () => {
    expect(romanizeWord('밟다')).toBe('balda');
  });

  it('keeps ㅎ after a simple stop even in a verb', () => {
    expect(romanizeWord('잡혀')).toBe('japhyeo');
  });
});

describe('romanizeSyllables / syllableSplit', () => {
  it('returns one piece per syllable block', () => {
    expect(romanizeSyllables('윷놀이')).toEqual(['yun', 'no', 'ri']);
    expect(romanizeSyllables('한글날')).toEqual(['han', 'geul', 'lal']);
  });

  it('syllableSplit joins pieces with hyphens, following pronunciation', () => {
    expect(syllableSplit('한글날')).toBe('han-geul-lal');
    expect(syllableSplit('음악')).toBe('eu-mak');
    expect(syllableSplit('윷놀이')).toBe('yun-no-ri');
    expect(syllableSplit('강아지')).toBe('gang-a-ji');
  });

  it('returns null when any character is not a syllable block', () => {
    expect(romanizeSyllables('가a')).toBeNull();
    expect(romanizeSyllables('ㄱ')).toBeNull();
    expect(romanizeSyllables('가 나')).toBeNull();
    expect(romanizeSyllables('\u{1F600}')).toBeNull();
    expect(romanizeWord('abc')).toBeNull();
    expect(syllableSplit('한글!')).toBeNull();
  });
});

describe('romanize(text)', () => {
  it('splits on whitespace and joins romanized words with single spaces', () => {
    expect(romanize('  손   씻기 ')).toEqual({ text: 'son ssitgi', unknown: [] });
  });

  it('strips hyphens, sentence punctuation, quotes and apostrophes', () => {
    expect(romanize('“거의!” 다… 했어?')).toEqual({ text: 'geoui da haesseo', unknown: [] });
    expect(romanize('새해 복 많이 받으세요.')).toEqual({ text: 'saehae bok mani badeuseyo', unknown: [] });
    expect(romanize("한·글 ~ '날'")).toEqual({ text: 'hangeul nal', unknown: [] });
    expect(romanize('한-글')).toEqual({ text: 'hangeul', unknown: [] });
  });

  it('returns tokens with non-syllable characters as written, in text and unknown', () => {
    expect(romanize('가 ㄱ abc')).toEqual({ text: 'ga ㄱ abc', unknown: ['ㄱ', 'abc'] });
  });

  it('is empty for empty or punctuation-only input', () => {
    expect(romanize('')).toEqual({ text: '', unknown: [] });
    expect(romanize(' ?! ')).toEqual({ text: '', unknown: [] });
  });

  it('does not apply sandhi across words', () => {
    expect(romanize('꽃 이').text).toBe('kkot i');
    expect(romanize('국 물').text).toBe('guk mul');
  });
});

describe('hangul helpers', () => {
  it('isSyllable accepts exactly the precomposed block range', () => {
    expect(isSyllable('가')).toBe(true);
    expect(isSyllable('힣')).toBe(true);
    expect(isSyllable('ㄱ')).toBe(false);
    expect(isSyllable('a')).toBe(false);
    expect(isSyllable('가나')).toBe(false);
    expect(isSyllable('')).toBe(false);
  });

  it('decomposeSyllable splits initial, medial and final', () => {
    expect(decomposeSyllable('한')).toEqual({ initial: 'ㅎ', medial: 0, final: 'ㄴ' });
    expect(decomposeSyllable('의')).toEqual({ initial: 'ㅇ', medial: 19, final: '' });
    expect(decomposeSyllable('a')).toBeNull();
  });

  it('composeSyllable inverts decomposeSyllable for every block', () => {
    for (let code = 0xac00; code <= 0xd7a3; code++) {
      const ch = String.fromCharCode(code);
      const parts = decomposeSyllable(ch);
      expect(parts && composeSyllable(parts)).toBe(ch);
    }
  });

  it('composeSyllable rejects invalid parts', () => {
    expect(composeSyllable({ initial: 'x', medial: 0, final: '' })).toBeNull();
    expect(composeSyllable({ initial: 'ㄱ', medial: 0, final: 'x' })).toBeNull();
    expect(composeSyllable({ initial: 'ㄱ', medial: 21, final: '' })).toBeNull();
    expect(composeSyllable({ initial: 'ㄱ', medial: -1, final: '' })).toBeNull();
    expect(composeSyllable({ initial: 'ㄱ', medial: 1.5, final: '' })).toBeNull();
  });

  it('tables have the standard sizes', () => {
    expect(INITIAL_JAMO).toHaveLength(19);
    expect(FINAL_JAMO).toHaveLength(28);
  });
});
