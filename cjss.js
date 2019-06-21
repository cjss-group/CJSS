
(() => {

  /**
   * Get value of a rule's property and remove surrounding parentheses.
   * 
   * @param {CSSStyleRule} rule The CSSStyleRule, which to select from.
   * @param {String} propertyName The name/key which to select.
   * @returns {String} The contents of the given property, or empty if no
   *   such rule exists.
   **/
  function getPureProperty(rule, propertyName) {
    const raw = rule.style.getPropertyValue(propertyName);
    return raw.trim().slice(1, -1);
  }

  /**
   * Evaluate a string containing JavaScript.
   * @param {string} code The JavaScript code block to execute.
   * @param {Object} variables Variables to pass through to the code block.
   * @param {any} context The `this` variable inside the code block. Omit for global scope.
   */
  function safeEval(code, variables = {}, context = null) {
    const argumentNames = Object.keys(variables);
    const argumentValues = Object.values(variables);

    const fn = new Function(...argumentNames, code);
    return fn.apply(context, argumentValues);
  }

  /**
   * Get the rule list for a given stylesheet
   * 
   * @param {CSSStyleSheet} styleSheet The stylesheet to get the rules from.
   * @returns {CSSRuleList} The rules of this stylesheet.
   */
  function ruleList(styleSheet) {
    try {
      return styleSheet.rules || styleSheet.cssRules;
    } catch (e) {
      if (e.name !== "SecurityError") throw e;
    }
  }

  /**
   * Runs CJSS rules - CSS rules with the special properties `--html`,
   * `--js` and `--data`.
   * 
   * @param {CSSStyleSheet} styleSheet The stylesheet from which to run the rules.
   */
  function cjss(styleSheet) {
    const rules = ruleList(styleSheet);
    if (rules) for (let rule of rules) {
      const ruleName = rule.constructor.name;

      // Handle imports (recursive)
      if (ruleName === 'CSSImportRule') {
        cjss(rule.styleSheet);
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
   * Run the CJSS script for every stylesheet in the file.
   */
  function initialize() {
    for (let sheet of document.styleSheets) {
      cjss(sheet);
    }
  }

  document.addEventListener('DOMContentLoaded', initialize);
})();