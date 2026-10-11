import type { Story, StoryErratum, StoryFact } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import { buildSourcesView, findFactSection, findSceneSection, type SourcesSection } from '../sources-view';
import { readyStory } from './story-fixture';

function fact(id: string, over: Partial<StoryFact> = {}): StoryFact {
  return {
    id,
    rev: 1,
    scope: 'documented',
    claimEn: `Claim ${id}.`,
    claimKo: '주장',
    sources: [
      { title: `Title ${id}`, publisher: 'Publisher', url: `https://example.org/${id}`, accessed: '2026-10-01', quoteOrLocator: `Locator ${id}` },
    ],
    ...over,
  };
}

function erratum(id: string, date: string, factIds: string[], show = true): StoryErratum {
  return { id, date, kind: 'correction', factIds, summaryEn: `Summary ${id}`, fixedInVer: 2, show };
}

/** Section headings and their rows as compact strings: "fact f1" / "see f1". */
function outline(sections: SourcesSection[]): Array<[string, string[]]> {
  return sections.map((s) => [
    s.heading,
    s.items.map((i) => (i.type === 'fact' ? `fact ${i.fact.id}` : `see ${i.factId}`)),
  ]);
}

describe('buildSourcesView: facts grouped by the first scene that cites them (F-STORY-002 §3.8)', () => {
  it('groups the fixture in scene order across tiers; later citations are "See fact" rows; uncited facts go last', () => {
    const story = readyStory();
    // f3 is cited by scenes (listen s4, read-along s3); make one fact cited only by a check / note.
    story.facts.push(fact('f4'));
    story.cultureNotes[0]!.factIds = ['f4'];
    const v = buildSourcesView(story);
    expect(outline(v.sections)).toEqual([
      ['Scene 1', ['fact f1']],
      ['Scene 2', ['see f1', 'fact f2']],
      ['Scene 3', ['see f1', 'fact f3']],
      ['Scene 4', ['see f3']],
      ['Used in questions and notes', ['fact f4']],
    ]);
    const first = v.sections[0]!;
    expect(first.kind === 'scene' && first.sceneIndex).toBe(0);
    expect(first.kind === 'scene' && first.caption).toBe("A king's wish");
    const see = v.sections[1]!.items[0]!;
    expect(see).toEqual({ type: 'see', factId: 'f1', label: 'See fact f1' });
  });

  it('a fact cited by scenes 2 and 5 sits under Scene 2; Scene 5 shows only the reference (§3.14 #2)', () => {
    const story = readyStory();
    const listen = story.tiers[0]!;
    story.tiers = [listen];
    listen.scenes.forEach((s) => (s.factIds = []));
    listen.scenes[0]!.framing = true;
    listen.scenes[1]!.factIds = ['f3'];
    listen.scenes[4]!.factIds = ['f3'];
    listen.scenes[2]!.factIds = ['f1', 'f1'];
    listen.scenes[3]!.factIds = ['f2'];
    const v = buildSourcesView(story);
    expect(outline(v.sections)).toEqual([
      ['Scene 2', ['fact f3']],
      ['Scene 3', ['fact f1']],
      ['Scene 4', ['fact f2']],
      ['Scene 5', ['see f3']],
    ]);
  });

  it('a section header without an authored caption uses the first six words of the narration', () => {
    const story = readyStory();
    delete story.tiers[0]!.scenes[0]!.captionEn;
    const first = buildSourcesView(story).sections[0]!;
    expect(first.kind === 'scene' && first.caption).toBe('Long ago, King sejong wanted everyone');
  });

  it('ignores a cited id that is not in facts[] (defensive; the schema rejects it)', () => {
    const story = readyStory();
    story.tiers[0]!.scenes[0]!.factIds = ['f99', 'f1'];
    expect(outline(buildSourcesView(story).sections)[0]).toEqual(['Scene 1', ['fact f1']]);
  });
});

