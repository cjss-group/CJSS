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
   * @param variables Local variables. Type [Object]. Keys and values correspond to the variable names and values.
   * @param _this The "this" variable inside the script. null indicates global scope.
   */
  function safeEval(code, variables = {}, _this = null) {
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
        const importedRules = rule.styleSheet.cssRules;
        cjss(importedRules);
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
              { data, yield },
              element
            );
          }
        }

        if (js) {
          if (selector === 'script') {
            safeEval(js, { data });
            continue;
          }

          for (let element of elements) {
            safeEval(js, { data }, element);
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