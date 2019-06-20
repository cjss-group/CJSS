
(() => {

  /**
   * Get value of a rule's property and remove surrounding parentheses.
   * @param rule The CSSStyleRule, which to select from.
   * @param propertyName The name/key which to select.
   **/
  function getPureProperty(rule, propertyName) {
    const raw = rule.style.getPropertyValue(propertyName);
    return raw.trim().slice(1, -1);
  }

  /**
   * Evaluate a string containing JavaScript.
   * @param code The JavaScript code.
   * @param _this The "this" variable inside the script. Set it to null for global scope.
   * @param variables Local variables. Type [Object]. Keys and values correspond to the variable names and values.
   */
  function safeEval(code, _this = {}, variables = {}) {
    const argumentNames = Object.keys(variables);
    const argumentValues = Object.values(variables);

    const fn = new Function(...argumentNames, code);
    return fn.apply(_this, argumentValues);
  }

  /**
   * Runs CJSS rules - CSS rules with the special properties --html, --js and --data.
   * @param rules An array of CJSS rules.
   **/
  function cjss(rules) {
    for (let rule of rules) {
      const ruleName = rule.constructor.name;

      // Handle imports (recursive)
      if (ruleName === 'CSSImportRule') {
        try {
          const importedRules = rule.styleSheet.cssRules;
          if (importedRules) cjss(importedRules);
        } catch (e) {
          if (e.name !== "SecurityError") throw e;
        }
      }

      else if (ruleName === 'CSSStyleRule') {
        const selector = rule.style.parentRule.selectorText;
        const elements = document.querySelectorAll(selector);

        let js = getPureProperty(rule, '--js');
        let html = getPureProperty(rule, '--html');
        let data = getPureProperty(rule, '--data');

        if (data) {
          data = safeEval(`return ({ ${ data } })`);
        }

        if (html) {
          for (let element of elements) {
            const yield = element.innerHTML;

            element.innerHTML = safeEval(
              `return (\`${ html }\`)`,
              element,
              { data, yield }
            );
          }
        }

        if (js) {
          if (selector === 'script') {
            safeEval(js, null, { data });
            continue;
          }

          for (let element of elements) {
            safeEval(js, element, { data });
          }
        }
      }
    }
  }

  /**
   * Plug every stylesheet in the document into the cjss function.
   */
  function initialize() {
    for (let sheet of document.styleSheets) {
      const rules = sheet.rules || sheet.cssRules;

      if (!rules || !rules.length) continue;
      cjss(rules);
    }
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();