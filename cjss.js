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
          data = eval(`({ ${ data } })`);
        }

        if (html) {
          for (let element of elements) {
            const yield = element.innerHTML;

            // eval could be removed with a "shallow parser".
            element.innerHTML = eval(`\`${ html }\``);
          }
        }

        if (js) {
          if (selector === 'script') {
            eval(js);
            return;
          }

          // There is a lot of room for optimization here.
          for (let n = 0; n < elements.length; n++) {
            eval(js.replace(/this/g, `document.querySelectorAll('${ selector }')[${ n }]`));
          }
        }
      }
    }
  }

  /**
   * Plug every stylesheet into the document into the cjss function.
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