describe('buildSourcesView: fact cards', () => {
  it('carries the claim, the Korean claim, the scope label and each source with its label and access date', () => {
    const story = readyStory();
    story.facts[0]!.sources.push({
      title: 'Second', publisher: 'Pub 2', url: 'http://insecure.example.org/x', accessed: '2026-10-02', quoteOrLocator: 'p. 4',
    });
    story.facts[1]!.scope = 'in-the-tale';
    const v = buildSourcesView(story);
    const card = v.sections[0]!.items[0]!;
    if (card.type !== 'fact') throw new Error('expected a fact card');
    expect(card.fact).toMatchObject({
      id: 'f1',
      claimEn: story.facts[0]!.claimEn,
      claimKo: story.facts[0]!.claimKo,
      scope: 'documented',
      scopeLabel: 'What we know',
      sourcesHeading: 'Sources (2)',
      updated: false,
      updatedLabel: null,
    });
    expect(card.fact.sources).toEqual([
      {
        title: 'Hangul, the Korean alphabet',
        publisher: 'Cultural Heritage Administration',
        url: 'https://www.heritage.go.kr/fixture/hangul',
        accessed: '2026-10-09',
        accessedLabel: 'accessed 2026-10-09',
        quoteOrLocator: 'Section: Creation of Hangul',
        label: 'Source 1 of 2: Hangul, the Korean alphabet, Cultural Heritage Administration',
        openable: true,
      },
      expect.objectContaining({ label: 'Source 2 of 2: Second, Pub 2', openable: false }),
    ]);
    const f2 = v.sections[1]!.items[1]!;
    expect(f2.type === 'fact' && f2.fact.scopeLabel).toBe('What the tale says');
  });

  it('Open link is offered only for a link the hand-off accepts (the same isSafeHttpsUrl rule)', () => {
    const story = readyStory();
    const base = story.facts[0]!.sources[0]!;
    story.facts[0]!.sources = [
      { ...base, url: 'https://user:pw@www.heritage.go.kr/a' },
      { ...base, url: 'https://www.heritage.go.kr/a b' },
      { ...base, url: 'HTTPS://WWW.HERITAGE.GO.KR/A' },
      { ...base, url: 'https://www.heritage.go.kr/a' },
    ];
    const card = buildSourcesView(story).sections[0]!.items[0]!;
    if (card.type !== 'fact') throw new Error('expected a fact card');
    expect(card.fact.sources.map((s) => s.openable)).toEqual([false, false, true, true]);
  });

  it('approximations sit under their fact; time-relative ones add the today note; duplicates across tiers show once', () => {
    const story = readyStory();
    story.tiers[1]!.scenes[1]!.approximations = [...story.tiers[0]!.scenes[1]!.approximations];
    story.tiers[1]!.scenes[1]!.approximations.push({ text: 'easy', factIds: ['f2', 'f1'], rationaleEn: 'A plain word.', timeRelative: false });
    const v = buildSourcesView(story);
    const f2 = v.sections[1]!.items[1]!;
    if (f2.type !== 'fact') throw new Error('expected a fact card');
    expect(f2.fact.approximations).toEqual([
      {
        text: 'About 600 years ago',
        rationaleEn: '1446 to 2026 is 580 years; the narration rounds it.',
        timeRelative: true,
        label: 'About “About 600 years ago”: 1446 to 2026 is 580 years; the narration rounds it.',
        note: 'This depends on today’s date.',
      },
      { text: 'easy', rationaleEn: 'A plain word.', timeRelative: false, label: 'About “easy”: A plain word.', note: null },
    ]);
    const f1 = v.sections[0]!.items[0]!;
    expect(f1.type === 'fact' && f1.fact.approximations.map((a) => a.text)).toEqual(['easy']);
  });

  it('a revised fact is tagged Updated with its newest visible erratum date, or plain Updated', () => {
    const story = readyStory();
    story.facts[0]!.rev = 2;
    story.facts[2]!.rev = 3;
    story.errata = [erratum('e1', '2026-09-01', ['f1']), erratum('e2', '2026-10-05', ['f1']), erratum('e3', '2026-10-06', ['f1'], false)];
    const cards = buildSourcesView(story)
      .sections.flatMap((s) => s.items)
      .flatMap((i) => (i.type === 'fact' ? [i.fact] : []));
    const byId = new Map(cards.map((c) => [c.id, c]));
    expect(byId.get('f1')).toMatchObject({ updated: true, updatedLabel: 'Updated 2026-10-05' });
    expect(byId.get('f3')).toMatchObject({ updated: true, updatedLabel: 'Updated' });
    expect(byId.get('f2')).toMatchObject({ updated: false, updatedLabel: null });
  });
});

