import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTHORITATIVE_HOST_SUFFIXES,
  SOURCE_HOST_ALLOWLIST,
  isAllowlistedHost,
  isAuthoritativeHost,
  lintStory,
  lintStoryCorpus,
  parseStory,
  type Finding,
  type Story,
  type StoryScene,
} from '../index';
import draftJson from '../__fixtures__/story/valid.draft.json';
import readyJson from '../__fixtures__/story/valid.ready.json';
import taleJson from '../__fixtures__/story/valid.tale.json';
import numbersJson from '../__fixtures__/story/research-numbers.json';

const TODAY = '2026-10-10';
const ctx = { today: TODAY };

/** A fixture with the correct option moved so no tier is skewed (the fixtures put it first). */
const spread = (json: unknown): Story => {
  const story = structuredClone(parseStory(json));
  for (const tier of story.tiers) {
    tier.checks.forEach((check, i) => {
      const at = check.options.findIndex((o) => o.isCorrect);
      const [correct] = check.options.splice(at, 1);
      check.options.splice(Math.min([1, 0, 1][i % 3]!, check.options.length), 0, correct!);
    });
  }
  return story;
};
const ready = (): Story => spread(readyJson);
const draft = (): Story => spread(draftJson);
const tale = (): Story => spread(taleJson);

const lint = (story: Story, extra: { today?: string } = {}): Finding[] =>
  lintStory(story, { ...ctx, ...extra });
const hits = (findings: Finding[], rule: string): Finding[] => findings.filter((f) => f.rule === rule);
const errors = (findings: Finding[]): Finding[] => findings.filter((f) => f.level === 'error');

const withStory = (mutate: (s: Story) => void, make: () => Story = ready): Story => {
  const story = make();
  mutate(story);
  return story;
};
const scene = (story: Story, index: number, tier = 0): StoryScene => story.tiers[tier]!.scenes[index]!;
const NO_FACT_SCENE = 2; // "Look at the first consonant, {kw:jamo-g}." has no number

describe('story-sources', () => {
  it('seeds the allow-list with the 31 hosts of the research set, sorted and unique', () => {
    expect(SOURCE_HOST_ALLOWLIST).toHaveLength(31);
    expect(new Set(SOURCE_HOST_ALLOWLIST).size).toBe(31);
    expect([...SOURCE_HOST_ALLOWLIST]).toEqual([...SOURCE_HOST_ALLOWLIST].sort());
    expect(SOURCE_HOST_ALLOWLIST).toContain('www.heritage.go.kr');
  });

  it('pins the authoritative suffixes of the research brief', () => {
    expect(AUTHORITATIVE_HOST_SUFFIXES).toEqual([
      '.go.kr',
      'unesco.org',
      'encykorea.aks.ac.kr',
      'itkc.or.kr',
      'snu.ac.kr',
    ]);
  });

  it.each([
    'sillok.history.go.kr',
    'www.heritage.go.kr',
    'unesco.org',
    'whc.unesco.org',
    'WWW.UNESCO.ORG',
    'encykorea.aks.ac.kr',
    'db.itkc.or.kr',
    'kyujanggak.snu.ac.kr',
  ])('treats %s as authoritative', (host) => {
    expect(isAuthoritativeHost(host)).toBe(true);
  });

  it.each([
    'evilunesco.org',
    'unesco.org.evil.com',
    'go.kr.evil.com',
    'news.sbs.co.kr',
    'www.gutenberg.org',
    'aks.ac.kr',
    'example.com',
  ])('does not treat %s as authoritative', (host) => {
    expect(isAuthoritativeHost(host)).toBe(false);
  });

  it('matches the allow-list exactly and ignores case', () => {
    expect(isAllowlistedHost('www.khs.go.kr')).toBe(true);
    expect(isAllowlistedHost('WWW.KHS.GO.KR')).toBe(true);
    expect(isAllowlistedHost('khs.go.kr')).toBe(false);
  });
});

describe('lintStory: the valid fixtures', () => {
  it('reports only the time-relative warning on the ready fixture', () => {
    const findings = lint(ready());
    expect(errors(findings)).toEqual([]);
    expect(findings.map((f) => f.rule)).toEqual(['approximation-time-relative']);
    expect(findings[0]).toMatchObject({
      level: 'warning',
      path: 'tiers[0].scenes[1].approximations[0]',
    });
  });

  it('reports no error on the draft and tale fixtures', () => {
    expect(errors(lint(draft()))).toEqual([]);
    expect(errors(lint(tale()))).toEqual([]);
  });

  it('returns findings with a rule, level, JSON path and message', () => {
    const story = withStory((s) => {
      s.tiers[0]!.scenes[NO_FACT_SCENE]!.factIds = [];
    });
    const [finding] = hits(lint(story), 'scene-without-fact');
    expect(finding).toEqual({
      rule: 'scene-without-fact',
      level: 'error',
      path: 'tiers[0].scenes[2].factIds',
      message: expect.stringContaining('non-framing scene'),
    });
  });
});

describe('lint date (HANGUL_ROUTE_TODAY)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
  const accessedFuture = (s: Story): void => {
    s.facts[0]!.sources[0]!.accessed = '2026-10-11';
  };

  it('uses ctx.today first', () => {
    vi.stubEnv('HANGUL_ROUTE_TODAY', '2027-01-01');
    expect(hits(lintStory(withStory(accessedFuture), { today: '2026-10-10' }), 'source-accessed-invalid')).toHaveLength(1);
  });

  it('falls back to HANGUL_ROUTE_TODAY', () => {
    vi.stubEnv('HANGUL_ROUTE_TODAY', '2026-10-10');
    expect(hits(lintStory(withStory(accessedFuture)), 'source-accessed-invalid')).toHaveLength(1);
    vi.stubEnv('HANGUL_ROUTE_TODAY', '2026-10-11');
    expect(hits(lintStory(withStory(accessedFuture)), 'source-accessed-invalid')).toHaveLength(0);
  });

  it('falls back to the current UTC date when the variable is absent or malformed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T23:59:00Z'));
    vi.stubEnv('HANGUL_ROUTE_TODAY', '');
    expect(hits(lintStory(withStory(accessedFuture)), 'source-accessed-invalid')).toHaveLength(1);
    vi.stubEnv('HANGUL_ROUTE_TODAY', 'tomorrow');
    expect(hits(lintStory(withStory(accessedFuture)), 'source-accessed-invalid')).toHaveLength(1);
    vi.setSystemTime(new Date('2026-10-11T00:00:00Z'));
    expect(hits(lintStory(withStory(accessedFuture)), 'source-accessed-invalid')).toHaveLength(0);
  });
});

