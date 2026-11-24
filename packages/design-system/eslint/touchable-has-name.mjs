/**
 * hangul-route/touchable-has-name (AMENDMENTS-A11Y-CI section 3.2, OD-AC7).
 *
 * eslint-plugin-react-native-a11y accepts `<Pressable accessibilityRole="button" onPress={go}><Icon name="speaker" /></Pressable>`:
 * it has a role but no name. This rule closes that gap. It reports a touchable, or an element whose
 * `accessibilityRole` / `role` is a control role, when ALL of these hold:
 *   - it has no accessibilityLabel, aria-label, aria-labelledby or accessibilityLabelledBy;
 *   - it has no spread attribute;
 *   - no child is JSX text or a `{...}` expression;
 *   - no child is an element other than Icon, Image or svg.
 *
 * It accepts `aria-label`, where the plugin's has-valid-accessibility-descriptors does not.
 *
 * Option `ignoreHidden` (default false; AMENDMENTS-A11Y-CI section 3.3, the false-positive path "a rule option"):
 * skip an element that is hidden from assistive technology (`accessible={false}`, `aria-hidden`,
 * `accessibilityElementsHidden`, or `importantForAccessibility="no-hide-descendants"`; plain `no` is Android-only and does not count). A screen
 * reader never reaches it, so it needs no name; the repository's dimmed-backdrop Pressables are this case.
 * Plain ESM with no imports, so ESLint loads it from any workspace through the package `exports` entry
 * `@hangul-route/design-system/eslint/touchable-has-name`.
 */

const TOUCHABLES = new Set([
  'Pressable',
  'Touchable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'TouchableBounce',
]);

const CONTROL_ROLES = new Set(['button', 'link', 'checkbox', 'switch', 'radio', 'tab', 'menuitem']);

const NAME_PROPS = new Set(['accessibilityLabel', 'aria-label', 'aria-labelledby', 'accessibilityLabelledBy']);

/** Children that carry no name of their own. */
const NAMELESS_CHILDREN = new Set(['Icon', 'Image', 'svg']);

function elementName(nameNode) {
  if (nameNode.type === 'JSXIdentifier') return nameNode.name;
  if (nameNode.type === 'JSXMemberExpression') return `${elementName(nameNode.object)}.${nameNode.property.name}`;
  return '';
}

function attributeName(attr) {
  if (attr.type !== 'JSXAttribute') return null;
  return attr.name.type === 'JSXIdentifier' ? attr.name.name : null;
}

/** The string a role attribute is set to, or null when it is not a plain string literal. */
function roleValue(attr) {
  const value = attr.value;
  if (!value) return null;
  if (value.type === 'Literal' && typeof value.value === 'string') return value.value;
  if (
    value.type === 'JSXExpressionContainer' &&
    value.expression.type === 'Literal' &&
    typeof value.expression.value === 'string'
  ) {
    return value.expression.value;
  }
  return null;
}

function hasControlRole(attributes) {
  return attributes.some((attr) => {
    const name = attributeName(attr);
    if (name !== 'accessibilityRole' && name !== 'role') return false;
    const value = roleValue(attr);
    return value !== null && CONTROL_ROLES.has(value);
  });
}

/** The literal value of an attribute: true for a bare attribute, else the string/boolean literal, else undefined. */
function literalValue(attr) {
  const value = attr.value;
  if (value === null) return true;
  if (value.type === 'Literal') return value.value;
  if (value.type === 'JSXExpressionContainer' && value.expression.type === 'Literal') return value.expression.value;
  return undefined;
}

function isHiddenFromAssistiveTech(attributes) {
  return attributes.some((attr) => {
    const name = attributeName(attr);
    if (name === null) return false;
    const value = literalValue(attr);
    switch (name) {
      case 'accessible':
        return value === false;
      case 'aria-hidden':
      case 'accessibilityElementsHidden':
        return value === true || value === 'true';
      case 'importantForAccessibility':
        // `no` alone is Android-only (iOS ignores it), so it does not hide the element from VoiceOver.
        return value === 'no-hide-descendants';
      default:
        return false;
    }
  });
}

/** True when a child could give the control a name, or is an element this rule cannot judge. */
function childMayName(child) {
  switch (child.type) {
    case 'JSXText':
      return child.value.trim() !== '';
    case 'JSXExpressionContainer':
      // `{/* comment */}` holds no expression, so it names nothing.
      return child.expression.type !== 'JSXEmptyExpression';
    case 'JSXElement':
      return !NAMELESS_CHILDREN.has(elementName(child.openingElement.name));
    default:
      // fragments and spread children: not judged here
      return true;
  }
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A touchable, or an element with a control role, needs an accessible name',
    },
    schema: [
      {
        type: 'object',
        properties: { ignoreHidden: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      missingName:
        'This control has no accessible name. Add accessibilityLabel (or aria-label), or give it text content.',
    },
  },
  create(context) {
    const ignoreHidden = context.options[0]?.ignoreHidden === true;
    return {
      JSXElement(node) {
        const opening = node.openingElement;
        const attributes = opening.attributes;
        const isTouchable = TOUCHABLES.has(elementName(opening.name));
        if (!isTouchable && !hasControlRole(attributes)) return;
        if (attributes.some((attr) => attr.type === 'JSXSpreadAttribute')) return;
        if (ignoreHidden && isHiddenFromAssistiveTech(attributes)) return;
        if (attributes.some((attr) => NAME_PROPS.has(attributeName(attr) ?? ''))) return;
        if (node.children.some(childMayName)) return;
        context.report({ node: opening, messageId: 'missingName' });
      },
    };
  },
};

export default rule;