describe('buildSourcesView: header, corrections, counts', () => {
  it('builds the header lines from the story record', () => {
    const v = buildSourcesView(readyStory());
    expect(v.storyId).toBe('story:hangul-day');
    expect(v.title).toEqual({ ko: '한글날', romanization: 'hangeullal', en: 'Hangul Day' });
    expect(v.referenceDisplay).toBe('Sources: Cultural Heritage Administration, UNESCO, National Institute of Korean Language (test fixture)');
    expect(v.checked).toEqual({
      passes: 3,
      checkedAt: '2026-10-10',
      contentVer: 1,
      scope: 'cluster',
      label: 'Checked in 3 independent passes · last checked 2026-10-10 · story version 1',
      clusterNote: 'These checks covered a group of related stories, not this story alone.',
      notes: 'Test fixture: sources are placeholders and were not re-fetched.',
    });
    expect(v.advisoryNoteEn).toBe('Mentions that most people could not read long ago.');
    // A documented story: no "Traditional tale" pill and no origin notes under it.
    expect(v.traditional).toBe(false);
    expect(v.originNoteEn).toBeNull();
    expect(v.retellingNoteEn).toBeNull();
  });

  it('a story-scope check has no cluster note; one pass reads singular; no advisory means no note', () => {
    const story = readyStory();
    story.verification = { ...story.verification, passes: 1, scope: 'story' };
    story.review.advisory = [];
    const v = buildSourcesView(story);
    expect(v.checked.label).toBe('Checked in 1 independent pass · last checked 2026-10-10 · story version 1');
    expect(v.checked.clusterNote).toBeNull();
    expect(v.advisoryNoteEn).toBeNull();
    story.review.advisory = ['loss'];
    delete story.review.advisoryNoteEn;
    expect(buildSourcesView(story).advisoryNoteEn).toBeNull();
  });

  it('a traditional or adapted tale shows the pill with its origin and retelling notes', () => {
    const story = readyStory();
    story.origin = { type: 'traditional', noteEn: 'A folk tale.', retellingNoteEn: 'One telling of many.' };
    const v = buildSourcesView(story);
    expect(v).toMatchObject({ traditional: true, originNoteEn: 'A folk tale.', retellingNoteEn: 'One telling of many.' });
    story.origin = { type: 'adapted', noteEn: 'Adapted.' };
    expect(buildSourcesView(story)).toMatchObject({ traditional: true, originNoteEn: 'Adapted.', retellingNoteEn: null });
  });

  it('lists only visible errata, newest first (ties: the later entry first), with the facts they concern', () => {
    const story = readyStory();
    story.errata = [
      erratum('e1', '2026-09-01', ['f1']),
      erratum('e2', '2026-10-05', ['f2', 'f9']),
      erratum('e3', '2026-10-05', ['f3']),
      erratum('e4', '2026-12-01', ['f1'], false),
    ];
    const v = buildSourcesView(story);
    expect(v.corrections.map((c) => c.id)).toEqual(['e3', 'e2', 'e1']);
    expect(v.corrections[1]).toEqual({
      id: 'e2',
      date: '2026-10-05',
      summaryEn: 'Summary e2',
      facts: [{ id: 'f2', claimEn: story.facts[1]!.claimEn }],
    });
  });

  it('has no corrections when every erratum is hidden (the fixture), so the screen draws no heading', () => {
    expect(buildSourcesView(readyStory()).corrections).toEqual([]);
  });

  it('counts facts and distinct sources (one URL cited by two facts is one source)', () => {
    const story = readyStory();
    const v = buildSourcesView(story);
    const distinct = new Set(story.facts.flatMap((f) => f.sources.map((s) => s.url))).size;
    expect(v.counts).toEqual({ facts: 3, sources: distinct, label: `3 facts · ${distinct} ${distinct === 1 ? 'source' : 'sources'}` });
    story.facts = [fact('f1')];
    story.tiers.forEach((t) => t.scenes.forEach((s) => (s.factIds = s.factIds.filter((id) => id === 'f1'))));
    expect(buildSourcesView(story).counts.label).toBe('1 fact · 1 source');
    expect(buildSourcesView(story).empty).toBe(false);
  });

  it('a story without facts (cannot be ready; defensive) is empty with the no-sources line', () => {
    const story: Story = { ...readyStory(), facts: [] };
    const v = buildSourcesView(story);
    expect(v.empty).toBe(true);
    expect(v.emptyLabel).toBe('No sources are listed for this story.');
    expect(v.sections).toEqual([]);
    expect(v.counts.label).toBe('0 facts · 0 sources');
  });

  it('is deterministic', () => {
    expect(buildSourcesView(readyStory())).toEqual(buildSourcesView(readyStory()));
  });
});