describe('narration length and tokens (S)', () => {
  it('flags more than 45 words, counting a token as one word', () => {
    const long = `${Array.from({ length: 44 }, () => 'go').join(' ')} {kw:sejong}`;
    expect(hits(lint(withStory((s) => (scene(s, 0).narrationEn = long))), 'narration-too-long')).toHaveLength(0);
    const tooLong = `${long} more`;
    const [finding] = hits(lint(withStory((s) => (scene(s, 0).narrationEn = tooLong))), 'narration-too-long');
    expect(finding).toMatchObject({ level: 'error', path: 'tiers[0].scenes[0].narrationEn' });
  });

  it('flags more than 320 characters', () => {
    const wide = withStory((s) => (scene(s, 0).narrationEn = 'x'.repeat(321)));
    expect(hits(lint(wide), 'narration-too-long')).toHaveLength(1);
    const edge = withStory((s) => (scene(s, 0).narrationEn = 'x'.repeat(320)));
    expect(hits(lint(edge), 'narration-too-long')).toHaveLength(0);
  });

  it('flags a token that names no keyword, once per unknown id', () => {
    const story = withStory((s) => (scene(s, 0).narrationEn = '{kw:nope} and {kw:sejong} and {kw:nope} and {kw:other}'));
    const found = hits(lint(story), 'narration-token-unknown');
    expect(found.map((f) => f.message)).toEqual([
      expect.stringContaining('nope'),
      expect.stringContaining('other'),
    ]);
    expect(found[0]).toMatchObject({ level: 'error', path: 'tiers[0].scenes[0].narrationEn' });
  });

  it('flags a brace outside a token', () => {
    for (const text of ['Hello { there', 'x } y', 'King {kw:sejong} {extra}', '{kw:Sejong} said']) {
      const found = hits(lint(withStory((s) => (scene(s, 0).narrationEn = text))), 'narration-brace');
      expect(found, text).toHaveLength(1);
    }
    expect(hits(lint(ready()), 'narration-brace')).toEqual([]);
  });
});

describe('C1 every non-framing scene cites', () => {
  it('flags a scene without a fact, but not a framing scene', () => {
    const story = withStory((s) => (scene(s, NO_FACT_SCENE).factIds = []));
    expect(hits(lint(story), 'scene-without-fact').map((f) => f.path)).toEqual(['tiers[0].scenes[2].factIds']);
    expect(hits(lint(ready()), 'scene-without-fact')).toEqual([]);
  });

  const framingScenes = (count: number, total: number): Story =>
    withStory((s) => {
      const tier = s.tiers[0]!;
      const clone = (i: number): StoryScene => ({
        ...structuredClone(scene(s, NO_FACT_SCENE)),
        id: `s${i + 1}`,
        narrationEn: 'Hoya waves hello.',
        factIds: [],
        framing: false,
      });
      tier.scenes = Array.from({ length: total }, (_, i) => clone(i));
      tier.scenes.forEach((sc, i) => {
        sc.framing = i < count;
        sc.factIds = i < count ? [] : ['f1'];
      });
      tier.sequenceSceneIds = ['s1', 's2', 's3', 's4'];
      tier.newKeywordIds = [];
      s.coverSceneId = 's1';
    });

  it('allows two framing scenes and at most 25 % of a tier', () => {
    expect(hits(lint(framingScenes(2, 8)), 'framing-scene-limit')).toEqual([]);
    expect(hits(lint(framingScenes(1, 4)), 'framing-scene-limit')).toEqual([]);
  });

  it('flags more than two framing scenes or more than a quarter of the tier', () => {
    const three = hits(lint(framingScenes(3, 8)), 'framing-scene-limit');
    expect(three).toHaveLength(1);
    expect(three[0]).toMatchObject({ level: 'error', path: 'tiers[0].scenes' });
    expect(hits(lint(framingScenes(2, 5)), 'framing-scene-limit')).toHaveLength(1);
  });

  it('limits each tier on its own', () => {
    const story = withStory((s) => {
      const second = s.tiers[1]!;
      second.scenes.forEach((sc) => {
        sc.framing = true;
        sc.factIds = [];
        sc.narrationEn = 'Hoya waves hello.';
      });
    });
    expect(hits(lint(story), 'framing-scene-limit').map((f) => f.path)).toEqual(['tiers[1].scenes']);
  });

  it('rejects a claim in a framing scene: a digit, a number word or a term token', () => {
    const framing = (text: string): Story =>
      withStory((s) => {
        Object.assign(scene(s, 4), { narrationEn: text, framing: true, factIds: [] });
      });
    expect(hits(lint(framing('Hoya counts 3 stars.')), 'framing-scene-with-claim')).toHaveLength(1);
    expect(hits(lint(framing('Hoya counts three stars.')), 'framing-scene-with-claim')).toHaveLength(1);
    const term = hits(lint(framing('Hoya greets {kw:sejong}!')), 'framing-scene-with-claim');
    expect(term).toHaveLength(1);
    expect(term[0]).toMatchObject({ level: 'error', path: 'tiers[0].scenes[4].narrationEn' });
    expect(hits(lint(framing('Hoya cheers: {kw:hangeullal-chukahaeyo}!')), 'framing-scene-with-claim')).toEqual([]);
    expect(hits(lint(framing('Hoya greets {kw:ghost}!')), 'framing-scene-with-claim')).toEqual([]);
    expect(hits(lint(ready()), 'framing-scene-with-claim')).toEqual([]);
  });

  it('does not treat the one-word "one" as a claim', () => {
    const story = withStory((s) => {
      Object.assign(scene(s, 4), { narrationEn: 'Hoya has one more question.', framing: true, factIds: [] });
    });
    expect(hits(lint(story), 'framing-scene-with-claim')).toEqual([]);
  });
});

