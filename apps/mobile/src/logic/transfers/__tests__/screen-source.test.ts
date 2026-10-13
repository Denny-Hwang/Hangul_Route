import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { GrownUpDestination, RootStackParamList } from '../../../navigation/types';

/*
 * F-SPACE-002 section 4.12 (T-7b, T-7c): the grown-up gate continues to MoveClass and ApproveTransfer,
 * the stack registers both, and the move surfaces keep the anti-shame and copy rules. The mobile vitest
 * config cannot render React Native, so these read the sources (as the notes and report screens do);
 * the behaviour is tested in `transfer-views.test.ts` and `consent-sheet.test.ts`.
 */
const SRC = join(__dirname, '..', '..', '..');
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');

const SURFACES = [
  'components/SpacesCard.tsx',
  'screens/transfer/MoveClassScreen.tsx',
  'screens/transfer/ApproveTransferScreen.tsx',
  'screens/transfer/ConsentSheet.tsx',
  'screens/transfer/TransferHomeLine.tsx',
  'screens/transfer/RoomBlock.tsx',
  'screens/transfer/FocusTitle.tsx',
  'screens/transfer/StatusLine.tsx',
];

describe('move gate destinations', () => {
  it('names MoveClass and ApproveTransfer; PinEntry carries the class and the request', () => {
    expectTypeOf<'MoveClass'>().toMatchTypeOf<GrownUpDestination>();
    expectTypeOf<'ApproveTransfer'>().toMatchTypeOf<GrownUpDestination>();
    const move: RootStackParamList['PinEntry'] = { next: 'MoveClass', profileId: 'profile:a', fromSpaceId: 'space:a' };
    const review: RootStackParamList['PinEntry'] = { next: 'ApproveTransfer', profileId: 'profile:a', transferId: 'transfer:a' };
    expect([move.next, review.next]).toEqual(['MoveClass', 'ApproveTransfer']);
  });

  it('the PIN screen continues to both, and the stack registers both', () => {
    const pin = read('screens/parent/PinEntryScreen.tsx');
    expect(pin).toContain("navigation.replace('MoveClass', { profileId, fromSpaceId })");
    expect(pin).toContain("navigation.replace('ApproveTransfer', { profileId, transferId })");
    const root = read('navigation/root.tsx');
    expect(root).toContain('<Stack.Screen name="MoveClass" component={MoveClassScreen} />');
    expect(root).toContain('<Stack.Screen name="ApproveTransfer" component={ApproveTransferScreen} />');
  });

  it('both screens send a closed gate back through the PIN screen', () => {
    expect(read('screens/transfer/MoveClassScreen.tsx')).toContain("if (!gateOpen && !sent && !leaving.current) navigation.replace('PinEntry', { next: 'MoveClass', profileId, fromSpaceId })");
    expect(read('screens/transfer/ApproveTransferScreen.tsx')).toContain("if (!gateOpen && !leaving.current) navigation.replace('PinEntry', { next: 'ApproveTransfer', profileId, transferId })");
  });
});

describe('move surfaces', () => {
  it('never use the danger colour, and take every line from the message dictionary', () => {
    for (const path of SURFACES) {
      const source = read(path);
      expect(source, path).not.toMatch(/feedback\.danger/);
      // No JSX text node with letters: copy comes from useMessages() or the consent catalogue.
      expect(source, path).not.toMatch(/>[ \t]*[A-Za-z][A-Za-z ,.'!?]{2,}[ \t]*<\//);
    }
  });

  it('consent is never queued: the screens check online before sending', () => {
    for (const path of ['screens/transfer/MoveClassScreen.tsx', 'screens/transfer/ApproveTransferScreen.tsx']) {
      expect(read(path), path).toMatch(/if \(!online\) \{\s*setError\(messages\.caregiver\.retry\.offline\);\s*return;/);
    }
  });

  it('Leave no longer ignores its result', () => {
    expect(read('components/SpacesCard.tsx')).toMatch(/const ok = await leave\(profile\.id, row\.spaceId\);\s*if \(!ok\) setLeaveFailed\(true\);/);
  });
});

describe('review fixes (PR #563)', () => {
  const move = (): string => read('screens/transfer/MoveClassScreen.tsx');
  const approve = (): string => read('screens/transfer/ApproveTransferScreen.tsx');
  const sheet = (): string => read('screens/transfer/ConsentSheet.tsx');
  const hooks = (): string => read('screens/transfer/use-transfer.ts');

  it('a stale consent text never reloads: both screens use the tested reload sets', () => {
    expect(move()).toContain('MOVE_RELOAD.has(result.error)');
    expect(approve()).toContain('REQUEST_RELOAD.has(result.error)');
    for (const source of [move(), approve()]) expect(source).not.toContain("'consent_text_stale'");
  });

  it('every reload draws a fresh sheet (the key carries a reload count), and a failed re-find leaves no stale sheet', () => {
    expect(move()).toContain('key={`${sheet.termsDigest ?? sheet.destination.name}:${reloads}`}');
    expect(approve()).toContain('key={`${request.termsDigest ?? request.id}:${reloads}`}');
    expect(move()).toMatch(/if \(!result\.ok\) \{\s*setSheet\(null\);/);
  });

  it('read-to-end is checked after both layouts settle, and a new language is read again', () => {
    expect(sheet()).toContain('}, [markerY, viewport, read]);');
    expect(sheet()).not.toMatch(/check\(0, markerY/);
    expect(sheet()).toMatch(/const switchLocale = [^]*setRead\(false\);/);
  });

  it('a waiting Yes stays focusable (softDisabled), a hard disabled only while busy', () => {
    expect(sheet()).toContain('softDisabled={!read}');
    expect(sheet()).toContain('disabled={busy}');
    expect(sheet()).not.toContain('disabled={!read || busy}');
  });

  it('Not now on the approve sheet says it ends the request; MoveClass Not now only goes back', () => {
    expect(approve()).toContain('notNowNote={t.lines.notNowEnds}');
    expect(move()).not.toContain('notNowNote');
  });

  it('a managed device asks the PIN every time and ends the session when a move screen closes', () => {
    expect(hooks()).toContain("moveEntry({ gateOpen, gated }) === 'direct'");
    expect(hooks()).toMatch(/navigation\.addListener\('beforeRemove', \(\) => \{\s*leaving\.current = true;\s*useUiStore\.getState\(\)\.resetParentGate\(\);/);
    expect(move()).toContain('const leaving = useEndsGateOnLeave(navigation);');
    expect(approve()).toContain('const leaving = useEndsGateOnLeave(navigation);');
  });

  it('the PIN age and the gate are read on a coarse clock, not once per store change', () => {
    expect(hooks()).not.toContain('now: Date.now()');
    expect(hooks()).toMatch(/const now = useMinuteClock\(\);[^]*const now = useMinuteClock\(\);/);
  });

  it('no invalid native role, the h1 takes focus, and the code field uses tokens', () => {
    for (const path of SURFACES) expect(read(path), path).not.toContain('as never');
    for (const source of [move(), approve(), sheet()]) expect(source).toContain('<FocusTitle');
    expect(move()).toContain('borderWidth: borderWidth.base');
    expect(move()).toContain('fontWeight: typography.weight.bold');
  });
});
