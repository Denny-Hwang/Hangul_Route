import { checkRomanization, romanizeWord } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  AVATAR_PRESETS,
  DEFAULT_AVATAR,
  avatarAccessibilityLabel,
  findAvatar,
  isAvatarKind,
} from '../avatar-catalog';

describe('avatar catalog', () => {
  it('has one preset per culture-theme Pillar (5, per spec §9.3)', () => {
    expect(AVATAR_PRESETS).toHaveLength(5);
    expect(AVATAR_PRESETS.map((a) => a.theme)).toEqual([
      'letters',
      'life',
      'rites',
      'nature',
      'crafts',
    ]);
  });

  it('has unique kinds and unique themes', () => {
    expect(new Set(AVATAR_PRESETS.map((a) => a.kind)).size).toBe(AVATAR_PRESETS.length);
    expect(new Set(AVATAR_PRESETS.map((a) => a.theme)).size).toBe(AVATAR_PRESETS.length);
  });

  it('pairs every Korean Pillar name with a romanization', () => {
    for (const preset of AVATAR_PRESETS) {
      expect(preset.pillarName).toMatch(/[가-힣]/);
      expect(preset.romanization).toMatch(/^[A-Za-z]+$/);
    }
  });

  it('the default avatar is a member of the catalog', () => {
    expect(findAvatar(DEFAULT_AVATAR)).not.toBeNull();
  });

  it('findAvatar resolves a known kind and returns null otherwise', () => {
    expect(findAvatar('hoya-green')?.theme).toBe('rites');
    // @ts-expect-error — guarding the runtime path for persisted junk data
    expect(findAvatar('hoya-teal')).toBeNull();
  });

  it('isAvatarKind narrows only catalog members', () => {
    expect(isAvatarKind('hoya-pink')).toBe(true);
    expect(isAvatarKind('hoya-teal')).toBe(false);
  });
});

describe('avatarAccessibilityLabel', () => {
  it('reads a tile as "<name>\'s tiger, stage N. Tap to enter." (§3.6)', () => {
    expect(avatarAccessibilityLabel('Suni', 1)).toBe("Suni's tiger, stage 1. Tap to enter.");
  });
});

describe('Rites cub name (F-CNT-002 C9, owner decision 2026-10-10)', () => {
  it('is spelled 예리 and romanized Yeri', () => {
    const rites = findAvatar('hoya-green');
    expect(rites?.pillarName).toBe('예리');
    expect(rites?.romanization).toBe('Yeri');
  });

  it('no longer contains the old 례이 spelling anywhere in the catalogue', () => {
    expect(AVATAR_PRESETS.some((a) => a.pillarName === '례이')).toBe(false);
  });

  it('keeps the romanization consistent with the Revised Romanization of the Hangul name', () => {
    expect(romanizeWord('예리')).toBe('yeri');
    for (const a of AVATAR_PRESETS) {
      expect(checkRomanization(a.pillarName, a.romanization)).toEqual([]);
    }
  });
});