describe('C2 every reference resolves', () => {
  it('flags an unknown fact in a scene, a check, a checkpoint, a culture note and an approximation', () => {
    const story = withStory((s) => {
      scene(s, 0).factIds = ['f9'];
      s.tiers[0]!.checks[0]!.factIds = ['f8'];
      s.tiers[0]!.checkpoints[0]!.factIds = ['f7'];
      s.cultureNotes[0]!.factIds = ['f6'];
      scene(s, 1).approximations[0]!.factIds = ['f5'];
    });
    const paths = hits(lint(story), 'fact-unknown').map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'tiers[0].scenes[0].factIds[0]',
        'tiers[0].checks[0].factIds[0]',
        'tiers[0].checkpoints[0].factIds[0]',
        'cultureNotes[0].factIds[0]',
        'tiers[0].scenes[1].approximations[0].factIds[0]',
      ]),
    );
    expect(paths).toHaveLength(5);
    expect(hits(lint(ready()), 'fact-unknown')).toEqual([]);
  });

  it('warns on a fact that nothing cites', () => {
    const story = withStory((s) => {
      s.facts.push({ ...structuredClone(s.facts[0]!), id: 'f4' });
    });
    const [finding] = hits(lint(story), 'fact-unused');
    expect(finding).toMatchObject({ level: 'warning', path: 'facts[3]' });
    expect(hits(lint(ready()), 'fact-unused')).toEqual([]);
  });

  it('counts a culture note, a check, an approximation and the card as use', () => {
    const story = withStory((s) => {
      s.facts.push({ ...structuredClone(s.facts[0]!), id: 'f4' }, { ...structuredClone(s.facts[0]!), id: 'f5' });
      s.facts.push({ ...structuredClone(s.facts[0]!), id: 'f6' }, { ...structuredClone(s.facts[0]!), id: 'f7' });
      s.cultureNotes[0]!.factIds.push('f4');
      s.tiers[0]!.checkpoints[0]!.factIds = ['f5'];
      scene(s, 1).approximations[0]!.factIds.push('f6');
      s.card = { titleEn: 'Card', keywordId: 'hangeul', factId: 'f7' };
    });
    expect(hits(lint(story), 'fact-unused')).toEqual([]);
  });
});

describe('C3 every fact is sourced by an authoritative host', () => {
  const setSources = (urls: string[]) => (s: Story) => {
    const base = s.facts[1]!.sources[0]!;
    s.facts[1]!.sources = urls.map((url) => ({ ...base, url }));
  };

  it('flags a fact with no authoritative source, and accepts one authoritative among others', () => {
    const none = withStory(setSources(['https://www.gutenberg.org/a', 'https://news.sbs.co.kr/b']));
    const [finding] = hits(lint(none), 'fact-no-authoritative-source');
    expect(finding).toMatchObject({ level: 'error', path: 'facts[1].sources' });
    const mixed = withStory(setSources(['https://www.gutenberg.org/a', 'https://whc.unesco.org/b']));
    expect(hits(lint(mixed), 'fact-no-authoritative-source')).toEqual([]);
    const lookalike = withStory(setSources(['https://evilunesco.org/a', 'https://go.kr.evil.com/b']));
    expect(hits(lint(lookalike), 'fact-no-authoritative-source')).toHaveLength(1);
  });

  it('judges the host of a URL that does not parse as not authoritative', () => {
    const story = withStory(setSources(['not a url', 'https://whc.unesco.org/b']));
    expect(hits(lint(story), 'fact-no-authoritative-source')).toEqual([]);
    const bad = withStory(setSources(['not a url', 'also not']));
    expect(hits(lint(bad), 'fact-no-authoritative-source')).toHaveLength(1);
  });

  it('requires two sources for a fact whose claim has a digit', () => {
    const story = withStory((s) => {
      s.facts[2]!.sources = s.facts[2]!.sources.slice(0, 1);
    });
    const [finding] = hits(lint(story), 'fact-numeric-single-source');
    expect(finding).toMatchObject({ level: 'error', path: 'facts[2].sources' });
  });

  it('accepts one source when the claim has no digit', () => {
    expect(ready().facts[0]!.sources).toHaveLength(1);
    expect(hits(lint(ready()), 'fact-numeric-single-source')).toEqual([]);
  });
});

describe('C4 sources are well-formed', () => {
  const source = (s: Story) => s.facts[0]!.sources[0]!;
  const urlFinding = (url: string): Finding[] =>
    hits(lint(withStory((s) => (source(s).url = url))), 'source-url-not-https');

  it('rejects a non-https scheme', () => {
    const [finding] = urlFinding('http://treestory.forest.or.kr/page');
    expect(finding).toMatchObject({ level: 'error', path: 'facts[0].sources[0].url' });
    expect(urlFinding('ftp://www.heritage.go.kr/a')).toHaveLength(1);
  });

  it('rejects a URL that does not parse, one with whitespace and localhost', () => {
    expect(urlFinding('not a url')).toHaveLength(1);
    expect(urlFinding('notaurl')).toHaveLength(1);
    expect(urlFinding('https:///no-host')).toHaveLength(1);
    expect(urlFinding('https://www.heritage.go.kr/a b')).toHaveLength(1);
    expect(urlFinding(' https://www.heritage.go.kr/a')).toHaveLength(1);
    expect(urlFinding('https://localhost/a')).toHaveLength(1);
    expect(urlFinding('https://LOCALHOST:3000/a')).toHaveLength(1);
  });

  it('accepts an https URL on a real host', () => {
    expect(urlFinding('https://www.heritage.go.kr/a?b=c#d')).toEqual([]);
  });

  const accessed = (value: string, today = TODAY): Finding[] =>
    hits(lint(withStory((s) => (source(s).accessed = value)), { today }), 'source-accessed-invalid');

  it('rejects an accessed date that is not real, in the future or before 2026-01-01', () => {
    const [finding] = accessed('2026-02-30');
    expect(finding).toMatchObject({ level: 'error', path: 'facts[0].sources[0].accessed' });
    expect(accessed('2026-13-01')).toHaveLength(1);
    expect(accessed('soon')).toHaveLength(1);
    expect(accessed('2025-12-31')).toHaveLength(1);
    expect(accessed('2026-10-11')).toHaveLength(1);
  });

  it('accepts the boundary dates', () => {
    expect(accessed('2026-01-01')).toEqual([]);
    expect(accessed('2026-10-10')).toEqual([]);
    expect(accessed('2026-02-28')).toEqual([]);
  });

  const stale = (value: string, today: string): Finding[] =>
    hits(lint(withStory((s) => (source(s).accessed = value)), { today }), 'source-stale').filter(
      (f) => f.path === 'facts[0].sources[0].accessed',
    );

  it('warns when the access is older than 365 days, not at exactly 365', () => {
    const [finding] = stale('2026-10-09', '2027-10-11');
    expect(finding).toMatchObject({ level: 'warning', path: 'facts[0].sources[0].accessed' });
    expect(stale('2026-10-09', '2027-10-10')).toHaveLength(1);
    expect(stale('2026-10-09', '2027-10-09')).toEqual([]);
  });

  it('does not report stale for an access date it already rejected', () => {
    expect(stale('2026-02-30', '2030-01-01')).toEqual([]);
    expect(stale('2025-06-01', '2030-01-01')).toEqual([]);
  });

  it('warns about a host outside the allow-list, once per source, but only for parseable URLs', () => {
    const unlisted = withStory((s) => (source(s).url = 'https://new.go.kr/page'));
    const [finding] = hits(lint(unlisted), 'source-host-unlisted');
    expect(finding).toMatchObject({ level: 'warning', path: 'facts[0].sources[0].url' });
    expect(hits(lint(ready()), 'source-host-unlisted')).toEqual([]);
    const broken = withStory((s) => (source(s).url = 'not a url'));
    expect(hits(lint(broken), 'source-host-unlisted')).toEqual([]);
  });
});

