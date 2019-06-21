import getPureProperty from './getPureProperty';
import safeEval from './safeEval';
import ruleList from './ruleList';

/**
 * Run one CJSS rule, handling the properties `--html`, `--js` and `--data`.
 *
 * @param {CSSRule} rule The rule to parse.
 */
function processRule(rule) {
  const selector = rule.style.parentRule.selectorText;
  const elements = document.querySelectorAll(selector);

  const js = getPureProperty(rule, '--js');
  const html = getPureProperty(rule, '--html');
  let data = getPureProperty(rule, '--data');

  data = data ? JSON.parse(`{${data}}`) : {};

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
    } else for (let element of elements) {
      safeEval(js, { data }, element);
    }
  }
}

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
      processRule(rule);
    }
  }
}