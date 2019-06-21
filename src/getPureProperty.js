/**
 * Get value of a rule's property and remove surrounding parentheses.
 *
 * @param {CSSStyleRule} rule The CSSStyleRule, which to select from.
 * @param {String} propertyName The name/key which to select.
 * @returns {String} The contents of the given property, or empty if no
 *   such rule exists.
 **/
export default function getPureProperty(rule, propertyName) {
  const raw = rule.style.getPropertyValue(propertyName);
  return raw.trim().slice(1, -1);
}