describe('C5 numbers echo', () => {
  const numberRules = ['narration-number-unsupported', 'narration-approximation-unmarked'];
  const sceneZero = (findings: Finding[], rule: string): Finding[] =>
    hits(findings, rule).filter((f) => f.path.startsWith('tiers[0].scenes[0]'));

  it('accepts a numeral that a cited fact states, ignoring commas and trailing punctuation', () => {
    const story = withStory((s) => {
      s.facts[0]!.claimEn = 'The book had 1,200 pages and was read in 3.5 hours.';
      scene(s, 0).narrationEn = 'It had 1200 pages, took 3.5 hours, and ended on page 1,200.';
    });
    expect(sceneZero(lint(story), 'narration-number-unsupported')).toEqual([]);
  });

  it('flags a numeral that no cited fact states, once per distinct numeral', () => {
    const story = withStory((s) => {
      scene(s, 0).narrationEn = 'In 1443 and again in 1443, 28 letters were made, then 9.';
    });
    const found = sceneZero(lint(story), 'narration-number-unsupported');
    expect(found.map((f) => f.message)).toEqual([
      expect.stringContaining('1443'),
      expect.stringContaining('28'),
      expect.stringContaining('9'),
    ]);
    expect(found[0]).toMatchObject({ level: 'error', path: 'tiers[0].scenes[0].narrationEn' });
  });

  it('does not match a numeral against part of a longer number in a fact', () => {
    const story = withStory((s) => {
      s.facts[0]!.claimEn = 'It happened in 1237.';
      scene(s, 0).narrationEn = 'It happened in 12.';
    });
    expect(sceneZero(lint(story), 'narration-number-unsupported')).toHaveLength(1);
  });

  it('does not read numbers inside a token id', () => {
    const story = withStory((s) => {
      s.keywords[0]!.id = 'sejong-2';
      scene(s, 0).narrationEn = 'King {kw:sejong-2} wanted everyone to learn to read.';
    });
    expect(sceneZero(lint(story), 'narration-number-unsupported')).toEqual([]);
  });

  it('only counts the facts the scene cites', () => {
    const story = withStory((s) => {
      scene(s, 0).narrationEn = 'It was October 9.'; // f3 says so, the scene cites f1
    });
    expect(sceneZero(lint(story), 'narration-number-unsupported')).toHaveLength(1);
    scene(story, 0).factIds = ['f3'];
    expect(sceneZero(lint(story), 'narration-number-unsupported')).toEqual([]);
  });

  describe('approximations', () => {
    const approximated = (extra: Partial<Story['tiers'][0]['scenes'][0]['approximations'][0]> = {}): Story =>
      withStory((s) => {
        scene(s, 0).narrationEn = 'Almost 600 years ago, King {kw:sejong} lived here.';
        scene(s, 0).factIds = ['f1', 'f2'];
        scene(s, 0).approximations = [
          { text: 'Almost 600 years', factIds: ['f2'], rationaleEn: '1446 to 2026 is 580 years.', timeRelative: false, ...extra },
        ];
      });

    it('flags an unmarked approximation, and clears both rules with an entry', () => {
      const unmarked = withStory((s) => {
        scene(s, 0).narrationEn = 'Almost 600 years ago, King {kw:sejong} lived here.';
      });
      const found = lint(unmarked);
      expect(sceneZero(found, 'narration-number-unsupported')).toHaveLength(1);
      const [marker] = sceneZero(found, 'narration-approximation-unmarked');
      expect(marker).toMatchObject({ level: 'error', path: 'tiers[0].scenes[0].narrationEn' });

      const marked = lint(approximated());
      expect(sceneZero(marked, 'narration-number-unsupported')).toEqual([]);
      expect(sceneZero(marked, 'narration-approximation-unmarked')).toEqual([]);
      expect(hits(marked, 'approximation-text-missing')).toEqual([]);
    });

    it.each(['nearly', 'about', 'around', 'over', 'more than'])('recognises the cue "%s" and number words', (cue) => {
      const story = withStory((s) => {
        scene(s, 0).narrationEn = `It lasted ${cue} 300 years and ${cue} three years.`;
      });
      expect(sceneZero(lint(story), 'narration-approximation-unmarked')).toHaveLength(2);
    });

    it('does not read a plain "in 300 years" or "300 years" as an approximation', () => {
      const story = withStory((s) => {
        scene(s, 0).narrationEn = 'It lasted 300 years, the Almost Famous band said.';
      });
      expect(sceneZero(lint(story), 'narration-approximation-unmarked')).toEqual([]);
    });

    it('marks a number-word approximation with an entry', () => {
      const story = withStory((s) => {
        scene(s, 0).narrationEn = 'About three years ago, King {kw:sejong} lived here.';
        scene(s, 0).factIds = ['f1', 'f2'];
        scene(s, 0).approximations = [
          { text: 'About three years', factIds: ['f2'], rationaleEn: 'Rounded.', timeRelative: false },
        ];
      });
      const found = lint(story);
      expect(sceneZero(found, 'narration-approximation-unmarked')).toEqual([]);
      expect(sceneZero(found, 'narration-number-word-unmatched')).toEqual([]);
    });

    it('rejects an entry whose text is not in the narration, and it covers nothing', () => {
      const story = approximated({ text: 'Almost 700 years' });
      const found = lint(story);
      const [missing] = hits(found, 'approximation-text-missing');
      expect(missing).toMatchObject({ level: 'error', path: 'tiers[0].scenes[0].approximations[0].text' });
      expect(sceneZero(found, 'narration-number-unsupported')).toHaveLength(1);
      expect(sceneZero(found, 'narration-approximation-unmarked')).toHaveLength(1);
    });

    it('does not let an approximation cover a number when its facts are not cited by the scene', () => {
      const story = approximated({ factIds: ['f3'] });
      expect(sceneZero(lint(story), 'narration-number-unsupported')).toHaveLength(1);
    });

    it('does not let an approximation cover a different number', () => {
      const story = withStory((s) => {
        scene(s, 0).narrationEn = 'Almost 600 years ago, in 1443, King {kw:sejong} lived here.';
        scene(s, 0).factIds = ['f1', 'f2'];
        scene(s, 0).approximations = [
          { text: 'Almost 600 years', factIds: ['f2'], rationaleEn: 'Rounded.', timeRelative: false },
        ];
      });
      const unsupported = sceneZero(lint(story), 'narration-number-unsupported');
      expect(unsupported.map((f) => f.message)).toEqual([expect.stringContaining('1443')]);
    });

    it('warns on a time-relative approximation every run', () => {
      const found = sceneZero(lint(approximated({ timeRelative: true })), 'approximation-time-relative');
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        level: 'warning',
        path: 'tiers[0].scenes[0].approximations[0]',
      });
      expect(sceneZero(lint(approximated()), 'approximation-time-relative')).toEqual([]);
    });
  });

  describe('number words', () => {
    const words = (text: string, claim: string): Finding[] =>
      sceneZero(
        lint(
          withStory((s) => {
            s.facts[0]!.claimEn = claim;
            scene(s, 0).narrationEn = text;
          }),
        ),
        'narration-number-word-unmatched',
      );

    it('warns on a number word no cited fact echoes, once per word', () => {
      const found = words('Three stars and three moons and twelve birds.', 'King Sejong led the work.');
      expect(found.map((f) => f.message)).toEqual([
        expect.stringContaining('three'),
        expect.stringContaining('twelve'),
      ]);
      expect(found[0]).toMatchObject({ level: 'warning', path: 'tiers[0].scenes[0].narrationEn' });
    });

    it('accepts the word or its numeral in a cited fact', () => {
      expect(words('Three stars.', 'There were three stars.')).toEqual([]);
      expect(words('Three stars.', 'There were 3 stars.')).toEqual([]);
      expect(words('Twenty stars and a hundred more.', 'There were 20 stars and one hundred more.')).toEqual([]);
    });

    it('does not match inside another word, and ignores "one"', () => {
      expect(words('The fourth king, a tenth, and one more.', 'A king.')).toEqual([]);
    });
  });

  it('flags exactly the four real sentences of the research set', () => {
    for (const c of numbersJson.cases) {
      const story = withStory((s) => {
        const source = s.facts[0]!.sources[0]!;
        s.facts = c.facts.map((claimEn, i) => ({
          id: `f${i + 1}`,
          rev: 1,
          scope: 'documented' as const,
          claimEn,
          claimKo: '근거',
          sources: [source, source],
        }));
        scene(s, 0).narrationEn = c.narrationEn;
        scene(s, 0).factIds = s.facts.map((f) => f.id);
        scene(s, 0).approximations = [];
      });
      const found = lint(story);
      const unsupported = sceneZero(found, 'narration-number-unsupported').map((f) => f.message);
      expect(unsupported, c.episode).toHaveLength(c.unsupported.length);
      c.unsupported.forEach((n, i) => expect(unsupported[i], c.episode).toContain(n));
      expect(sceneZero(found, 'narration-approximation-unmarked'), c.episode).toHaveLength(c.unmarked ? 1 : 0);
    }
    expect(numbersJson.cases).toHaveLength(4);
    expect(numberRules).toHaveLength(2);
  });
});

