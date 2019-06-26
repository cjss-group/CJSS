/**
 * Get the rule list for a given stylesheet
 *
 * @param {CSSStyleSheet} styleSheet The stylesheet to get the rules from.
 * @returns {CSSRuleList | CSSRule[]} The rules of this stylesheet.
 */
export default function ruleList(styleSheet) {
  try {
    return styleSheet.rules || styleSheet.cssRules || [];
  } catch (e) {
    if (e.name !== 'SecurityError') throw e;
    return [];
  }
}
