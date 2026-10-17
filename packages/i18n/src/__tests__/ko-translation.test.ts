import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import ledger from '../messages/review-ledger.json';
import { fallbackPaths, getMessages, isEnglishAuthoritative } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { LOCALE_STATUS } from '../locales';
import { koCoverageRequired, koReviewedNamespaces, koUnexpectedFallbacks } from './ko-coverage';
import { SAMPLES } from './samples';

/**
 * F-I18N-001 PR 16 (Korean): every UI key has a Korean value, the review ledger records the multi-agent review of
 * each namespace, and the rules the review applied are pinned so a later edit cannot undo them (§3.10 step 3 and
 * the style guide). Coverage is a ratchet (`./ko-coverage`), as for Spanish.
 */
type Message = (...args: unknown[]) => string;
const ko = getMessages('ko');

/**
 * A key English added after the review, still an English fallback while ko is hidden (`./ko-coverage`): it waits for
 * the next Korean draft, so the lenses below judge only Korean the review wrote. `koUnexpectedFallbacks` still fails
 * a fallback inside a namespace the review signed.
 */
const waiting = new Set(fallbackPaths('ko'));

/** Every rendered Korean output with its path: strings, array items, and one output per SAMPLES row. */
function outputs(): Array<[path: string, text: string, args: readonly unknown[]]> {
  const out: Array<[string, string, readonly unknown[]]> = [];
  for (const path of leafPaths(ko)) {
    if (isEnglishAuthoritative(path) || waiting.has(path)) continue;
    const value = lookup(ko, path);
    if (typeof value === 'string') out.push([path, value, []]);
    else if (Array.isArray(value)) for (const item of value) out.push([path, String(item), []]);
    else if (typeof value === 'function') for (const args of SAMPLES[path] ?? []) out.push([path, (value as Message)(...args), args]);
  }
  return out;
}

describe('Korean dictionary (F-I18N-001 PR 16)', () => {
  it('has no English fallback in a namespace the review signed (every namespace, until English changes)', () => {
    expect(koUnexpectedFallbacks()).toEqual([]);
  });

  it('lets a key English adds after the review wait for the next draft while ko is hidden, and never once shipped', () => {
    expect(koCoverageRequired('learner.home.newKey', ['learner'])).toBe(true);
    expect(koCoverageRequired('learner.home.newKey', ['console'])).toBe(LOCALE_STATUS.ko === 'shipped');
    for (const namespace of koReviewedNamespaces()) expect(Object.keys(en)).toContain(namespace);
  });

  it('keeps the Privacy Policy and Terms English (decision L10) and translates the notice around them', () => {
    const legal = leafPaths(en).filter(isEnglishAuthoritative);
    expect(legal.length).toBeGreaterThan(10);
    for (const path of legal) expect(lookup(ko, path)).toBe(lookup(en, path));
    expect(ko.landing.legal.draft).not.toBe(en.landing.legal.draft);
    expect(ko.landing.legal.englishAuthoritative).not.toBe(en.landing.legal.englishAuthoritative);
  });

  it('differs from English wherever English is not a shared name, code or glyph', () => {
    const fallback = new Set(fallbackPaths('ko'));
    const untouched = leafPaths(en).filter((path) => {
      if (isEnglishAuthoritative(path) || fallback.has(path)) return false;
      const own = lookup(ko, path);
      const source = lookup(en, path);
      if (typeof own === 'string') return own === source;
      if (Array.isArray(own) && Array.isArray(source)) return own.some((item, i) => item === source[i]);
      if (typeof own === 'function' && typeof source === 'function') {
        const rows = SAMPLES[path] ?? [];
        return rows.length > 0 && rows.every((args) => (own as Message)(...args) === (source as Message)(...args));
      }
      return false;
    });
    const current = new Set(leafPaths(en));
    expect([...untouched].sort()).toEqual(KO_LITERALLY_SHARED.filter((path) => current.has(path)).sort());
  });

  it('writes every other value in Korean: its own words hold at least one Hangul syllable', () => {
    const shared = new Set(KO_LITERALLY_SHARED);
    const noWords = new Set<string>();
    for (const [path, text, args] of outputs()) {
      if (shared.has(path)) continue;
      // The message's own words: the output with every string argument taken out.
      let own = text;
      for (const arg of args) if (typeof arg === 'string' && arg !== '') own = own.split(arg).join('');
      if (!/[가-힯]/.test(own)) noWords.add(path);
    }
    expect([...noWords].sort()).toEqual([...KO_ALL_ARGUMENTS].sort());
  });
});