describe('C7 checks cite too', () => {
  it('flags a check or checkpoint without a fact', () => {
    const story = withStory((s) => {
      s.tiers[0]!.checks[1]!.factIds = [];
      s.tiers[0]!.checkpoints[0]!.factIds = [];
    });
    expect(hits(lint(story), 'check-without-fact').map((f) => f.path)).toEqual([
      'tiers[0].checks[1].factIds',
      'tiers[0].checkpoints[0].factIds',
    ]);
    expect(hits(lint(ready()), 'check-without-fact')).toEqual([]);
  });
});

describe('tale rules T1-T3 and tale facts', () => {
  it('T1: tale kinds and traditional/adapted origins go together', () => {
    expect(hits(lint(tale()), 'tale-kind-origin-mismatch')).toEqual([]);
    expect(hits(lint(ready()), 'tale-kind-origin-mismatch')).toEqual([]);
    const kindOnly = withStory((s) => (s.origin.type = 'documented'), tale);
    expect(hits(lint(kindOnly), 'tale-kind-origin-mismatch')[0]).toMatchObject({
      level: 'error',
      path: 'origin.type',
    });
    const originOnly = withStory((s) => (s.origin.type = 'traditional'));
    expect(hits(lint(originOnly), 'tale-kind-origin-mismatch')).toHaveLength(1);
    const adapted = withStory((s) => {
      s.kind = 'myth';
      s.origin.type = 'adapted';
    });
    expect(hits(lint(adapted), 'tale-kind-origin-mismatch')).toEqual([]);
    const original = withStory((s) => {
      s.kind = 'fable';
      s.origin.type = 'original';
    });
    expect(hits(lint(original), 'tale-kind-origin-mismatch')).toHaveLength(1);
  });

  it('T2: the first scene of a traditional story names a tale word', () => {
    expect(hits(lint(tale()), 'tale-first-scene-unframed')).toEqual([]);
    const unframed = withStory((s) => (scene(s, 0).narrationEn = 'A brother and sister ran from a tiger.'), tale);
    const [finding] = hits(lint(unframed), 'tale-first-scene-unframed');
    expect(finding).toMatchObject({ level: 'error', path: 'tiers[0].scenes[0].narrationEn' });
    for (const word of ['tale', 'story', 'legend', 'myth', 'fable', 'folk', 'song', 'Tale', 'tales', 'stories']) {
      const framed = withStory((s) => (scene(s, 0).narrationEn = `This is an old ${word} of Korea.`), tale);
      expect(hits(lint(framed), 'tale-first-scene-unframed'), word).toEqual([]);
    }
    const partial = withStory((s) => (scene(s, 0).narrationEn = 'This is a storybook of Korea.'), tale);
    expect(hits(lint(partial), 'tale-first-scene-unframed')).toHaveLength(1);
  });

  it('T2: checks the first scene of every tier, and applies to adapted stories only when traditional or adapted', () => {
    const second = withStory((s) => {
      const extra = structuredClone(s.tiers[0]!);
      extra.level = 'read-along';
      extra.scenes[0]!.narrationEn = 'A brother and sister ran from a tiger.';
      s.tiers.push(extra);
    }, tale);
    expect(hits(lint(second), 'tale-first-scene-unframed').map((f) => f.path)).toEqual([
      'tiers[1].scenes[0].narrationEn',
    ]);
    const documented = withStory((s) => (scene(s, 0).narrationEn = 'A king sat in the hall.'));
    expect(hits(lint(documented), 'tale-first-scene-unframed')).toEqual([]);
  });

  it('T3: a traditional or adapted story has a retelling note', () => {
    expect(hits(lint(tale()), 'tale-without-retelling-note')).toEqual([]);
    const missing = withStory((s) => delete s.origin.retellingNoteEn, tale);
    expect(hits(lint(missing), 'tale-without-retelling-note')[0]).toMatchObject({
      level: 'error',
      path: 'origin.retellingNoteEn',
    });
    const adapted = withStory((s) => {
      s.origin.type = 'adapted';
      delete s.origin.retellingNoteEn;
    }, tale);
    expect(hits(lint(adapted), 'tale-without-retelling-note')).toHaveLength(1);
    const documented = withStory((s) => delete s.origin.retellingNoteEn);
    expect(hits(lint(documented), 'tale-without-retelling-note')).toEqual([]);
  });

  it('flags a four-digit year in an in-the-tale fact only', () => {
    const dated = withStory((s) => (s.facts[0]!.claimEn = 'In 1950 a brother and sister escaped.'), tale);
    expect(hits(lint(dated), 'tale-fact-with-date')[0]).toMatchObject({
      level: 'error',
      path: 'facts[0].claimEn',
    });
    const documented = withStory((s) => (s.facts[0]!.claimEn = 'In 1950 a brother and sister escaped.'));
    expect(hits(lint(documented), 'tale-fact-with-date')).toEqual([]);
    const small = withStory((s) => (s.facts[0]!.claimEn = 'A brother and 28 stars; page 12345.'), tale);
    expect(hits(lint(small), 'tale-fact-with-date')).toEqual([]);
  });

  it('warns when a tale-kind story states only documented facts', () => {
    const allDocumented = withStory((s) => (s.facts[0]!.scope = 'documented'), tale);
    expect(hits(lint(allDocumented), 'tale-facts-all-documented')[0]).toMatchObject({
      level: 'warning',
      path: 'facts',
    });
    expect(hits(lint(tale()), 'tale-facts-all-documented')).toEqual([]);
    expect(hits(lint(ready()), 'tale-facts-all-documented')).toEqual([]);
  });
});

