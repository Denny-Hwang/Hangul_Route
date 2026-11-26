// The contrast-set catalogue and its generated module (AMENDMENTS-MINIMAL-PAIRS sections 3.1 and 3.4; row MP-1a): the
// rules of section 3.1 on the committed catalogue (first consonant only, kinds, refs that are manifest rows, no merged
// sound, decodable at the unit's quest), the approval record and its lapse, the generated module and its drift, the
// fixture approvals the e2e build reads in place of the real ones, and the catalogue as a manifest source. No network,
// no audio is played.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AUDIO_PACKS, sayRef } from '@hangul-route/content-schema';
import { afterAll, describe, expect, it } from 'vitest';
import { jamoAll, jamoWordBuilder } from '../../src/content/jamo';
import { stage1Quests } from '../../src/content/quests';
import {
  CONTRAST_SETS_FILE,
  contrastOccurrencesOf,
  contrastUnitInfo,
  isJamoRef,
  parseContrastSets,
  readContrastSets,
} from '../audio/content-sources.mjs';
import {
  CONTRAST_MODULE_FILE,
  E2E_CONTRAST_FIXTURE_FILE,
  approvedOf,
  buildContrastModule,
  lockShaOf,
  renderContrastModule,
  runContrastSets,
  staleApprovalsOf,
} from '../audio/gen-contrast-sets.mjs';
import { MERGED_SOUND_GROUPS } from '../audio/tts/qa-report.mjs';
import { decomposeSyllable, evaluateFrame, evaluatePlayable } from '../audio/tts/qa-lib.mjs';

