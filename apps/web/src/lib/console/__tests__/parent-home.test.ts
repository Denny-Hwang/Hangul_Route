import { formatDate, getMessages } from '@hangul-route/i18n';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RelinkView, RosterLearner, SpaceListItem, TransferLearnerSideView, TransferList } from '../api';
import { isCaregiverSafe } from '../banned-text';
import {
  childChipWords,
  childStatus,
  classLine,
  classLineWords,
  familyActionLinks,
  familyLectureCard,
  firstRowEnd,
  foldNeedsYou,
  gridColumnCount,
  isArchivedFamily,
  joinOrder,
  learnerCardActions,
  lectureCardSlot,
  managesJoinCode,
  needsYou,
  needsYouWords,
  noticeFor,
  parentHomeView,
  type FamilyAsks,
  type NeedsYouItem,
} from '../parent-home';

/**
 * F-APP-001 A-5b, section 3.8 (design/screens/app-shell/parent-home.md): what the family home draws.
 * Families held as owner or caregiver, in creation order; learners in join order, never by activity;
 * card actions by flag; links carry ids and the /parent/space prefix only.
 */
function item(id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'], createdAt = '2026-10-01T00:00:00Z'): SpaceListItem {
  return {
    space: { id, kind, name: `${id} name`, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt },
    role,
    counts: { learners: 1, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  };
}

function learner(id: string, joinedAt: string, lastActiveAt = '2026-10-10T00:00:00Z', minutes = 0): RosterLearner {
  return {
    id,
    displayName: id,
    ageGroup: '5-7',
    avatar: 'cub',
    joinedAt,
    lastActiveAt,
    lastSyncedAt: null,
    summary: { minutesLast7d: minutes } as RosterLearner['summary'],
  } as RosterLearner;
}

describe('parentHomeView', () => {
  it('lists the family spaces held as owner or caregiver, oldest first, then by id', () => {
    const view = parentHomeView([
      item('sp_b', 'family', 'caregiver', '2026-10-02T00:00:00Z'),
      item('sp_c', 'class', 'owner'),
      item('sp_a', 'family', 'owner', '2026-10-02T00:00:00Z'),
      item('sp_0', 'family', 'owner', '2026-09-01T00:00:00Z'),
      item('sp_s', 'family', 'student'),
    ]);
    expect(view.state).toBe('families');
    if (view.state !== 'families') return;
    expect(view.families.map((f) => f.space.id)).toEqual(['sp_0', 'sp_a', 'sp_b']);
  });

  it('archived families come after the live ones, each group oldest first (review: an archived family is never drawn as live)', () => {
    const archived = (entry: SpaceListItem): SpaceListItem => ({ ...entry, space: { ...entry.space, archivedAt: '2026-10-09T00:00:00Z' } });
    const view = parentHomeView([
      archived(item('sp_old', 'family', 'owner', '2026-08-01T00:00:00Z')),
      item('sp_b', 'family', 'owner', '2026-10-02T00:00:00Z'),
      item('sp_a', 'family', 'caregiver', '2026-09-02T00:00:00Z'),
    ]);
    if (view.state !== 'families') throw new Error('expected families');
    expect(view.families.map((f) => f.space.id)).toEqual(['sp_a', 'sp_b', 'sp_old']);
    expect(view.families.map(isArchivedFamily)).toEqual([false, false, true]);
  });

  it('only the family owner manages the join code (the backend sends it with space.manage alone)', () => {
    expect(managesJoinCode(item('sp_f', 'family', 'owner'))).toBe(true);
    expect(managesJoinCode(item('sp_f', 'family', 'caregiver'))).toBe(false);
  });

  it('cross-links: Also teach a class without the teacher persona; the switch with it', () => {
    expect(parentHomeView([item('sp_f', 'family', 'owner')])).toMatchObject({ state: 'families', cross: 'addClass' });
    expect(parentHomeView([item('sp_f', 'family', 'owner'), item('sp_c', 'class', 'teacher')])).toMatchObject({ state: 'families', cross: 'toTeacher' });
  });

  it('no family persona: the no-family state, with Go to Classes only for a teacher', () => {
    expect(parentHomeView([item('sp_c', 'class', 'owner')])).toEqual({ state: 'noFamily', goTeacher: true });
    expect(parentHomeView([])).toEqual({ state: 'noFamily', goTeacher: false });
  });
});

describe('joinOrder', () => {
  it('orders learners by when they joined, then by id, never by activity or minutes', () => {
    const a = learner('profile:a', '2026-10-03T00:00:00Z', '2026-10-01T00:00:00Z', 1);
    const b = learner('profile:b', '2026-10-01T00:00:00Z', '2026-10-11T00:00:00Z', 90);
    const c = learner('profile:c', '2026-10-01T00:00:00Z', '2026-09-01T00:00:00Z', 0);
    expect(joinOrder([a, b, c]).map((l) => l.id)).toEqual(['profile:b', 'profile:c', 'profile:a']);
    // The same learners after their activity changes: the same order.
    const later = [learner('profile:a', a.joinedAt, '2026-10-12T00:00:00Z', 200), learner('profile:c', c.joinedAt, '2026-10-12T00:00:00Z', 300), learner('profile:b', b.joinedAt, '2026-09-01T00:00:00Z', 0)];
    expect(joinOrder(later).map((l) => l.id)).toEqual(['profile:b', 'profile:c', 'profile:a']);
  });

  it('never changes the list it is given', () => {
    const list = [learner('profile:z', '2026-10-05T00:00:00Z'), learner('profile:y', '2026-10-01T00:00:00Z')];
    joinOrder(list);
    expect(list.map((l) => l.id)).toEqual(['profile:z', 'profile:y']);
  });
});

describe('learnerCardActions', () => {
  const off = { reports: false, notes: false, route: false };
  const on = { reports: true, notes: true, route: true };

  it('flags off (today): Open, the family roster, and nothing else', () => {
    expect(learnerCardActions('sp:f', 'profile:1', off)).toEqual({ primary: { key: 'open', href: '/parent/space?id=sp%3Af' }, secondary: [] });
  });

  it('every flag on: See report, Send a note (composer, learner preselected) and Learning Route, all under /parent', () => {
    const actions = learnerCardActions('sp:f', 'profile:1', on);
    expect(actions.primary).toEqual({ key: 'seeReport', href: '/parent/learner?id=sp%3Af&learner=profile%3A1&period=week&from=home' });
    expect(actions.secondary).toEqual([
      { key: 'sendNote', href: '/parent/space/notes?id=sp%3Af&compose=1&learner=profile%3A1' },
      { key: 'route', href: '/parent/space/route?id=sp%3Af&learner=profile%3A1' },
    ]);
  });

  it('each flag shows only its own action', () => {
    expect(learnerCardActions('f', 'l', { ...off, notes: true }).secondary.map((a) => a.key)).toEqual(['sendNote']);
    expect(learnerCardActions('f', 'l', { ...off, route: true }).secondary.map((a) => a.key)).toEqual(['route']);
    expect(learnerCardActions('f', 'l', { ...off, reports: true }).primary.key).toBe('seeReport');
  });

  it('carries ids only: an id can never add a query parameter', () => {
    const { primary, secondary } = learnerCardActions('sp:a&x=1', 'profile:1#y', on);
    for (const { href } of [primary, ...secondary]) {
      const url = new URL(href, 'https://app.example');
      expect(url.hash).toBe('');
      expect(url.searchParams.get('id')).toBe('sp:a&x=1');
      expect(url.searchParams.has('x')).toBe(false);
    }
  });
});

describe('familyActionLinks', () => {
  it('Plan the week, Plan the term and Family settings under /parent/space', () => {
    expect(familyActionLinks('sp:f')).toEqual({
      planWeek: '/parent/space/plan?id=sp%3Af',
      planTerm: '/parent/space/curriculum?id=sp%3Af',
      settings: '/parent/space/settings?id=sp%3Af',
    });
  });
});

describe('familyLectureCard (AMENDMENTS-LECTURE-V2 E2, LV-5)', () => {
  const on = { enabled: true, appUrl: 'https://app.hangulroute.com' };
  const older = item('sp_old', 'family', 'owner', '2026-09-01T00:00:00Z');
  const newer = item('sp_new', 'family', 'caregiver', '2026-10-05T00:00:00Z');

  it('one family: Start opens /parent/space/lecture?id= (presets first)', () => {
    expect(familyLectureCard([older, item('sp_c', 'class', 'teacher')], on)).toEqual({ state: 'one', href: '/parent/space/lecture?id=sp_old' });
    expect(familyLectureCard([newer], on)).toEqual({ state: 'one', href: '/parent/space/lecture?id=sp_new' });
  });

  it('several families: the choice by family name in the home\'s own order (oldest first), whatever the list order', () => {
    const several = {
      state: 'several',
      choices: [
        { id: 'sp_old', name: 'sp_old name', href: '/parent/space/lecture?id=sp_old' },
        { id: 'sp_new', name: 'sp_new name', href: '/parent/space/lecture?id=sp_new' },
      ],
    };
    expect(familyLectureCard([older, newer], on)).toEqual(several);
    expect(familyLectureCard([newer, older], on)).toEqual(several);
  });

  it('several families: the first choice, chosen at first, is the first family on the home, whose section holds the card', () => {
    for (const items of [
      [older, newer],
      [newer, older],
    ]) {
      const card = familyLectureCard(items, on);
      const home = parentHomeView(items);
      expect(card?.state === 'several' ? card.choices[0]?.id : null).toBe(home.state === 'families' ? home.families[0]?.space.id : undefined);
    }
  });

  it('no family (a class teacher only, or a student seat): Start opens the presenter, which needs no space', () => {
    expect(familyLectureCard([], on)).toEqual({ state: 'none', href: 'https://app.hangulroute.com/present' });
    expect(familyLectureCard([item('sp_c', 'class', 'owner'), item('sp_s', 'family', 'student')], on)).toEqual({ state: 'none', href: 'https://app.hangulroute.com/present' });
  });

  it('an archived family is not offered', () => {
    const archived = { ...older, space: { ...older.space, archivedAt: '2026-10-09T00:00:00Z' } };
    expect(familyLectureCard([archived], on)).toMatchObject({ state: 'none' });
    expect(familyLectureCard([archived, newer], on)).toEqual({ state: 'one', href: '/parent/space/lecture?id=sp_new' });
  });

  it('loading while the list has not answered; the no-space path when it failed; nothing while the flag is off', () => {
    expect(familyLectureCard(null, on)).toEqual({ state: 'loading' });
    expect(familyLectureCard('failed', on)).toMatchObject({ state: 'none' });
    for (const items of [[older], [older, newer], [], null, 'failed' as const]) expect(familyLectureCard(items, { ...on, enabled: false })).toBeNull();
  });
});

describe('lectureCardSlot (lecture-card.md "Placement")', () => {
  it('from 70em: first in the side column', () => {
    expect(lectureCardSlot(true, 2)).toBe('side');
    expect(lectureCardSlot(true, 0)).toBe('side');
  });

  it('below 70em: after the first row of learner cards, or at the end of the main column with no card to follow', () => {
    expect(lectureCardSlot(false, 1)).toBe('afterFirstRow');
    expect(lectureCardSlot(false, 3)).toBe('afterFirstRow');
    expect(lectureCardSlot(false, 0)).toBe('afterMain');
  });
});

describe('firstRowEnd and gridColumnCount (the card follows the last card of the first row, in the page as on screen)', () => {
  it('one column (below 45em): directly after the first card', () => {
    expect(firstRowEnd(2, 1)).toBe(0);
    expect(firstRowEnd(5, 1)).toBe(0);
  });

  it('several columns (45em to 70em): after the last card of the first row, or after the last card when the row is short', () => {
    expect(firstRowEnd(2, 2)).toBe(1);
    expect(firstRowEnd(5, 2)).toBe(1);
    expect(firstRowEnd(5, 3)).toBe(2);
    expect(firstRowEnd(1, 3)).toBe(0);
  });

  it('never before the first card, whatever the inputs', () => {
    expect(firstRowEnd(0, 2)).toBe(0);
    expect(firstRowEnd(3, 0)).toBe(0);
    expect(firstRowEnd(3, Number.NaN)).toBe(0);
  });

  it('counts the tracks of a computed grid-template-columns; one with none', () => {
    expect(gridColumnCount('288px')).toBe(1);
    expect(gridColumnCount('288px 288px')).toBe(2);
    expect(gridColumnCount(' 300.5px  300.5px 300.5px ')).toBe(3);
    expect(gridColumnCount('')).toBe(1);
    expect(gridColumnCount('none')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// AMENDMENTS-GROWNUP-UX GX-4 (section 7; wireframe design/wireframes/parent/needs-you.md, mock
// design/screens/approvals/mock/parent-*.html): the family's Needs you strip, the child chip and the class line.

const NOW_GX = new Date('2026-10-31T12:00:00.000Z');

function relink(over: Partial<RelinkView> = {}): RelinkView {
  return {
    id: 'relink:1',
    learnerId: 'profile:mina',
    learnerName: 'Mina',
    deviceId: 'device:new',
    platform: 'ios',
    requestedAt: '2026-10-31T11:57:00.000Z',
    expiresAt: '2026-10-31T12:07:00.000Z',
    status: 'pending',
    ...over,
  };
}

function sideView(over: Partial<TransferLearnerSideView> = {}): TransferLearnerSideView {
  return {
    id: 'transfer:f1',
    role: 'learner_side',
    status: 'requested',
    initiator: 'source',
    learner: { id: 'profile:jun', name: 'Jun' },
    from: { spaceId: 'space:a', name: 'Sunday Class A' },
    to: { spaceId: 'space:d', name: 'Evening Class D', ownerName: 'Ms Park', schoolName: null, ageBucket: 'months', learnerCount: 8 },
    learnerState: 'pending',
    sourceState: 'yes',
    destinationState: 'waiting',
    introduce: false,
    premiumChange: 'none',
    destinationConsentMode: 'parent',
    relinkAffected: false,
    sourcePlansAffected: false,
    visibleToday: [],
    blockReason: null,
    executeAfter: null,
    createdAt: '2026-10-30T12:00:00.000Z',
    expiresAt: '2026-11-09T12:00:00.000Z',
    executedAt: null,
    endedAt: null,
    learnerRoute: 'caregiver',
    endedFrom: null,
    termsDigest: 'a'.repeat(64),
    ...over,
  };
}

function list(requests: TransferLearnerSideView[], options: TransferList['options'] = []): TransferList {
  return { requests, options };
}

function asks(over: Partial<FamilyAsks> = {}): FamilyAsks {
  return { relinks: [], transfers: list([]), scope: { current: 'class-scope-2026-10', learners: [] }, notices: [], ...over };
}

describe('needsYou: what only the family can answer (GX-4, section 7.1)', () => {
  it('nothing waits: no item (the strip is not drawn)', () => {
    expect(needsYou(asks(), NOW_GX)).toEqual([]);
  });

  it('the three kinds: a re-link, a move that waits for the family, a class-scope update to read', () => {
    const items = needsYou(
      asks({
        relinks: [relink()],
        transfers: list([sideView()]),
        scope: { current: 'v', learners: [{ learnerId: 'profile:sora', name: 'Sora', needed: true }, { learnerId: 'profile:mina', name: 'Mina', needed: false }] },
      }),
      NOW_GX,
    );
    expect(items.map((i) => [i.kind, i.learnerId, i.name])).toEqual([
      ['relink', 'profile:mina', 'Mina'],
      ['move', 'profile:jun', 'Jun'],
      ['scope', 'profile:sora', 'Sora'],
    ]);
    expect(items[1]).toMatchObject({ id: 'transfer:f1', to: 'Evening Class D' });
  });

  it('only what waits: an expired or decided re-link, a move the family already agreed to or that ended, a read update add nothing', () => {
    const items = needsYou(
      asks({
        relinks: [relink({ id: 'old', expiresAt: '2026-10-31T11:59:00.000Z' }), relink({ id: 'done', status: 'approved' })],
        transfers: list([
          sideView({ id: 'agreed', learnerState: 'consented' }),
          sideView({ id: 'ended', status: 'ended' }),
          sideView({ id: 'approved', status: 'approved' }),
          sideView({ id: 'gone', expiresAt: '2026-10-31T11:00:00.000Z' }),
        ]),
      }),
      NOW_GX,
    );
    expect(items).toEqual([]);
  });

  it('a read that failed or was skipped (null) adds nothing, never a guess', () => {
    expect(needsYou({ relinks: null, transfers: null, scope: null, notices: [] }, NOW_GX)).toEqual([]);
  });

  it('soonest-closing first (a re-link closes in minutes), then oldest first; an item with no end last', () => {
    const items = needsYou(
      asks({
        relinks: [relink({ id: 'r-late', expiresAt: '2026-10-31T12:09:00.000Z' }), relink({ id: 'r-soon', learnerId: 'profile:jun', learnerName: 'Jun', expiresAt: '2026-10-31T12:03:00.000Z' })],
        transfers: list([
          sideView({ id: 'm-new', createdAt: '2026-10-30T12:00:00.000Z', expiresAt: '2026-11-13T12:00:00.000Z' }),
          sideView({ id: 'm-old', createdAt: '2026-10-29T12:00:00.000Z', expiresAt: '2026-11-13T12:00:00.000Z' }),
        ]),
        scope: { current: 'v', learners: [{ learnerId: 'profile:sora', name: 'Sora', needed: true }] },
      }),
      NOW_GX,
    );
    expect(items.map((i) => i.id)).toEqual(['r-soon', 'r-late', 'm-old', 'm-new', 'profile:sora']);
  });
});

describe('foldNeedsYou: compact rows and the fold rule (section 7.1)', () => {
  const three = needsYou(
    asks({ relinks: [relink()], transfers: list([sideView()]), scope: { current: 'v', learners: [{ learnerId: 'profile:sora', name: 'Sora', needed: true }] } }),
    NOW_GX,
  );

  it('1 or 2 items: every item keeps its row', () => {
    expect(foldNeedsYou(three.slice(0, 1))).toEqual({ rows: three.slice(0, 1), more: 0 });
    expect(foldNeedsYou(three.slice(0, 2))).toEqual({ rows: three.slice(0, 2), more: 0 });
    expect(foldNeedsYou([])).toEqual({ rows: [], more: 0 });
  });

  it('3 or more: the soonest-closing item keeps its row and the rest fold into one "{n} more" row', () => {
    expect(foldNeedsYou(three)).toEqual({ rows: [three[0]], more: 2 });
    expect(getMessages('en').console.parentHome.needsYou.more(2)).toBe('2 more things need you');
    expect(getMessages('en').console.parentHome.needsYou.more(1)).toBe('1 more thing needs you');
  });
});

describe('needsYouWords: one sentence and a short second line (section 7.1 table)', () => {
  const [r, mv, sc] = needsYou(
    asks({ relinks: [relink()], transfers: list([sideView()]), scope: { current: 'v', learners: [{ learnerId: 'profile:sora', name: 'Sora', needed: true }] } }),
    NOW_GX,
  ) as [NeedsYouItem, NeedsYouItem, NeedsYouItem];

  it('en', () => {
    expect(needsYouWords(r, NOW_GX, 'en')).toEqual({ text: 'Mina wants to continue on a new device.', meta: '7 min left' });
    expect(needsYouWords(mv, NOW_GX, 'en')).toEqual({ text: 'A class move for Jun needs your OK.', meta: 'New class: Evening Class D · Ends in 9 days' });
    expect(needsYouWords(sc, NOW_GX, 'en')).toEqual({ text: "Read what Sora's teachers can see.", meta: null });
  });

  it('es and ko (one action wording per locale; no particle on a name in Korean)', () => {
    expect(needsYouWords(r, NOW_GX, 'es')).toEqual({ text: 'Mina quiere seguir en un dispositivo nuevo.', meta: 'Quedan 7 min' });
    expect(needsYouWords(mv, NOW_GX, 'es')).toEqual({ text: 'Un cambio de clase de Jun espera tu aprobación.', meta: 'Clase nueva: Evening Class D · Termina en 9 días' });
    expect(needsYouWords(r, NOW_GX, 'ko')).toEqual({ text: '새 기기에서 이어서 하려는 요청: Mina', meta: '7분 남음' });
    expect(needsYouWords(mv, NOW_GX, 'ko')).toEqual({ text: 'Jun의 반 이동에 승인이 필요해요.', meta: '옮길 반: Evening Class D · 9일 뒤 마감' });
    expect(needsYouWords(sc, NOW_GX, 'ko').text).toBe('Sora의 선생님이 보는 정보를 확인해 주세요.');
  });

  it('a minute or a day left reads in the singular, never 0', () => {
    const late = needsYou(asks({ relinks: [relink({ expiresAt: '2026-10-31T12:00:20.000Z' })] }), NOW_GX)[0] as NeedsYouItem;
    expect(needsYouWords(late, NOW_GX, 'en').meta).toBe('1 min left');
    const lastDay = needsYou(asks({ transfers: list([sideView({ expiresAt: '2026-10-31T20:00:00.000Z' })]) }), NOW_GX)[0] as NeedsYouItem;
    expect(needsYouWords(lastDay, NOW_GX, 'en').meta).toBe('New class: Evening Class D · Ends in 1 day');
    expect(needsYouWords(lastDay, NOW_GX, 'es').meta).toBe('Clase nueva: Evening Class D · Termina en 1 día');
  });
});

describe('childStatus and childChipWords: one chip per child, text only (section 7.2)', () => {
  const all = asks({
    relinks: [relink({ learnerId: 'profile:jun', learnerName: 'Jun' })],
    transfers: list([sideView(), sideView({ id: 'later', learner: { id: 'profile:sora', name: 'Sora' }, status: 'approved', learnerState: 'consented', executeAfter: '2026-11-03T12:00:00.000Z' })]),
    scope: { current: 'v', learners: [{ learnerId: 'profile:jun', name: 'Jun', needed: true }, { learnerId: 'profile:mina', name: 'Mina', needed: true }] },
  });

  it('priority: a re-link, then a move that needs the family, then the class info to read, then a dated move', () => {
    expect(childStatus('profile:jun', all, NOW_GX)).toEqual({ kind: 'relink' });
    expect(childStatus('profile:jun', { ...all, relinks: [] }, NOW_GX)).toEqual({ kind: 'move' });
    expect(childStatus('profile:jun', { ...all, relinks: [], transfers: list([]) }, NOW_GX)).toEqual({ kind: 'scope' });
    expect(childStatus('profile:mina', all, NOW_GX)).toEqual({ kind: 'scope' });
    expect(childStatus('profile:sora', all, NOW_GX)).toEqual({ kind: 'moving', on: '2026-11-03T12:00:00.000Z' });
    expect(childStatus('profile:nobody', all, NOW_GX)).toBeNull();
  });

  it('a move waiting for a seat, or with its date passed, or with no date, is no chip', () => {
    const blocked = asks({ transfers: list([sideView({ status: 'approved', learnerState: 'consented', blockReason: 'cap_class', executeAfter: '2026-11-03T12:00:00.000Z' })]) });
    expect(childStatus('profile:jun', blocked, NOW_GX)).toBeNull();
    const past = asks({ transfers: list([sideView({ status: 'approved', learnerState: 'consented', executeAfter: '2026-10-30T12:00:00.000Z' })]) });
    expect(childStatus('profile:jun', past, NOW_GX)).toBeNull();
    const undated = asks({ transfers: list([sideView({ status: 'approved', learnerState: 'consented', executeAfter: null })]) });
    expect(childStatus('profile:jun', undated, NOW_GX)).toBeNull();
  });

  it('the words: the three action chips in the family amber fill, Moving in the info fill', () => {
    expect(childChipWords({ kind: 'move' }, 'en')).toEqual({ text: 'Class move · needs your OK', tone: 'action' });
    expect(childChipWords({ kind: 'relink' }, 'en')).toEqual({ text: 'New device · needs your OK', tone: 'action' });
    expect(childChipWords({ kind: 'scope' }, 'en')).toEqual({ text: 'Class info to read', tone: 'action' });
    expect(childChipWords({ kind: 'moving', on: '2026-11-03T12:00:00.000Z' }, 'en')).toEqual({ text: 'Moving Nov 3', tone: 'info' });
    expect(childChipWords({ kind: 'move' }, 'es').text).toBe('Cambio de clase · por aprobar');
    expect(childChipWords({ kind: 'relink' }, 'ko').text).toBe('새 기기 · 승인 대기');
    expect(childChipWords({ kind: 'moving', on: '2026-11-03T12:00:00.000Z' }, 'ko').text).toBe(`이동 예정 · ${formatDate('ko', '2026-11-03T12:00:00.000Z', 'monthDay')}`);
  });
});

describe('classLine: which classes the child is in (section 7.2)', () => {
  const options: TransferList['options'] = [
    { learnerId: 'profile:mina', name: 'Mina', classes: [{ spaceId: 'space:d', name: 'Evening Class D' }], selfManaged: false, blockTeacherRequests: false },
    { learnerId: 'profile:jun', name: 'Jun', classes: [{ spaceId: 'space:a', name: 'Sunday Class A' }, { spaceId: 'space:b', name: 'Saturday Class' }], selfManaged: false, blockTeacherRequests: false },
    { learnerId: 'profile:sora', name: 'Sora', classes: [], selfManaged: false, blockTeacherRequests: false },
  ];

  it('one, many, none', () => {
    expect(classLine('profile:mina', list([], options))).toEqual({ kind: 'one', name: 'Evening Class D' });
    expect(classLine('profile:jun', list([], options))).toEqual({ kind: 'many', names: ['Sunday Class A', 'Saturday Class'] });
    expect(classLine('profile:sora', list([], options))).toEqual({ kind: 'none' });
    expect(classLineWords({ kind: 'one', name: 'Evening Class D' }, 'en')).toEqual(['In: Evening Class D']);
    expect(classLineWords({ kind: 'many', names: ['Sunday Class A', 'Saturday Class'] }, 'en')).toEqual(['In 2 classes', 'Sunday Class A · Saturday Class']);
    expect(classLineWords({ kind: 'none' }, 'en')).toEqual(['Family only']);
    expect(classLineWords({ kind: 'one', name: 'Evening Class D' }, 'ko')).toEqual(['소속: Evening Class D']);
    expect(classLineWords({ kind: 'many', names: ['A', 'B'] }, 'es')).toEqual(['En 2 clases', 'A · B']);
    expect(classLineWords({ kind: 'none' }, 'es')).toEqual(['Solo en familia']);
  });

  it('omitted when the read was skipped or failed, when it carried no options, or when the child is not in them (never "Family only" on a guess)', () => {
    expect(classLine('profile:mina', null)).toBeNull();
    expect(classLine('profile:mina', { requests: [] })).toBeNull();
    expect(classLine('profile:new', list([], options))).toBeNull();
  });
});

describe('noticeFor: the TV-D10 move notice goes in its own child card (section 7.1)', () => {
  it('the first notice about that child, or null', () => {
    const notices = [
      { id: 'mv:1', learnerId: 'profile:mina', learnerName: 'Mina', to: { spaceId: 'space:d', name: 'Evening Class D' }, executedAt: '2026-10-30T00:00:00.000Z' },
      { id: 'mv:2', learnerId: 'profile:jun', learnerName: 'Jun', to: { spaceId: 'space:a', name: 'Sunday Class A' }, executedAt: '2026-10-29T00:00:00.000Z' },
    ];
    expect(noticeFor('profile:jun', notices)?.id).toBe('mv:2');
    expect(noticeFor('profile:sora', notices)).toBeNull();
  });
});

describe('GX-4 copy rules', () => {
  it('every new family line is anti-shame safe in en, es and ko', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const p = getMessages(locale).console.parentHome;
      const lines = [
        p.needsYou.title,
        p.needsYou.move('Jun'),
        p.needsYou.moveMeta('Evening Class D', 9),
        p.needsYou.relink('Mina'),
        p.needsYou.scope('Sora'),
        p.needsYou.readOk.cta,
        p.needsYou.more(2),
        p.needsYou.seeAll.cta,
        p.status.move,
        p.status.relink,
        p.status.scope,
        p.classLine.one('A'),
        p.classLine.many(2),
        p.classLine.none,
      ];
      for (const line of lines) expect(isCaregiverSafe(line, locale), `${locale}: ${line}`).toBe(true);
    }
  });

  it('parent-home.ts stays pure: no React, no fetch, no storage', () => {
    const source = readFileSync(new URL('../parent-home.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from 'react'|fetch\(|localStorage|sessionStorage/);
  });
});
