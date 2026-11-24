// Accessibility lint gate for packages/design-system (AMENDMENTS-A11Y-CI AC-3, section 3.2).
//
// Only accessibility rules are on: eslint-plugin-react-native-a11y (its legacy `configs` are unusable in flat
// config, so the rules are listed by hand) and the local rule hangul-route/touchable-has-name (OD-AC7), which
// lives in this package (./eslint/touchable-has-name.mjs).
// Run by `pnpm lint` as `eslint --no-inline-config --max-warnings=0 "src/**/*.tsx"`:
//   - --no-inline-config: no `eslint-disable` comment can cover an accessibility violation;
//   - there are no violations today, so there is no eslint-suppressions.json.
import tsParser from '@typescript-eslint/parser';
import reactNativeA11y from 'eslint-plugin-react-native-a11y';
import touchableHasName from './eslint/touchable-has-name.mjs';

export default [
  // Non-test .tsx only; `.ts` files hold no JSX.
  { ignores: ['**/__tests__/**', '**/*.test.tsx', '**/__generated__/**'] },
  {
    files: ['**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-native-a11y': reactNativeA11y,
      'hangul-route': { rules: { 'touchable-has-name': touchableHasName } },
    },
    rules: {
      'react-native-a11y/has-accessibility-props': 'error',
      'react-native-a11y/has-valid-accessibility-actions': 'error',
      'react-native-a11y/has-valid-accessibility-component-type': 'error',
      'react-native-a11y/has-valid-accessibility-descriptors': 'error',
      'react-native-a11y/has-valid-accessibility-ignores-invert-colors': 'error',
      'react-native-a11y/has-valid-accessibility-live-region': 'error',
      'react-native-a11y/has-valid-accessibility-role': 'error',
      'react-native-a11y/has-valid-accessibility-state': 'error',
      'react-native-a11y/has-valid-accessibility-states': 'error',
      'react-native-a11y/has-valid-accessibility-traits': 'error',
      'react-native-a11y/has-valid-accessibility-value': 'error',
      'react-native-a11y/has-valid-important-for-accessibility': 'error',
      'react-native-a11y/no-nested-touchables': 'error',
      // has-accessibility-hint is off: about 515 hits, and WCAG does not require hints (spec D6).
      'react-native-a11y/has-accessibility-hint': 'off',
      // ignoreHidden is a rule option (section 3.3, false positives): a Pressable that assistive tech never reaches, such as
      // a dimmed backdrop (accessible={false} or aria-hidden), needs no name.
      'hangul-route/touchable-has-name': ['error', { ignoreHidden: true }],
    },
  },
];
