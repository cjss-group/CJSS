
(() => {

  /**
   * Get value of a rule's property and remove surrounding parentheses, if present.
   * @param {CSSStyleRule} rule The CSSStyleRule, which to select from.
   * @param {String} propertyName The name/key which to select.
   * @returns {String} The contents of the given property, or empty if no such
   * rule exists.
   **/
  function getPureProperty(rule, propertyName) {
    const raw = rule.style.getPropertyValue(propertyName);
    return raw.trim().replace(/^\(([\s\S]*)\)$/g,'$1');
  }

  /**
   * Get the rule list for a given stylesheet
   *
   * @param {CSSStyleSheet} styleSheet The stylesheet in to get the rules from.
   * @returns {CSSRuleList} The rules of this stylesheet.
   */
  function ruleList(styleSheet) {
    return styleSheet.rules || styleSheet.cssRules;
  }

  /**
   * Runs CJSS rules - CSS rules with the special properties `--html`,
   * `--js` and `--data`.
   * 
   * @param {CSSRuleList} rules An array-like object of CJSS rules.
   **/
  function cjss(rules) {
    for (const rule of rules) {

      // Handle imports recursively
      if (rule instanceof CSSImportRule) {
        const importedRules = ruleList(rule.styleSheet);
        cjss(importedRules);
      }

      else if (rule instanceof CSSStyleRule) {
        const selector = rule.style.parentRule.selectorText;
        const elements = document.querySelectorAll(selector);

        const js = getPureProperty(rule, '--js');
        const html = getPureProperty(rule, '--html');
        const rawData = getPureProperty(rule, '--data');

        const data = rawData ? JSON.parse(`{ ${rawData} }`) : {};
        if (html) {
          const renderHTML = new Function('yield,data', `return \`${html}\`;`);
          for (const element of elements) {
            element.innerHTML = renderHTML(element.innerHTML, data);
          }
        }

        if (js) {
          const action = new Function('data', js);
          if (selector === 'script') action(data);
          else for (const element of elements) {
            action.call(element, data);
          }
        }
      }
    }
  }

  /**
   * Plug every stylesheet in the document into the cjss function.
   */
  function initialize() {
    for (const sheet of document.styleSheets) {
      const rules = ruleList(sheet);
      if (rules) cjss(rules);
    }
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();