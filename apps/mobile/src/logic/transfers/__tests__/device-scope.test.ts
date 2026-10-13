import { describe, expect, it } from 'vitest';
import { classScopeMarker, deviceScopeOf } from '../device-scope';

/*
 * Which credential this device holds for a learner — F-SPACE-002 section
 * 4.12 variant (a), PR T-7a. A class re-link mints a class-scoped device; a
 * Rescue Code claim or a first sync mints a full one with a new secret, so
 * the marker is tied to the secret it was written for.
 */

describe('device scope marker', () => {
  it('a marker written for the current secret reads class', () => {
    expect(deviceScopeOf(classScopeMarker('secret-1'), 'secret-1')).toBe('class');
  });

  it('a new secret (a Rescue Code claim, a fresh registration) reads full again', () => {
    expect(deviceScopeOf(classScopeMarker('secret-1'), 'secret-2')).toBe('full');
  });

  it('no marker, no secret or a damaged marker reads full', () => {
    expect(deviceScopeOf(null, 'secret-1')).toBe('full');
    expect(deviceScopeOf(classScopeMarker('secret-1'), null)).toBe('full');
    for (const bad of ['class', 7, { scope: 'full', credential: 'x' }, { scope: 'class' }, { scope: 'class', credential: 3 }]) expect(deviceScopeOf(bad, 'secret-1')).toBe('full');
  });

  it('the marker keeps no copy of the secret', () => {
    expect(JSON.stringify(classScopeMarker('secret-1'))).not.toContain('secret-1');
  });
});