describe('checks: answer position, options, explanations', () => {
  const setCorrect = (s: Story, tier: number, indexes: number[]): void => {
    s.tiers[tier]!.checks.forEach((check, i) => {
      check.options.forEach((o, oi) => (o.isCorrect = oi === indexes[i]));
    });
  };

  it('flags a tier whose correct option is first in every check, or at one index in every check', () => {
    const first = withStory((s) => setCorrect(s, 0, [0, 0, 0]));
    const [finding] = hits(lint(first), 'check-answer-position-skew');
    expect(finding).toMatchObject({ level: 'error', path: 'tiers[0].checks' });
    expect(finding!.message).toContain('index 0');
    const same = withStory((s) => setCorrect(s, 0, [1, 1, 1]));
    expect(hits(lint(same), 'check-answer-position-skew')[0]!.message).toContain('index 1');
    const varied = withStory((s) => setCorrect(s, 0, [0, 1, 0]));
    expect(hits(lint(varied), 'check-answer-position-skew')).toEqual([]);
  });

  it('needs at least three checks in the tier', () => {
    const story = withStory((s) => {
      s.tiers[0]!.checks = s.tiers[0]!.checks.slice(0, 2);
      setCorrect(s, 0, [0, 0]);
    });
    expect(hits(lint(story), 'check-answer-position-skew')).toEqual([]);
  });

  it('warns on an option longer than 70 characters, in checks and checkpoints', () => {
    const story = withStory((s) => {
      s.tiers[0]!.checks[0]!.options[0]!.en = 'x'.repeat(71);
      s.tiers[0]!.checkpoints[0]!.options[0]!.en = 'y'.repeat(71);
      s.tiers[0]!.checks[1]!.options[0]!.en = 'z'.repeat(70);
    });
    const found = hits(lint(story), 'check-option-long');
    expect(found.map((f) => f.path)).toEqual([
      'tiers[0].checks[0].options[0].en',
      'tiers[0].checkpoints[0].options[0].en',
    ]);
    expect(found[0]!.level).toBe('warning');
  });

  it('ignores an option with no English text', () => {
    const story = withStory((s) => {
      const option = s.tiers[0]!.checks[0]!.options[0]!;
      delete option.en;
      option.art = 'prop:book';
    });
    expect(hits(lint(story), 'check-option-long')).toEqual([]);
  });

  it('requires an explanation on a ready story, for checks and checkpoints', () => {
    const story = withStory((s) => {
      delete s.tiers[0]!.checks[0]!.explainEn;
      delete s.tiers[0]!.checkpoints[0]!.explainEn;
    });
    const found = hits(lint(story), 'check-explain-missing');
    expect(found.map((f) => f.path)).toEqual([
      'tiers[0].checks[0].explainEn',
      'tiers[0].checkpoints[0].explainEn',
    ]);
    expect(found[0]!.level).toBe('error');
    expect(hits(lint(draft()), 'check-explain-missing')).toEqual([]);
  });
});

describe('corpus answer position', () => {
  const allFirst = (story: Story): Story =>
    withStory((s) => {
      for (const tier of s.tiers) for (const c of tier.checks) c.options.forEach((o, i) => (o.isCorrect = i === 0));
    }, () => structuredClone(story));
  const noneFirst = (story: Story): Story =>
    withStory((s) => {
      for (const tier of s.tiers) for (const c of tier.checks) c.options.forEach((o, i) => (o.isCorrect = i === 1));
    }, () => structuredClone(story));

  it('passes the ready fixture and an empty corpus', () => {
    expect(lintStoryCorpus([ready()])).toEqual([]);
    expect(lintStoryCorpus([])).toEqual([]);
  });

  it('flags more than half of all checks with the correct option first', () => {
    const found = lintStoryCorpus([allFirst(ready())]);
    expect(found).toEqual([
      {
        rule: 'corpus-answer-index-0-share',
        level: 'error',
        path: '',
        message: expect.stringContaining('6 of 6'),
      },
    ]);
  });

  it('allows exactly half', () => {
    expect(lintStoryCorpus([allFirst(ready()), noneFirst(ready())])).toEqual([]);
    expect(lintStoryCorpus([allFirst(ready()), allFirst(ready()), noneFirst(ready())])).toHaveLength(1);
  });

  it('counts ready stories only', () => {
    const skewedDraft = allFirst(withStory((s) => (s.state = 'draft')));
    expect(lintStoryCorpus([skewedDraft, noneFirst(ready())])).toEqual([]);
    expect(lintStoryCorpus([skewedDraft])).toEqual([]);
  });
});