const APP_ROOT = join(__dirname, '..', '..');
const REPO_ROOT = join(APP_ROOT, '..', '..');
const read = (rel) => JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8'));
const catalogue = readContrastSets(REPO_ROOT);
const manifest = read('content/audio/tts-manifest.json');
const rowByRef = new Map(manifest.rows.map((r) => [r.ref, r]));
const sha = (c) => c.repeat(64);
const tmp = mkdtempSync(join(tmpdir(), 'contrast-sets-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

// Initial indexes of a syllable: ㄱ0 ㄲ1 ㄷ3 ㄸ4 ㅂ7 ㅃ8 ㅅ9 ㅆ10 ㅈ12 ㅉ13 ㅊ14 ㅋ15 ㅌ16 ㅍ17.
const INITIAL_OF_SERIES = { k: { plain: 0, aspirated: 15, tense: 1 }, t: { plain: 3, aspirated: 16, tense: 4 }, p: { plain: 7, aspirated: 17, tense: 8 }, c: { plain: 12, aspirated: 14, tense: 13 }, s: { plain: 9, tense: 10 } };
const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const MEDIALS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const FINALS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const firstOf = (text) => decomposeSyllable([...text][0]);

describe('the catalogue (section 3.1)', () => {
  it('lists the twelve Stage 1 pairs of quest 6 and the six Stage 2 sets, with no approval yet', () => {
    expect(catalogue.sets.map((s) => s.id)).toEqual([
      'ga-ka', 'go-ko', 'gu-ku', 'gi-ki', 'da-ta', 'do-to', 'du-tu', 'di-ti', 'ja-cha', 'jo-cho', 'ju-chu', 'ji-chi',
      'dal-tal-ttal', 'bul-pul-ppul', 'jada-chada-jjada', 'bang-ppang', 'sada-ssada', 'gae-kkae',
    ]);
    for (const set of catalogue.sets) expect(set.approval, set.id).toBeUndefined();
    const stage1 = catalogue.sets.filter((s) => s.unit === 'minigame:s1-life-q3-pairs');
    const stage2 = catalogue.sets.filter((s) => s.unit === 'minigame:s2-letters-q2-pairs');
    expect(stage1).toHaveLength(12);
    expect(stage2).toHaveLength(6);
    expect(stage1.every((s) => s.members.length === 2 && s.members.map((m) => m.kind).join() === 'plain,aspirated')).toBe(true);
    expect(stage2.map((s) => s.members.map((m) => m.text).join(' '))).toEqual(['달 탈 딸', '불 풀 뿔', '자다 차다 짜다', '방 빵', '사다 싸다', '개 깨']);
  });

  it('reads the quest and the pack from the unit name', () => {
    expect(contrastUnitInfo('minigame:s1-life-q3-pairs')).toEqual({ stage: 1, quest: 'quest:stage1-life-q3', pack: 'stage1' });
    expect(contrastUnitInfo('minigame:s2-letters-q2-pairs')).toEqual({ stage: 2, quest: 'quest:stage2-letters-q2', pack: 'stage2' });
    expect(contrastUnitInfo('minigame:s1-life-q3-play')).toBeNull();
    expect(contrastUnitInfo('quest:stage1-life-q3')).toBeNull();
  });

  it('rule 1: the members differ only in the series of the first consonant (spelling, vowel, final, second syllable)', () => {
    for (const set of catalogue.sets) {
      const firsts = set.members.map((m) => firstOf(m.text));
      for (const f of firsts) expect(f, set.id).not.toBeNull();
      expect(new Set(firsts.map((f) => f.v)).size, `${set.id} vowel`).toBe(1);
      expect(new Set(firsts.map((f) => f.t)).size, `${set.id} final`).toBe(1);
      expect(new Set(set.members.map((m) => [...m.text].slice(1).join(''))).size, `${set.id} rest`).toBe(1);
      for (const [i, m] of set.members.entries()) expect(firsts[i].l, `${set.id} ${m.text} is ${m.kind} of series ${set.series}`).toBe(INITIAL_OF_SERIES[set.series][m.kind]);
    }
  });

  it('rule 3: a Stage 1 member is a syllable said as lp.syl writes it; a Stage 2 member is a word with its gloss', () => {
    for (const set of catalogue.sets.filter((s) => contrastUnitInfo(s.unit).stage === 1)) {
      for (const m of set.members) {
        expect([...m.text], m.text).toHaveLength(1);
        expect(m.en).toBe(`the syllable ${m.romanization}`);
        expect(m.romanization).toMatch(/^[a-z]+$/);
      }
    }
    for (const set of catalogue.sets.filter((s) => contrastUnitInfo(s.unit).stage === 2)) {
      for (const m of set.members) expect(m.en, m.text).not.toMatch(/^the syllable/);
    }
  });

  it('rule 5: no merged sound (애 / 에, 얘 / 예, 외 / 왜 / 웨) stands for a member', () => {
    const merged = new Set(MERGED_SOUND_GROUPS.flat());
    for (const set of catalogue.sets) for (const m of set.members) expect(merged.has(m.text), `${set.id} ${m.text}`).toBe(false);
  });

  it('every ref is a manifest row that says the member: a jamo clip for the six Discover sounds, else the text-keyed say clip', () => {
    for (const set of catalogue.sets) {
      for (const m of set.members) {
        const row = rowByRef.get(m.ref);
        expect(row, `${set.id} ${m.text} ${m.ref} is not a manifest row`).toBeDefined();
        expect(row.text).toBe(m.text);
        if (isJamoRef(m.ref)) expect(row.kind).toBe('jamo-sound');
        else expect(m.ref).toBe(sayRef(m.text));
      }
    }
    const jamoMembers = catalogue.sets.flatMap((s) => s.members).filter((m) => isJamoRef(m.ref));
    expect(jamoMembers.map((m) => m.text)).toEqual(['가', '카', '다', '타', '자', '차']);
  });

  it('no clip or text is in two sets', () => {
    const members = catalogue.sets.flatMap((s) => s.members);
    expect(new Set(members.map((m) => m.ref)).size).toBe(members.length);
    expect(new Set(members.map((m) => m.text)).size).toBe(members.length);
  });

  it('rule 2: every letter of every member is taught at or before the quest that plays it (read from the content)', async () => {
    const symbols = new Map([...jamoAll, ...jamoWordBuilder].map((j) => [j.id, j]));
    const taught = { consonant: new Set(), vowel: new Set(), batchim: new Set() };
    const teach = (id) => {
      const j = symbols.get(id);
      if (j === undefined) throw new Error(`unknown symbol ${id}`);
      taught[j.kind].add(j.char);
    };
    const discoverIds = (quest) => quest.steps.flatMap((s) => (s.discover?.pages ?? []).flatMap((p) => p.items.filter((i) => i.type === 'jamo').map((i) => i.jamoId)));
    const stage2 = read('content/episodes/stage-2/letters.json');
    const route = [...stage1Quests, ...stage2.quests];
    const known = (questId) => {
      for (const set of Object.values(taught)) set.clear();
      const index = route.findIndex((q) => q.id === questId);
      expect(index, questId).toBeGreaterThanOrEqual(0);
      for (const quest of route.slice(0, index + 1)) for (const id of discoverIds(quest)) teach(id);
    };
    for (const unit of [...new Set(catalogue.sets.map((s) => s.unit))]) {
      known(contrastUnitInfo(unit).quest);
      for (const set of catalogue.sets.filter((s) => s.unit === unit)) {
        for (const m of set.members) {
          for (const syllable of m.text) {
            const p = decomposeSyllable(syllable);
            const initial = INITIALS[p.l];
            // ㅇ at the start of a block is silent: it needs no lesson of its own.
            expect(initial === 'ㅇ' || taught.consonant.has(initial), `${set.id} ${m.text}: ${initial} is not taught by ${unit}`).toBe(true);
            expect(taught.vowel.has(MEDIALS[p.v]), `${set.id} ${m.text}: ${MEDIALS[p.v]} is not taught by ${unit}`).toBe(true);
            if (p.t !== 0) expect(taught.batchim.has(FINALS[p.t]), `${set.id} ${m.text}: final ${FINALS[p.t]} is not taught by ${unit}`).toBe(true);
          }
        }
      }
    }
  });

  it('on the committed manifest every set passes G3 (one frame) and G6 (its quest loads the packs)', () => {
    for (const set of catalogue.sets) {
      const rows = set.members.map((m) => rowByRef.get(m.ref));
      expect(evaluateFrame(rows), set.id).toMatchObject({ ok: true });
      expect(evaluatePlayable(set, rowByRef, AUDIO_PACKS), set.id).toMatchObject({ ok: true });
    }
  });

  it('the members whose clips are not generated yet are the ones MP-1b generates, and no others', () => {
    const missing = catalogue.sets
      .flatMap((s) => s.members)
      .filter((m) => !existsSync(join(APP_ROOT, 'assets', m.ref)))
      .map((m) => m.text)
      .sort();
    const toGenerate = ['딸', '뿔', '방', '깨', '자다', '차다', '사다', '싸다'].sort();
    for (const text of missing) expect(toGenerate, `${text} has no clip and is not on MP-1b's list`).toContain(text);
  });
});

describe('parseContrastSets', () => {
  const good = { schemaVersion: 1, sets: [{ id: 'ga-ka', series: 'k', unit: 'minigame:s1-life-q3-pairs', members: [
    { text: '가', romanization: 'ga', en: 'the syllable ga', ref: 'audio/jamo/giyeok.mp3', kind: 'plain' },
    { text: '카', romanization: 'ka', en: 'the syllable ka', ref: 'audio/jamo/kieuk.mp3', kind: 'aspirated' },
  ] }] };
  const withSet = (patch) => ({ ...good, sets: [{ ...good.sets[0], ...patch }] });
  const withMember = (i, patch) => withSet({ members: good.sets[0].members.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  it('accepts the shape and the committed file', () => {
    expect(parseContrastSets(good)).toBe(good);
    expect(parseContrastSets(JSON.parse(readFileSync(join(REPO_ROOT, CONTRAST_SETS_FILE), 'utf8')))).toBeTruthy();
  });

  it.each([
    ['a version', { ...good, schemaVersion: 2 }, /schemaVersion/],
    ['no sets', { schemaVersion: 1, sets: [] }, /non-empty/],
    ['an id that is not kebab-case', withSet({ id: 'gaka' }), /kebab-case/],
    ['a series outside k t p c s', withSet({ series: 'x' }), /series/],
    ['a unit of another shape', withSet({ unit: 'minigame:s1-life-q3-play' }), /unit/],
    ['one member', withSet({ members: [good.sets[0].members[0]] }), /two or three/],
    ['a kind outside plain, aspirated, tense', withMember(0, { kind: 'lax' }), /kind/],
    ['a ref that is not a clip', withMember(0, { ref: 'giyeok.mp3' }), /not a clip ref/],
    ['a missing gloss', withMember(0, { en: '' }), /non-empty en/],
    ['an unknown member field', withMember(0, { ipa: 'ka' }), /unknown fields/],
    ['a repeated clip', withMember(1, { ref: 'audio/jamo/giyeok.mp3' }), /repeats/],
    ['an unknown set field', withSet({ note: 'x' }), /unknown fields/],
    ['an approval that does not name every member', withSet({ approval: { date: '2026-11-26', plays: 6, correct: 6, mp3Sha256: { 'audio/jamo/giyeok.mp3': sha('a') } } }), /exactly the members/],
    ['an approval with more correct than plays', withSet({ approval: { date: '2026-11-26', plays: 6, correct: 7, mp3Sha256: {} } }), /correct <= plays/],
    ['a lapse with no reason', withSet({ lapsed: { date: '2026-11-26' } }), /lapsed needs/],
  ])('refuses %s', (_name, json, message) => {
    expect(() => parseContrastSets(json)).toThrow(message);
  });
});

describe('approval and lapse (section 3.4)', () => {
  const set = {
    id: 'ga-ka',
    members: [{ ref: 'audio/jamo/giyeok.mp3' }, { ref: 'audio/jamo/kieuk.mp3' }],
    approval: { date: '2026-11-26', plays: 6, correct: 6, mp3Sha256: { 'audio/jamo/giyeok.mp3': sha('a'), 'audio/jamo/kieuk.mp3': sha('b') } },
  };
  const lockOf = (shas) => ({ schemaVersion: 1, rows: Object.entries(shas).map(([ref, mp3Sha256]) => ({ ref, key: 'k', engine: 'polly', voice: 'Seoyeon', model: 'neural', rate: 0.85, generated: '2026-11-07', saySha256: sha('0'), mp3Sha256 })) });
  const voice = { engine: 'polly', voice: 'Seoyeon' };

  it('is approved only when every member is still the MP3 that was heard', () => {
    const shaOf = lockShaOf(lockOf({ 'audio/jamo/giyeok.mp3': sha('a'), 'audio/jamo/kieuk.mp3': sha('b') }), voice);
    expect(approvedOf(set, shaOf)).toBe(true);
    expect(approvedOf({ ...set, approval: undefined }, shaOf)).toBe(false);
    expect(approvedOf({ ...set, lapsed: { date: '2026-12-01', reason: 'kieuk regenerated' } }, shaOf)).toBe(false);
    expect(approvedOf(set, lockShaOf(lockOf({ 'audio/jamo/giyeok.mp3': sha('a'), 'audio/jamo/kieuk.mp3': sha('c') }), voice))).toBe(false);
    expect(approvedOf(set, lockShaOf(lockOf({ 'audio/jamo/giyeok.mp3': sha('a') }), voice))).toBe(false);
    expect(approvedOf(set, lockShaOf(lockOf({ 'audio/jamo/giyeok.mp3': sha('a'), 'audio/jamo/kieuk.mp3': null }), voice))).toBe(false);
  });

  it('reads the lock of the locked voice only', () => {
    const other = { schemaVersion: 1, rows: [{ ...lockOf({ 'audio/jamo/giyeok.mp3': sha('a') }).rows[0], voice: 'Jihye' }] };
    expect(lockShaOf(other, voice)('audio/jamo/giyeok.mp3')).toBeUndefined();
  });

  it('names an approval whose sha is not the lock any more (the lapse test fails on it until the set is re-listened or lapsed)', () => {
    const shaOf = lockShaOf(lockOf({ 'audio/jamo/giyeok.mp3': sha('a'), 'audio/jamo/kieuk.mp3': sha('c') }), voice);
    expect(staleApprovalsOf([set], shaOf)).toEqual([{ set: 'ga-ka', ref: 'audio/jamo/kieuk.mp3', approved: sha('b'), now: sha('c') }]);
    expect(staleApprovalsOf([{ ...set, lapsed: { date: '2026-12-01', reason: 'x' } }], shaOf)).toEqual([]);
  });

  it('the committed catalogue has no stale approval against the committed lock (and today no approval at all)', () => {
    const lock = read('content/audio/tts-lock.json');
    const voiceLock = read('content/audio/tts-voice-lock.json');
    expect(staleApprovalsOf(catalogue.sets, lockShaOf(lock, voiceLock))).toEqual([]);
  });

  it('renders approved: true only for a set that passes', () => {
    const full = { id: 'ga-ka', series: 'k', unit: 'minigame:s1-life-q3-pairs', members: [
      { text: '가', romanization: 'ga', en: 'the syllable ga', ref: 'audio/jamo/giyeok.mp3', kind: 'plain' },
      { text: '카', romanization: 'ka', en: 'the syllable ka', ref: 'audio/jamo/kieuk.mp3', kind: 'aspirated' },
    ], approval: set.approval };
    const shaOf = lockShaOf(lockOf({ 'audio/jamo/giyeok.mp3': sha('a'), 'audio/jamo/kieuk.mp3': sha('b') }), voice);
    expect(renderContrastModule([full], shaOf)).toContain('approved: true,');
    expect(renderContrastModule([{ ...full, approval: undefined }], shaOf)).toContain('approved: false,');
    expect(renderContrastModule([], shaOf)).toContain('CONTRAST_SETS: readonly ContrastSetEntry[] = [];');
  });
});

describe('the generated module', () => {
  it('is exactly what the generator writes (run audio:map after editing the catalogue or the lock)', () => {
    const { file, source } = buildContrastModule({ root: REPO_ROOT });
    expect(file).toBe(CONTRAST_MODULE_FILE);
    expect(readFileSync(join(APP_ROOT, CONTRAST_MODULE_FILE), 'utf8')).toBe(source);
    expect(runContrastSets({ check: true })).toMatchObject({ ok: true });
  });

  it('lists every set with approved: false while no set has an approval', () => {
    const source = readFileSync(join(APP_ROOT, CONTRAST_MODULE_FILE), 'utf8');
    expect(source.match(/approved: true/g)).toBeNull();
    expect(source.match(/approved: false/g)).toHaveLength(catalogue.sets.length);
    for (const set of catalogue.sets) expect(source).toContain(`id: "${set.id}"`);
  });

  it('is written from the catalogue and the lock only: a copy of the repo with another lock gives another module', () => {
    const root = join(tmp, 'repo');
    mkdirSync(join(root, 'content/audio'), { recursive: true });
    const sets = [{ ...catalogue.sets[0], approval: { date: '2026-11-26', plays: 6, correct: 6, mp3Sha256: { [catalogue.sets[0].members[0].ref]: sha('a'), [catalogue.sets[0].members[1].ref]: sha('b') } } }];
    writeFileSync(join(root, CONTRAST_SETS_FILE), JSON.stringify({ schemaVersion: 1, sets }));
    writeFileSync(join(root, 'content/audio/tts-voice-lock.json'), readFileSync(join(REPO_ROOT, 'content/audio/tts-voice-lock.json')));
    const lock = (a, b) => ({ schemaVersion: 1, rows: sets[0].members.map((m, i) => ({ ref: m.ref, key: 'k', engine: 'polly', voice: 'Seoyeon', model: 'neural', rate: 0.85, generated: '2026-11-07', saySha256: sha('0'), mp3Sha256: i === 0 ? a : b })) });
    writeFileSync(join(root, 'content/audio/tts-lock.json'), JSON.stringify(lock(sha('a'), sha('b'))));
    expect(buildContrastModule({ root }).source).toContain('approved: true,');
    writeFileSync(join(root, 'content/audio/tts-lock.json'), JSON.stringify(lock(sha('a'), sha('c'))));
    expect(buildContrastModule({ root }).source).toContain('approved: false,');
  });

  it('the CLI writes, checks and refuses unknown arguments', () => {
    const run = (...args) => spawnSync(process.execPath, [join(APP_ROOT, 'scripts/audio/gen-contrast-sets.mjs'), ...args], { encoding: 'utf8' });
    const check = run('--check');
    expect(check.status).toBe(0);
    expect(check.stdout).toMatch(/contrast sets up to date/);
    const bad = run('--publish');
    expect(bad.status).toBe(2);
    expect(bad.stderr).toMatch(/usage: gen-contrast-sets\.mjs/);
  });

  it('audio:map checks it too, and holds with the 8 manifest rows that have no clip yet', () => {
    const r = spawnSync(process.execPath, [join(APP_ROOT, 'scripts/audio/gen-audio-map.mjs'), '--check'], { encoding: 'utf8' });
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^audio:map up to date \(\d+ clips\)$/m);
  });
});

describe('the fixture approvals (the e2e build only)', () => {
  const fixture = JSON.parse(readFileSync(join(APP_ROOT, E2E_CONTRAST_FIXTURE_FILE), 'utf8'));
  const fixtureModule = buildContrastModule({ root: REPO_ROOT, withFixtures: true }).source;
  const approvedIds = (source) => [...source.matchAll(/id: "([a-z-]+)",[\s\S]*?approved: (true|false),/g)].filter((m) => m[2] === 'true').map((m) => m[1]);

  it('is a catalogue of sets over fixture clips, each approved by the sha256 of its fixture file', () => {
    const parsed = parseContrastSets(fixture, E2E_CONTRAST_FIXTURE_FILE);
    expect(parsed.sets.map((s) => s.id)).toEqual(['ga-ka', 'da-ta']);
    for (const set of parsed.sets) {
      for (const m of set.members) {
        const file = join(APP_ROOT, 'e2e/fixtures', m.ref);
        expect(existsSync(file), `${file}`).toBe(true);
        expect(set.approval.mp3Sha256[m.ref]).toBe(createHash('sha256').update(readFileSync(file)).digest('hex'));
        // A fixture clip never shadows a shipped one: the ref is in no real set or manifest row.
        expect(rowByRef.has(m.ref)).toBe(false);
      }
    }
  });

  it('the fixture build approves the fixture sets and no real one; the plain build reads no fixture', () => {
    expect(approvedIds(fixtureModule)).toEqual(['ga-ka', 'da-ta']);
    expect(fixtureModule).toContain('audio/vocab/e2e-contrast-ga.mp3');
    expect(fixtureModule).toContain('id: "go-ko"');
    const plain = readFileSync(join(APP_ROOT, CONTRAST_MODULE_FILE), 'utf8');
    expect(plain).not.toContain('e2e-contrast');
    expect(approvedIds(plain)).toEqual([]);
  });

  it('a real approval does not count in the fixture build (the e2e does not depend on which real sets are approved)', () => {
    const root = join(tmp, 'fixture-repo');
    for (const rel of ['content/audio', 'apps/mobile/e2e/fixtures/audio/vocab']) mkdirSync(join(root, rel), { recursive: true });
    const real = { ...catalogue.sets[1], approval: { date: '2026-11-26', plays: 6, correct: 6, mp3Sha256: Object.fromEntries(catalogue.sets[1].members.map((m) => [m.ref, sha('a')])) } };
    writeFileSync(join(root, CONTRAST_SETS_FILE), JSON.stringify({ schemaVersion: 1, sets: [catalogue.sets[0], real] }));
    // The fixture file names a set whose fixture clips are not in this folder, so it is not approved either.
    writeFileSync(join(root, 'apps/mobile', E2E_CONTRAST_FIXTURE_FILE), JSON.stringify({ schemaVersion: 1, sets: [fixture.sets[1]] }));
    const source = buildContrastModule({ root, withFixtures: true }).source;
    expect(source).toContain('id: "go-ko"');
    expect(approvedIds(source)).toEqual([]);
  });

  it('a fixture set whose clip file changed is not approved', () => {
    const root = join(tmp, 'fixture-repo-2');
    const dir = join(root, 'apps/mobile/e2e/fixtures/audio/vocab');
    mkdirSync(dir, { recursive: true });
    mkdirSync(join(root, 'content/audio'), { recursive: true });
    writeFileSync(join(root, CONTRAST_SETS_FILE), JSON.stringify({ schemaVersion: 1, sets: [catalogue.sets[0]] }));
    writeFileSync(join(dir, 'e2e-contrast-ga.mp3'), 'tone');
    writeFileSync(join(dir, 'e2e-contrast-ka.mp3'), 'another tone');
    writeFileSync(join(root, 'apps/mobile', E2E_CONTRAST_FIXTURE_FILE), JSON.stringify({ schemaVersion: 1, sets: [fixture.sets[0]] }));
    expect(approvedIds(buildContrastModule({ root, withFixtures: true }).source)).toEqual([]);
  });
});

describe('the catalogue as a manifest source (section 3.4)', () => {
  const occurrences = contrastOccurrencesOf(catalogue);

  it('makes each member whose clip is not a jamo clip an occurrence of the pack of its unit, with the unit as source', () => {
    expect(occurrences).toHaveLength(catalogue.sets.flatMap((s) => s.members).filter((m) => !isJamoRef(m.ref)).length);
    for (const o of occurrences) {
      expect(['stage1', 'stage2']).toContain(o.pack);
      expect(o.source).toMatch(/^minigame:s[12]-(?:life|letters)-q[23]-pairs$/);
    }
    const byText = new Map(occurrences.map((o) => [o.ko, o]));
    expect(byText.get('코')).toMatchObject({ pack: 'stage1', source: 'minigame:s1-life-q3-pairs', path: 'sets.go-ko.members.1' });
    expect(byText.get('딸')).toMatchObject({ pack: 'stage2', source: 'minigame:s2-letters-q2-pairs' });
    for (const jamo of ['가', '카', '다', '타', '자', '차']) expect(byText.has(jamo)).toBe(false);
  });
});
