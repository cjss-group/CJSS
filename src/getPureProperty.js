/**
 * Get value of a rule's property and remove surrounding parentheses, if
 * present.
 *
 * @param {CSSStyleRule} rule The CSSStyleRule, which to select from.
 * @param {String} propertyName The name/key which to select.
 * @returns {String} The contents of the given property, or empty if no
 *   such rule exists.
 **/
export default function getPureProperty(rule, propertyName) {
  const raw = rule.style.getPropertyValue(propertyName);
  // If the string starts with '(' and ends with ')', remove those
  // parentheses.
  return raw.trim().replace(/^\(([\s\S]*)\)$/g,'$1');
}