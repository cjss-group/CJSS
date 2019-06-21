import getPureProperty from './getPureProperty';
import safeEval from './safeEval';
import ruleList from './ruleList';

/**
   * Runs CJSS rules - CSS rules with the special properties `--html`,
   * `--js` and `--data`.
   *
   * @param {CSSStyleSheet} styleSheet The stylesheet from which to run the rules.
   */
export default function cjss(styleSheet) {
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
          element.innerHTML = safeEval(
            `return (\`${ html }\`)`,
            {
              data,
              yield: element.innerHTML
            },
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