describe('the Korean review lenses, pinned (§3.10 step 3)', () => {
  it('lens 1, naturalness: no particle that changes with the final consonant follows an argument', () => {
    // A string argument becomes a marker; the character after it must not start such a particle (style guide).
    const MARK = '';
    const PARTICLE = /(은|는|이|가|을|를|과|와|으로|로|아|야|이나|나|이랑|랑|이에요|예요|이라|라|였|이었)/;
    for (const path of leafPaths(ko)) {
      const value = lookup(ko, path);
      if (typeof value !== 'function') continue;
      for (const args of SAMPLES[path] ?? []) {
        const marked = args.map((a) => (typeof a === 'string' ? MARK : a));
        const out = (value as Message)(...marked);
        expect(PARTICLE.test(out), `${path}: ${out.replace(//g, '{x}')}`).toBe(false);
      }
    }
  });

  it('lens 1, register: 해요체 on app surfaces; 합니다체 only on legal and pricing text', () => {
    const FORMAL = /(습니다|읍니다|십시오|합니다|입니다|됩니다)/;
    const formal = outputs()
      .filter(([, text]) => FORMAL.test(text))
      .map(([path]) => path);
    expect([...new Set(formal)].sort()).toEqual([...FORMAL_ALLOWED].sort());
  });

  it('lens 1, terms: one Korean word for each product term (glossary)', () => {
    const GLOSSARY: ReadonlyArray<readonly [RegExp, string]> = [
      [/Learning Route/, '학습 루트'],
      [/rescue code/i, '복구 코드'],
      [/Family Plan/, '가족 플랜'],
      [/Group License/, '그룹 라이선스'],
      [/\bHoya\b/, '호야'],
      [/Hangul Route/, 'Hangul Route'],
      [/grown-up PIN/i, '어른용 PIN'],
      // The rest of the §3.10 Korean glossary (PR 16 review).
      [/heritage card/i, '문화 카드'],
      [/level check/i, '수준 확인'],
      [/\bStage \d/, '단계'],
      [/\bgrown-up\b/i, '어른'],
    ];
    for (const path of leafPaths(en)) {
      // A format-only template is all arguments: its words are the arguments' business.
      if (isEnglishAuthoritative(path) || KO_LITERALLY_SHARED.includes(path) || waiting.has(path)) continue;
      const source = lookup(en, path);
      const own = lookup(ko, path);
      const rows: ReadonlyArray<readonly unknown[]> = typeof source === 'function' ? (SAMPLES[path] ?? []) : [[]];
      for (const args of rows) {
        const enText = typeof source === 'function' ? (source as Message)(...args) : String(source);
        const koText = typeof own === 'function' ? (own as Message)(...args) : String(own);
        // A term that only arrives in an argument is the argument's business, not this message's.
        let enOwn = enText;
        for (const arg of args) if (typeof arg === 'string' && arg !== '') enOwn = enOwn.split(arg).join('');
        for (const [term, word] of GLOSSARY) if (term.test(enOwn) && !GLOSSARY_EXEMPT.has(`${path}|${word}`)) expect(koText, `${path}: ${koText}`).toContain(word);
      }
    }
  });

  it('lens 1, glossary: a count of items never reads "n개 모음" (모음 also means vowel; finding R1)', () => {
    for (const [path, text] of outputs()) expect(/개 모음|\d+\s*모음/.test(text), `${path}: ${text}`).toBe(false);
  });

  it('lens 2, anti-shame: never a failure, deadline or comparison word on any surface', () => {
    const SHAME = /(실패|틀렸습니다|낙제|벌점|게으|뒤처|뒤떨어|꼴찌|기한 초과|연체|미완료)/;
    for (const [path, text] of outputs()) expect(SHAME.test(text), `${path}: ${text}`).toBe(false);
  });

  it('lens 1, terms: 멈추- only pauses; ending a round, a check or a plan is 그만하- (MAR re-review, #502)', () => {
    for (const [path, text] of outputs()) {
      if (/멈추|멈출|멈춰|멈췄|멈춤/.test(text)) expect(path, `${path}: ${text}`).toMatch(/pause|paused|stopsLine/i);
    }
    expect(ko.learner.placement.invite.duration).toContain('그만할 수 있어요');
  });

  it('lens 1, terms: the learner weekly plan and the console name each pace the same way (MAR re-review)', () => {
    expect(ko.learner.weeklyPlan.proposal.pace).toEqual(ko.console.curriculum.rhythm.paces);
  });

  it('lens 1, naturalness: a later start is "더 나아간", never "더 뒤" or "앞당기-" (MAR re-review, #507 twins)', () => {
    for (const [path, text] of outputs()) expect(/더 뒤의|더 뒤에서|앞당기/.test(text), `${path}: ${text}`).toBe(false);
  });

  it('lens 3, length: drawn tab labels stay one short word for the 80 px tab (four tabs at 320 px)', () => {
    for (const label of Object.values(ko.a11y.tabs)) {
      expect(label.length, label).toBeLessThanOrEqual(5);
      expect(label, label).not.toMatch(/\s/);
    }
  });

  it('lens 4, KoreanText: no message types a taught letter (compatibility or conjoining jamo)', () => {
    for (const [path, text] of outputs()) expect(/[ᄀ-ᇿㄱ-ㆎ]/.test(text), `${path}: ${text}`).toBe(false);
  });

  it('lens 4, KoreanText: a message that takes taught Korean uses it exactly once (aroundSlot)', () => {
    const SENTINEL = '\u0000';
    const SLOTTED: ReadonlyArray<readonly [string, (value: string) => string]> = [
      ['console.space.week.revisit', (v) => ko.console.space.week.revisit(v)],
      ['console.space.week.wordsRevisit', (v) => ko.console.space.week.wordsRevisit(v)],
      ['console.space.learner.revisit', (v) => ko.console.space.learner.revisit(v)],
      ['console.space.learner.wordsRevisit', (v) => ko.console.space.learner.wordsRevisit(v)],
      ['console.relink.askingToBe', (v) => ko.console.relink.askingToBe(v)],
      ['console.school.footer', (v) => ko.console.school.footer(v)],
      ['console.lecture.source.revisitWith', (v) => ko.console.lecture.source.revisitWith(v)],
      ['landing.home.hero.bubble', (v) => ko.landing.home.hero.bubble(v, 'g/k')],
    ];
    for (const [path, render] of SLOTTED) expect(render(SENTINEL).split(SENTINEL).length - 1, path).toBe(1);
  });

  it('reads the spec examples and the review fixes (§3.1, §3.4, §3.5)', () => {
    expect(ko.learner.home.streak.pill(1)).toBe('1일 연속');
    expect(ko.learner.home.streak.pill(5)).toBe('5일 연속');
    expect(ko.caregiver.restore.notice.added('Suni', 1, 0)).toBe('Suni의 진도를 찾았어요! 카드 1장을 더했어요.');
    expect(ko.caregiver.restore.notice.added('Suni', 0, 2)).toBe('Suni의 진도를 찾았어요! 퀘스트 2개를 더했어요.');
    expect(ko.caregiver.restore.notice.added('Suni', 2, 1)).toBe('Suni의 진도를 찾았어요! 카드 2장과 퀘스트 1개를 더했어요.');
    expect(ko.console.plan.readout.withNotReady(0, 2, 1)).toBe('0 / 2 · 1개 아직 준비 안 됨');
    // The readout hint quotes the readout's own words.
    expect(ko.console.readoutHint).toContain('"아직 준비 안 됨"');
    expect(ko.caregiver.plan.freePlan.line(15, 24, 65)).toBe('1단계는 무료예요: 레슨 15개, 글자 24개, 약 65분. 끝낸 것은 사라지지 않아요.');
    expect(ko.a11y.koreanItem({ ko: '강아지', romanization: 'gangaji', gloss: '작고 귀여운 개' })).toBe('한글: 강아지, gangaji, 작고 귀여운 개');
  });

  it('has a review-ledger entry signed by the multi-agent review for every namespace (§3.10 step 3)', () => {
    const entries = (ledger as Record<string, Record<string, { enSha: string; reviewedBy: string; reviewedAt: string }>>).ko ?? {};
    expect(Object.keys(entries).sort()).toEqual(Object.keys(en).sort());
    for (const entry of Object.values(entries)) {
      expect(entry.enSha).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.reviewedBy).toBe('MAR');
      expect(entry.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

/**
 * Messages with an output made only of their arguments and punctuation (no word of their own), so no Hangul is
 * expected of them: list and range joins, a label and its value, a date inside a sentence.
 */
const KO_ALL_ARGUMENTS: readonly string[] = [
  'a11y.missionCard', // "title. subtitle." when the card is not collected yet
  'a11y.minigame.strokeOrder.legs', // directions joined by ", 그다음 " (one direction alone has no joiner)
  'caregiver.audience.gated', // the base label alone on a device with no PIN
  'console.settings.grownUps.roleLine', // the worded role alone when it is not the signed-in grown-up
  'console.notes.composer.text.counter', // "n / max"
  'report.when.onDay', // a formatted date inside a sentence (it carries no particle)
  'report.when.inMonth', // a formatted month inside a sentence
  'report.step.range', // "from~to"
  'report.list', // items joined by ", "
  'learner.weeklyPlan.proposal.pickDayLabel', // "date (weekday)": both arrive formatted in Korean
];

/** 합니다체 on purpose: the legal notice and the plan terms and price lines (§3.10 style guide). */
const FORMAL_ALLOWED: readonly string[] = [
  'console.familyLine',
  'console.groupLine',
  'console.contactLine',
  'landing.legal.englishAuthoritative',
  'landing.legal.draft',
  // The class-move consent sheet's frame (F-SPACE-002 T-6d): one voice with the 합니다체 consent lines it frames.
  'console.transfer.consent.failed',
  'console.transfer.consent.readToEnd',
  'console.transfer.consent.unavailable',
  'console.transfer.consent.updated',
  'console.transfer.lines.notNowEnds',
];

/** `path|word` pairs where the glossary word is not needed, each with its reason in the review table of the PR. */
const GLOSSARY_EXEMPT: ReadonlySet<string> = new Set([]);

/**
 * Paths whose Korean text is, on purpose, identical to the English: a proper name, a code, a sample value, a glyph or
 * a format-only template. Listed so a new untranslated key cannot hide among them.
 */
const KO_LITERALLY_SHARED: readonly string[] = [
  // Format-only templates: arguments joined by punctuation, a colon, a middle dot or a slash.
  'a11y.homeworkRow',
  'a11y.access.row', // title, lines and tags joined by ". " (MAR re-review 2026-10-13)
  'a11y.planStatus',
  'a11y.myRoute.later',
  'a11y.myRoute.cell',
  'a11y.myRoute.skill',
  'a11y.myRoute.gain',
  'a11y.myRoute.homeStrip',
  'a11y.myRoute.letter',
  'a11y.myRoute.cellInPlan',
  'a11y.myRoute.labelled',
  'a11y.myRoute.routeCard',
  'a11y.minigame.keyboard.key', // "{letter}, {sound}" on a keyboard key (F-CURR-001 G-3)
  'a11y.minigame.writeFrame.tile', // "{block}, {sound}" on a name-round tile (F-CURR-001 G-5)
  'learner.firstQuest.questLine',
  'learner.journey.countMark',
  'learner.journey.cellStories.title',
  'learner.quest.progress',
  'learner.minigame.progress.pill',
  'learner.story.check.position.pill',
  'learner.story.reader.position.pill',
  'learner.storyShelf.episode.rowLabel',
  'learner.home.next.a11y',
  'learner.myRoute.nextLessons.row', // tag, title and where joined by ": " and ". " (owner decision 2026-10-17)
  'learner.storyShelf.cultureNotes.source',
  'learner.storyShelf.heroLabel',
  'console.space.learner.planReadout',
  'console.space.wordGloss',
  'console.plan.readout.progress',
  'console.curriculum.goals.themeChosen',
  'console.curriculum.preview.dateRange',
  'console.curriculum.preview.taggedItem',
  'console.curriculum.preview.itemLine',
  'console.curriculum.builder.planChip',
  'console.school.licence.line',
  'console.learningRoute.stageRow',
  'report.detail.strand',
  'report.class.count',
  'report.letter',
  'learner.weeklyPlan.proposal.weekRowLabel',
  'learner.weeklyPlan.setup.likes.themeChosen',
  // Names: the brand and its mark, the copyright line, and the Android platform name.
  'landing.brand.name',
  'landing.brand.mark',
  'landing.footer.copyright',
  'learner.audio.voiceHelp.sections.android.title',
  // Sample values in empty fields: a rescue code, a class code, an account id, addresses and a promo code.
  'caregiver.pin.reset.code.placeholder',
  'caregiver.join.code.placeholder',
  'console.signIn.accountId.placeholder',
  'console.signIn.email.placeholder',
  'console.billing.promo.placeholder',
  'landing.waitlist.placeholder',
  // Glyphs: the reorder arrows, the close cross and the star.
  'console.plan.yours.moveUp.cta',
  'console.plan.yours.moveDown.cta',
  'console.plan.yours.remove.cta',
  'console.lecture.outline.upGlyph',
  'console.lecture.outline.downGlyph',
  'landing.localeBanner.close.cta',
  // F-TCH-004 PR 6: the presenter's slide counter, two numbers and a slash.
  'learner.presenter.bar.counter',
];
