// Accessibility lint gate for apps/web (AMENDMENTS-A11Y-CI AC-3, section 3.2).
//
// Only the jsx-a11y rules are on: no style, correctness, react-hooks or typescript-eslint rules.
// Run by `pnpm lint` as `eslint --no-inline-config --max-warnings=0 "src/**/*.tsx"`:
//   - --no-inline-config: no `eslint-disable` comment can cover an accessibility violation;
//   - today's violations are held by eslint-suppressions.json (bulk suppressions, method B, OD-AC5),
//     which only shrinks; AC-3c fixes them and deletes the file.
//
// False positives (section 3.3) are handled here and nowhere else: first by a rule option, and where no option fits
// by a file-scoped `off` for that one rule, each with its reason. Each is listed in the spec's As built and pinned by
// src/app/__tests__/eslint-a11y-config.test.ts. Never a suppression, a disable comment or `--fix`.
import tsParser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const recommended = jsxA11y.flatConfigs.recommended;

// `control-has-associated-label` is off in the published recommended config. It is turned on here, with the
// recommended config's own options: it catches a <button> with no text and no aria-label.
const [, controlHasAssociatedLabelOptions] = recommended.rules['jsx-a11y/control-has-associated-label'];

export default [
  // Non-test .tsx only; `.ts` files hold no JSX.
  { ignores: ['**/__tests__/**', '**/*.test.tsx', '**/__generated__/**'] },
  {
    files: ['**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: recommended.plugins,
    rules: {
      ...recommended.rules,
      'jsx-a11y/control-has-associated-label': ['error', controlHasAssociatedLabelOptions],
      // False positive, by rule option (section 3.3): an explicit role that WebKit needs.
      //   - `<ul|ol role="list">` with `list-style: none`: WebKit drops the list semantics of an unstyled list and
      //     VoiceOver must still say "list, N items" (documented at SiteFooter.tsx and LearningRouteParts.tsx);
      //   - `<thead|tbody role="rowgroup">`: the receipts table is laid out with `display: block` on its parts
      //     (`.hr-bill-table` in BillingHomeParts.tsx), which drops the table semantics the same way.
      // `nav: ['navigation']` is the rule's own default exception, kept because setting options replaces it.
      'jsx-a11y/no-redundant-roles': [
        'error',
        { nav: ['navigation'], ul: ['list'], ol: ['list'], thead: ['rowgroup'], tbody: ['rowgroup'] },
      ],
      // False positive, by rule option (section 3.3): the receipts table's `<td role="cell">`, same reason as above.
      // The rule counts a `td` as interactive (it may be a gridcell); the recommended options keep `tr` and `canvas`.
      'jsx-a11y/no-interactive-element-to-noninteractive-role': [
        'error',
        { tr: ['none', 'presentation'], canvas: ['img'], td: ['cell'] },
      ],
    },
  },
  // False positive, no rule option fits (section 3.3): a modal dialog handles its own Escape and Tab keys on the
  // dialog element, as the WAI-ARIA dialog pattern requires. The rule's options are keyed by element type, not
  // role, so the only one that fits would be `div` for every div. Scoped to the five files with that pattern.
  {
    files: [
      '**/components/console/AttentionParts.tsx',
      '**/components/console/ConfirmSheet.tsx',
      '**/components/console/DisplaySheet.tsx',
      '**/components/console/StepUpDialog.tsx',
      '**/components/console/TransferParts.tsx',
    ],
    rules: { 'jsx-a11y/no-noninteractive-element-interactions': 'off' },
  },
  // False positive, no rule option fits (section 3.3): the radiogroup on the curriculum start step holds the arrow-key
  // handler for its radio chips (roving focus, WAI-ARIA radio group pattern); the chips are the focusable parts.
  {
    files: ['**/app/(console)/teach/space/curriculum/page.tsx'],
    rules: { 'jsx-a11y/interactive-supports-focus': 'off' },
  },
];
