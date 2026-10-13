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
    expect(read('screens/transfer/MoveClassScreen.tsx')).toContain("navigation.replace('PinEntry', { next: 'MoveClass', profileId, fromSpaceId })");
    expect(read('screens/transfer/ApproveTransferScreen.tsx')).toContain("navigation.replace('PinEntry', { next: 'ApproveTransfer', profileId, transferId })");
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
