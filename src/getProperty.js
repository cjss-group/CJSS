/** @typedef {{ mode?: string, body: string }} CJSSProperty */

/**
 * Get the value of a rule's CJSS property.
 *
 * @param {CSSStyleRule} rule The CSS rule from which to extract the property.
 * @param {String} propertyName The key to look for, without the leading `--`.
 * @returns {CJSSProperty?} The pair of the mode and the body.
 */
export default function getProperty(rule, propertyName) {
  const raw = rule.style.getPropertyValue(`--${propertyName}`).trim();
  if (!raw) return null;
  let match;
  // an optional JavaScript identifier, followed a body in parentheses.
  if ((match = raw.match(/^([-0-9A-Z_$]*)\s*\(([\s\S]*)\)$/i))) {
    return { mode: match[1], body: match[2] };
  }
  // If the parentheses are not found, just return the raw string.
  return { body: raw };
}
