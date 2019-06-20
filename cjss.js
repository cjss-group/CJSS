
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
   * Convert lazy JavaScript syntax for a JSON object into strict JSON ready
   * for parsing.
   * 
   * In the lazy syntax, trailing commas are allowed, single-quoted strings
   * are allowed, and object keys do not have to be quoted.
   *
   * @param {String} json JSON in JavaScript syntax.
   * @returns {String} JSON converted to strict syntax.
   */
  const preprocessJSON = json => `{${json
    .replace(/'([^\\']*(?:(?:(?:\\.))+[^\\']*)*)'/g,(_,str) =>
      `"${str.replace("\\'","'").replace(/((?:[^\\]|^)(?:\\.)*)"/,'$1\\"')}"`
    ).replace(/([^{,\s]*[^{,\s'"])\s*:/g,'"$1":')
    .replace(/,\s*(]|}|$)/g,'$1')
  }}`;

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
        cjss(rule.styleSheet);
      }

      else if (rule instanceof CSSStyleRule) {
        const selector = rule.style.parentRule.selectorText;
        const elements = document.querySelectorAll(selector);

        const js = getPureProperty(rule, '--js');
        const html = getPureProperty(rule, '--html');
        const rawData = getPureProperty(rule, '--data');

        let data = rawData ? JSON.parse(preprocessJSON(rawData)) : {};

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
  
  if (['complete','interactive','loaded'].includes(document.readyState)) {
     initialize();
  } else document.addEventListener('DOMContentLoaded', initialize);
})();