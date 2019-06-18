(() => {

  // Get value of a rule's property and remove surrounding parentheses.
  function getPureProperty(rule, propertyName) {
    const raw = rule.style.getPropertyValue(propertyName);
    return raw.trim().slice(1, -1);
  }

  function cjss(rules) {
    for (let rule of rules) {
      const ruleName = rule.constructor.name;

      // Handle imports (recursive)
      if (ruleName === 'CSSImportRule') {
        const n = rule.styleSheet.cssRules;
        cjss(n);
      }

      else if (ruleName === 'CSSStyleRule') {
        const selector = rule.style.parentRule.selectorText;
        const element = document.querySelectorAll(selector);

        let js = getPureProperty(rule, '--js');
        let html = getPureProperty(rule, '--html');
        let data = getPureProperty(rule, '--data');

        if (data) {
          data = eval(`({ ${ data } })`);
        }

        if (html) {
          element.forEach((e) => {
            const yield = e.innerHTML;
            e.innerHTML = eval(`\`${ html }\``);
          });
        }

        if (js) {
          if (selector === 'script') eval(js);
          else {
            for (let n = 0; n < element.length; n++) {
              eval(js.replace(/this/g, `document.querySelectorAll('${ selector }')[${ n }]`));
            }
          }
        }
      }
    }
  }

  function initialize() {
    const styleSheetAmount = document.styleSheets.length;

    for (let i = 0; i < styleSheetAmount; ++i) {
      const sheet = document.styleSheets[i];
      const rules = sheet.rules || sheet.cssRules;

      if (!rules) continue;
      cjss(rules);
    }
  }

  document.addEventListener('DOMContentLoaded', initialize);

})();