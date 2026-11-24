/**
 * AMENDMENTS-A11Y-CI AC-3 / OD-AC7: the local rule `hangul-route/touchable-has-name`
 * (packages/design-system/eslint/touchable-has-name.mjs). RuleTester cases of section 6, item 4.
 */
import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from '../../eslint/touchable-has-name.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

const missing = [{ messageId: 'missingName' as const }];

tester.run('touchable-has-name', rule, {
  valid: [
    // a text child names it
    { code: '<Pressable accessibilityRole="button" onPress={f}>Save</Pressable>' },
    // an expression child may name it
    { code: '<Pressable accessibilityRole="button" onPress={f}>{label}</Pressable>' },
    // a label names it
    { code: '<Pressable accessibilityRole="button" accessibilityLabel="Hear it" onPress={f}><Icon name="speaker" /></Pressable>' },
    // aria-label names it (the plugin rule would not accept this one)
    { code: '<Pressable aria-label="Hear it" onPress={f}><Icon name="speaker" /></Pressable>' },
    { code: '<Pressable aria-labelledby="x" onPress={f} />' },
    { code: '<Pressable accessibilityLabelledBy="x" onPress={f} />' },
    // a spread may carry the label: not judged
    { code: '<Pressable {...props} accessibilityRole="button"><Icon name="speaker" /></Pressable>' },
    // a child element this rule cannot judge may hold the name
    { code: '<Pressable accessibilityRole="button" onPress={f}><Label id="x" /></Pressable>' },
    { code: '<Pressable accessibilityRole="button" onPress={f}><><Icon name="a" />x</></Pressable>' },
    // not a touchable and not a control role
    { code: '<View><Icon name="speaker" /></View>' },
    { code: '<View accessibilityRole="header"><Icon name="speaker" /></View>' },
    // a role that is not a plain string is not judged
    { code: '<View accessibilityRole={role}><Icon name="speaker" /></View>' },
    { code: '<View accessibilityRole><Icon name="speaker" /></View>' },
    // one of the nameless children plus text still has a name
    { code: '<Pressable accessibilityRole="button" onPress={f}><Icon name="speaker" />Hear</Pressable>' },
    // a member-expression child is an element this rule cannot judge
    { code: '<Pressable accessibilityRole="button" onPress={f}><Foo.Bar /></Pressable>' },
  ],
  invalid: [
    // a role but no name, an Icon child: the realistic regression
    { code: '<Pressable accessibilityRole="button" onPress={f}><Icon name="speaker" /></Pressable>', errors: missing },
    // role only, empty
    { code: '<Pressable accessibilityRole="button" onPress={f} />', errors: missing },
    { code: '<View role="link"><Image source={s} /></View>', errors: missing },
    { code: '<Pressable accessibilityRole={"tab"} onPress={f}><svg /></Pressable>', errors: missing },
    // an empty touchable
    { code: '<TouchableOpacity onPress={f} />', errors: missing },
    { code: '<TouchableOpacity onPress={f}>{/* nothing */}</TouchableOpacity>', errors: missing },
    { code: '<Pressable onPress={f}>\n  <Icon name="speaker" />\n</Pressable>', errors: missing },
    // every control role
    ...['button', 'link', 'checkbox', 'switch', 'radio', 'tab', 'menuitem'].map((role) => ({
      code: `<View accessibilityRole="${role}" />`,
      errors: missing,
    })),
    // a member-expression name that is not a touchable still counts through its role
    { code: '<Foo.Bar role="button" />', errors: missing },
    // hidden from assistive tech is only skipped when the option is on (default off)
    { code: '<Pressable onPress={f} accessible={false} />', errors: missing },
    { code: '<Pressable onPress={f} aria-hidden />', options: [{ ignoreHidden: false }], errors: missing },
    // the option does not skip a control that is not hidden
    { code: '<Pressable onPress={f} accessible={true} />', options: [{ ignoreHidden: true }], errors: missing },
    { code: '<Pressable onPress={f} aria-hidden={false} />', options: [{ ignoreHidden: true }], errors: missing },
    { code: '<Pressable onPress={f} importantForAccessibility="yes" />', options: [{ ignoreHidden: true }], errors: missing },
    // `no` alone is Android-only: iOS ignores it, so a visible nameless control must still be reported
    { code: '<Pressable onPress={f} importantForAccessibility="no" />', options: [{ ignoreHidden: true }], errors: missing },
    { code: '<Pressable onPress={f} accessible={flag} />', options: [{ ignoreHidden: true }], errors: missing },
  ],
});

// ignoreHidden: a dimmed-backdrop Pressable that assistive tech never reaches needs no name (section 3.3, false positives)
tester.run('touchable-has-name with ignoreHidden', rule, {
  valid: [
    { code: '<Pressable onPress={f} accessible={false} />', options: [{ ignoreHidden: true }] },
    { code: '<Pressable onPress={f} aria-hidden />', options: [{ ignoreHidden: true }] },
    { code: '<Pressable onPress={f} aria-hidden="true" />', options: [{ ignoreHidden: true }] },
    { code: '<Pressable onPress={f} accessibilityElementsHidden />', options: [{ ignoreHidden: true }] },
    { code: '<Pressable onPress={f} importantForAccessibility="no-hide-descendants" />', options: [{ ignoreHidden: true }] },
  ],
  invalid: [],
});