describe('keywords', () => {
  it('flags a scene keyword that is not in keywords[], or differs on ko or romanization', () => {
    const unknown = withStory((s) => (scene(s, 0).keyword!.id = 'ghost'));
    expect(hits(lint(unknown), 'keyword-inconsistent')[0]).toMatchObject({
      level: 'error',
      path: 'tiers[0].scenes[0].keyword.id',
    });
    const ko = withStory((s) => (scene(s, 0).keyword!.ko = '왕'));
    expect(hits(lint(ko), 'keyword-inconsistent')[0]!.path).toBe('tiers[0].scenes[0].keyword.ko');
    const rr = withStory((s) => (scene(s, 0).keyword!.romanization = 'sejeong'));
    expect(hits(lint(rr), 'keyword-inconsistent')[0]!.path).toBe('tiers[0].scenes[0].keyword.romanization');
  });

  it('ignores case in the romanization and allows a scene-specific gloss', () => {
    const story = withStory((s) => {
      scene(s, 0).keyword!.romanization = 'SEJONG';
      scene(s, 0).keyword!.en = 'a completely different gloss';
    });
    expect(hits(lint(story), 'keyword-inconsistent')).toEqual([]);
    expect(hits(lint(ready()), 'keyword-inconsistent')).toEqual([]);
  });

  it('checks a scene line that quotes a phrase keyword, and ignores other lines', () => {
    const phrase = withStory((s) => {
      Object.assign(scene(s, 4), {
        keyword: undefined,
        line: { ko: '한글날 축하해요', romanization: 'hangeullal chukahaeyo', en: 'Happy Hangul Day', speaker: 'hoya' },
      });
    });
    expect(hits(lint(phrase), 'keyword-inconsistent')).toEqual([]);
    const bad = withStory((s) => {
      Object.assign(scene(s, 4), {
        keyword: undefined,
        line: { ko: '한글날 축하해요', romanization: 'something else', en: 'x', speaker: 'hoya' },
      });
    });
    expect(hits(lint(bad), 'keyword-inconsistent')[0]!.path).toBe('tiers[0].scenes[4].line.romanization');
    const other = withStory((s) => {
      Object.assign(scene(s, 4), {
        keyword: undefined,
        line: { ko: '다른 말', romanization: 'daleun mal', en: 'x', speaker: 'hoya' },
      });
    });
    expect(hits(lint(other), 'keyword-inconsistent')).toEqual([]);
  });

  it('flags two keywords with one id', () => {
    const story = withStory((s) => s.keywords.push({ ...structuredClone(s.keywords[0]!) }));
    expect(hits(lint(story), 'keyword-id-collision')[0]).toMatchObject({
      level: 'error',
      path: 'keywords[5].id',
    });
    expect(hits(lint(ready()), 'keyword-id-collision')).toEqual([]);
  });

  it('warns on an unused keyword of a ready story, not of a draft', () => {
    const extra = (s: Story): void => {
      s.keywords.push({ id: 'spare', ko: '여분', romanization: 'yeobun', en: 'spare', kind: 'word' });
    };
    const found = hits(lint(withStory(extra)), 'keyword-unused');
    expect(found).toEqual([
      expect.objectContaining({ level: 'warning', path: 'keywords[5]' }),
    ]);
    expect(hits(lint(withStory((s) => { extra(s); s.state = 'draft'; })), 'keyword-unused')).toEqual([]);
    expect(hits(lint(ready()), 'keyword-unused')).toEqual([]);
  });

  it('counts a scene keyword, a new-keyword id and the card as use', () => {
    const story = withStory((s) => {
      s.keywords.push(
        { id: 'a1', ko: '하나', romanization: 'hana', en: 'one', kind: 'word' },
        { id: 'a2', ko: '둘', romanization: 'dul', en: 'two', kind: 'word' },
        { id: 'a3', ko: '셋', romanization: 'set', en: 'three', kind: 'word' },
      );
      scene(s, 0).keyword = { id: 'a1', ko: '하나', romanization: 'hana', en: 'one', kind: 'word' };
      s.tiers[0]!.newKeywordIds = ['a2'];
      s.card = { titleEn: 'Card', keywordId: 'a3', factId: 'f3' };
    });
    expect(hits(lint(story), 'keyword-unused')).toEqual([]);
  });
});

describe('ready-only completeness', () => {
  it('flags a missing caption and a missing art on a ready story', () => {
    const story = withStory((s) => {
      delete scene(s, 0).captionEn;
      delete scene(s, 1).art;
    });
    expect(hits(lint(story), 'caption-missing')).toEqual([
      expect.objectContaining({ level: 'error', path: 'tiers[0].scenes[0].captionEn' }),
    ]);
    expect(hits(lint(story), 'art-missing')).toEqual([
      expect.objectContaining({ level: 'error', path: 'tiers[0].scenes[1]' }),
    ]);
  });

  it('accepts artPending in place of art', () => {
    const story = withStory((s) => {
      delete scene(s, 1).art;
      scene(s, 1).artPending = true;
    });
    expect(hits(lint(story), 'art-missing')).toEqual([]);
  });

  it('stays silent on a draft', () => {
    const found = lint(draft());
    for (const rule of ['caption-missing', 'art-missing', 'check-explain-missing', 'culture-note-missing']) {
      expect(hits(found, rule), rule).toEqual([]);
    }
  });

  it('warns when a ready story has no culture notes', () => {
    const story = withStory((s) => {
      s.cultureNotes = [];
      for (const sc of s.tiers.flatMap((t) => t.scenes)) delete sc.cultureNoteId;
    });
    expect(hits(lint(story), 'culture-note-missing')).toEqual([
      expect.objectContaining({ level: 'warning', path: 'cultureNotes' }),
    ]);
    expect(hits(lint(ready()), 'culture-note-missing')).toEqual([]);
  });
});

