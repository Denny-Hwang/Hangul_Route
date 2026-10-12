import { describe, expect, it } from 'vitest';
import {
  CARD_ID_RE,
  STORY_CARD_FACT_MAX_CHARS,
  STORY_CARD_MIN_SOURCES,
  WEB_ADDRESS,
  storyCardId,
  storyCardRarity,
  withoutWebAddresses,
} from '../index';

describe('story card helpers (F-STORY-006 §3.8)', () => {
  it('pins the back-face fact limits', () => {
    expect(STORY_CARD_FACT_MAX_CHARS).toBe(180);
    expect(STORY_CARD_MIN_SOURCES).toBe(2);
  });

  it('names a story card card:story-<slug>, a valid card id', () => {
    expect(storyCardId('story:cheugugi-rain-gauge')).toBe('card:story-cheugugi-rain-gauge');
    expect(storyCardId('story:hangul-day')).toBe('card:story-hangul-day');
    expect(CARD_ID_RE.test(storyCardId('story:sun-and-moon'))).toBe(true);
  });

  it('derives rarity from the recommended stage: 1 common, 2 uncommon, 3 and later rare', () => {
    expect(storyCardRarity(1)).toBe('common');
    expect(storyCardRarity(2)).toBe('uncommon');
    expect([3, 4, 5, 6, 7].map(storyCardRarity)).toEqual(['rare', 'rare', 'rare', 'rare', 'rare']);
  });

  it('withoutWebAddresses drops a host, a path and an emptied gloss, and keeps every name (the real first sources)', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['국가유산청 국가유산포털 (Korea Heritage Service, heritage.go.kr)', '국가유산청 국가유산포털 (Korea Heritage Service)'],
      ['한국학중앙연구원 한국민족문화대백과사전 (encykorea.aks.ac.kr)', '한국학중앙연구원 한국민족문화대백과사전'],
      ['UNESCO Memory of the World (unesco.org)', 'UNESCO Memory of the World'],
      ['국사편찬위원회 조선왕조실록 (sillok.history.go.kr)', '국사편찬위원회 조선왕조실록'],
      ['기상청 국립기상박물관 (science.kma.go.kr/museum)', '기상청 국립기상박물관'],
      ['대한민국 정책브리핑 (korea.kr, 정책뉴스, 2005-04-08)', '대한민국 정책브리핑 (정책뉴스, 2005-04-08)'],
      ['대한민국 정책브리핑 (korea.kr), 문화재청 보도자료 기반', '대한민국 정책브리핑, 문화재청 보도자료 기반'],
      ['박상진 경북대 명예교수, 「박상진 교수의 나무세상」 (treestory.forest.or.kr)', '박상진 경북대 명예교수, 「박상진 교수의 나무세상」'],
      ['국립민속박물관 (National Folk Museum of Korea, nfm.go.kr)', '국립민속박물관 (National Folk Museum of Korea)'],
      ['See https://www.example.com/a?b=c for more', 'See for more'],
      ['www.museum.go.kr', ''],
      ['Cultural Heritage Administration', 'Cultural Heritage Administration'],
      ['St. Mary, U.S. Dept. of State', 'St. Mary, U.S. Dept. of State'],
      ['Hunminjeongeum Haerye (1446)', 'Hunminjeongeum Haerye (1446)'],
    ];
    for (const [raw, shown] of cases) {
      expect(withoutWebAddresses(raw), raw).toBe(shown);
      expect(WEB_ADDRESS.test(shown), shown).toBe(false);
    }
  });
});
