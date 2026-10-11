import { describe, expect, it } from 'vitest';
import { SCANNED_SOURCE, impureImports } from './impure-imports';

describe('impureImports (purity guard for card-ids.ts and src/word-art)', () => {
  it.each([
    ["import React from 'react';", 'react'],
    ["import { jsx } from 'react/jsx-runtime';", 'react/jsx-runtime'],
    ["import { View } from 'react-native';", 'react-native'],
    ["import 'react-native';", 'react-native'],
    ["import Svg from 'react-native-svg';", 'react-native-svg'],
    ["import { Path } from 'react-native-svg/lib/module/elements';", 'react-native-svg/lib/module/elements'],
    ["import { View } from 'react-native-web';", 'react-native-web'],
    ["const Svg = require('react-native-svg');", 'react-native-svg'],
    ["const mod = await import('react-native');", 'react-native'],
    ["export { View } from 'react-native';", 'react-native'],
    ["import { colors } from '@hangul-route/design-system';", '@hangul-route/design-system'],
    ["import { colors } from '..';", '..'],
    ["import { colors } from '.';", '.'],
    ["import { colors } from '../index';", '../index'],
    ["import { colors } from '../../index.ts';", '../../index.ts'],
    ["import { KoreanText } from '../components/KoreanText';", '../components/KoreanText'],
    ["import { HeritageCardArt } from './components/HeritageCardArt/HeritageCardArt';", './components/HeritageCardArt/HeritageCardArt'],
  ])('flags %s', (source, specifier) => {
    expect(impureImports(source)).toEqual([specifier]);
  });

  it.each([
    "import { colors } from '../tokens';",
    "import type { Glyph } from './types';",
    "import { builders } from '../word-art/builders';",
    "import { glyphFor } from '@hangul-route/design-system/word-art';",
    "import { readFileSync } from 'node:fs';",
    "export { tone } from './tones';",
    "const reactive = 'react';",
  ])('lets %s through', (source) => {
    expect(impureImports(source)).toEqual([]);
  });

  it('scans every TypeScript and JavaScript flavour, not only .ts/.tsx', () => {
    for (const name of ['a.ts', 'a.tsx', 'a.js', 'a.jsx', 'a.mjs', 'a.cjs', 'a.mts', 'a.cts']) {
      expect(SCANNED_SOURCE.test(name), name).toBe(true);
    }
    for (const name of ['a.json', 'a.md', 'a.svg']) expect(SCANNED_SOURCE.test(name), name).toBe(false);
  });
});