describe('buildSourcesView: words from the UI locale (learner.story.sources, PR 2.7)', () => {
  it('draws every label from the copy it is given; English by default', () => {
    const en = getMessages('en').learner.story.sources;
    const tagged = {
      ...en,
      sceneHeading: (n: number) => `S${n}`,
      seeFact: (id: string) => `->${id}`,
      usedInQuestions: 'UQ',
      counts: (f: number, s: number) => `${f}/${s}`,
      checked: (p: number, d: string, v: number) => `${p}|${d}|${v}`,
      sourcesHeading: (n: number) => `N${n}`,
      sourceLabel: (i: number, t: number) => `${i}of${t}`,
      accessed: (d: string) => `@${d}`,
      scope: { documented: 'DOC', inTheTale: 'TALE' },
      noSources: 'NONE',
    };
    const story = readyStory();
    story.facts.push(fact('f4'));
    const v = buildSourcesView(story, tagged);
    expect(v.sections.map((s) => s.heading)).toEqual(['S1', 'S2', 'S3', 'S4', 'UQ']);
    expect(v.sections[1]!.items[0]).toEqual({ type: 'see', factId: 'f1', label: '->f1' });
    expect(v.counts.label).toBe('4/6');
    expect(v.checked.label).toBe(`3|2026-10-10|${story.contentVer}`);
    const card = v.sections[0]!.items[0]!;
    expect(card.type === 'fact' && [card.fact.scopeLabel, card.fact.sourcesHeading, card.fact.sources[0]!.label, card.fact.sources[0]!.accessedLabel]).toEqual([
      'DOC',
      'N1',
      '1of1',
      '@2026-10-09',
    ]);
    expect(v.emptyLabel).toBe('NONE');
    expect(buildSourcesView(readyStory()).sections[0]!.heading).toBe('Scene 1');
  });

  it('renders no banned learner word for a real-shaped story (anti-shame scan)', () => {
    const story = readyStory();
    story.facts[0] = { ...story.facts[0]!, rev: 2 };
    story.errata.push(erratum('e2', '2026-10-11', [story.facts[0]!.id]));
    const v = buildSourcesView(story);
    const texts = [
      v.checked.label,
      v.counts.label,
      v.emptyLabel,
      ...v.sections.flatMap((s) => [
        s.heading,
        ...s.items.flatMap((i) =>
          i.type === 'see'
            ? [i.label]
            : [i.fact.scopeLabel, i.fact.sourcesHeading, i.fact.updatedLabel ?? '', ...i.fact.sources.flatMap((x) => [x.label, x.accessedLabel])],
        ),
      ]),
    ];
    expect(texts.length).toBeGreaterThan(10);
    expect(scanLearnerCopy(texts)).toEqual([]);
  });
});

describe('deep links: findFactSection and findSceneSection', () => {
  const story = readyStory();
  story.facts.push(fact('f4'));
  const v = buildSourcesView(story);

  it('finds the card of a fact (never a "See fact" row), including the last bucket', () => {
    expect(findFactSection(v, 'f1')).toEqual({ section: 0, item: 0 });
    expect(findFactSection(v, 'f3')).toEqual({ section: 2, item: 1 });
    expect(findFactSection(v, 'f4')).toEqual({ section: 4, item: 0 });
    expect(findFactSection(v, 'f99')).toBeNull();
  });

  it("finds a scene's section, else the next one with facts, else none", () => {
    expect(findSceneSection(v, 0)).toBe(0);
    expect(findSceneSection(v, 3)).toBe(3);
    const sparse = readyStory();
    sparse.tiers = [sparse.tiers[0]!];
    sparse.tiers[0]!.scenes[1]!.factIds = [];
    sparse.tiers[0]!.scenes[1]!.framing = true;
    const s = buildSourcesView(sparse);
    expect(findSceneSection(s, 1)).toBe(1);
    expect(s.sections[1]!.heading).toBe('Scene 3');
    expect(findSceneSection(s, 7)).toBeNull();
  });
});