describe('shelf, review and verification', () => {
  it('shelf-minutes-mismatch', () => {
    const story = withStory((s) => (s.shelf!.minutes = s.minutes + 1));
    expect(hits(lint(story), 'shelf-minutes-mismatch')).toEqual([
      expect.objectContaining({ level: 'error', path: 'shelf.minutes' }),
    ]);
    expect(hits(lint(ready()), 'shelf-minutes-mismatch')).toEqual([]);
    expect(hits(lint(withStory((s) => delete s.shelf)), 'shelf-minutes-mismatch')).toEqual([]);
  });

  it('story-unverified: a shelf needs the minimum number of passes', () => {
    const two = withStory((s) => (s.verification.passes = 2));
    expect(hits(lint(two), 'story-unverified')).toEqual([
      expect.objectContaining({ level: 'error', path: 'verification.passes' }),
    ]);
    expect(hits(lint(ready()), 'story-unverified')).toEqual([]);
    const noShelf = withStory((s) => {
      s.verification.passes = 0;
      delete s.shelf;
    });
    expect(hits(lint(noShelf), 'story-unverified')).toEqual([]);
    const draftShelf = withStory((s) => {
      s.state = 'draft';
      s.verification.passes = 2;
    });
    expect(hits(lint(draftShelf), 'story-unverified')).toHaveLength(1);
  });

  it('review-unsigned: a reviewed state needs initials and a date', () => {
    expect(hits(lint(ready()), 'review-unsigned')).toEqual([]);
    const noInitials = withStory((s) => delete s.review.reviewedBy);
    expect(hits(lint(noInitials), 'review-unsigned')).toEqual([
      expect.objectContaining({ level: 'error', path: 'review' }),
    ]);
    const noDate = withStory((s) => delete s.review.reviewedAt);
    expect(hits(lint(noDate), 'review-unsigned')).toHaveLength(1);
    const cultureOnly = withStory((s) => {
      s.review.language = 'draft';
      delete s.review.reviewedBy;
    });
    expect(hits(lint(cultureOnly), 'review-unsigned')).toHaveLength(1);
    const languageOnly = withStory((s) => {
      s.review.culture = 'draft';
      delete s.review.reviewedAt;
    });
    expect(hits(lint(languageOnly), 'review-unsigned')).toHaveLength(1);
    const unreviewed = withStory((s) => {
      s.review.language = 'draft';
      s.review.culture = 'draft';
      delete s.review.reviewedBy;
      delete s.review.reviewedAt;
    });
    expect(hits(lint(unreviewed), 'review-unsigned')).toEqual([]);
  });
});

describe('style and glosses', () => {
  it('warns on "Hangeul" in English prose but not on the romanization hangeul or Hangeullal', () => {
    const story = withStory((s) => {
      scene(s, 0).narrationEn = 'Today we call these letters Hangeul.';
      scene(s, 1).narrationEn = "It is Hangeul's birthday, Hangeul Day, and Hangeullal.";
      s.summaryEn = 'The Hangeul story.';
      s.title.en = 'Hangeul Day';
      s.hoyaIntroEn = 'Hangeul!';
      s.hoyaOutroEn = 'Hangeul?';
      scene(s, 2).captionEn = 'Hangeul';
      s.tiers[0]!.checks[0]!.promptEn = 'Who made Hangeul?';
      s.tiers[0]!.checks[0]!.explainEn = 'Hangeul was made by the king.';
      s.tiers[0]!.checks[0]!.hintEn = 'Hangeul hint.';
      s.tiers[0]!.checks[0]!.options[0]!.en = 'Hangeul';
      s.cultureNotes[0]!.titleEn = 'Hangeul';
      s.cultureNotes[0]!.bodyEn = 'About Hangeul.';
      s.facts[0]!.claimEn = 'Hangeul was created.';
    });
    const found = hits(lint(story), 'style-script-name');
    expect(found.every((f) => f.level === 'warning')).toBe(true);
    expect(found.map((f) => f.path)).toEqual(
      expect.arrayContaining([
        'title.en',
        'summaryEn',
        'hoyaIntroEn',
        'hoyaOutroEn',
        'tiers[0].scenes[0].narrationEn',
        'tiers[0].scenes[1].narrationEn',
        'tiers[0].scenes[2].captionEn',
        'tiers[0].checks[0].promptEn',
        'tiers[0].checks[0].explainEn',
        'tiers[0].checks[0].hintEn',
        'tiers[0].checks[0].options[0].en',
        'cultureNotes[0].titleEn',
        'cultureNotes[0].bodyEn',
        'facts[0].claimEn',
      ]),
    );
    const clean = withStory((s) => {
      scene(s, 0).narrationEn = 'The word hangeul and Hangeullal and Hangul are fine.';
    });
    expect(hits(lint(clean), 'style-script-name')).toEqual([]);
    expect(hits(lint(ready()), 'style-script-name')).toEqual([]);
  });

  it('flags Hangul in an English gloss', () => {
    const story = withStory((s) => {
      s.title.en = '한글날';
      s.keywords[0]!.en = "horse (말 can also mean 'words')";
      scene(s, 0).keyword!.en = '왕';
      scene(s, 4).line = { ko: '한글날 축하해요', romanization: 'x', en: '축하', speaker: 'hoya', words: [
        { ko: '한글날', romanization: 'hangeullal', en: '한글날' },
        { ko: '축하해요', romanization: 'chukahaeyo', en: 'congratulations' },
      ] };
      s.cultureNotes[0]!.term.en = '날';
    });
    expect(hits(lint(story), 'gloss-contains-hangul').map((f) => f.path)).toEqual([
      'title.en',
      'keywords[0].en',
      'tiers[0].scenes[0].keyword.en',
      'tiers[0].scenes[4].line.en',
      'tiers[0].scenes[4].line.words[0].en',
      'cultureNotes[0].term.en',
    ]);
    expect(hits(lint(ready()), 'gloss-contains-hangul')).toEqual([]);
  });
  it('flags Hangul in a connective gloss and in a check or checkpoint target gloss', () => {
    const story = withStory((s) => {
      const tier = s.tiers[0]!;
      tier.connective = { ko: '그리고', romanization: 'geurigo', en: '그리고' };
      tier.checks[0]!.target = { ko: '왕', romanization: 'wang', en: '왕' };
      tier.checkpoints[0]!.target = { ko: '왕', romanization: 'wang', en: '왕' };
      tier.checks[1]!.target = { ko: '왕', romanization: 'wang', en: 'king' };
    });
    expect(hits(lint(story), 'gloss-contains-hangul').map((f) => f.path)).toEqual([
      'tiers[0].connective.en',
      'tiers[0].checks[0].target.en',
      'tiers[0].checkpoints[0].target.en',
    ]);
  });
});
