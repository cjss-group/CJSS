/**
 * Get value of a rule's property and remove surrounding parentheses.
 * @param rule The CSSStyleRule, which to select from.
 * @param propertyName The name/key which to select.
 **/
export default function getPureProperty(rule, propertyName) {
  const raw = rule.style.getPropertyValue(propertyName);
  return raw.trim().slice(1, -1);
}