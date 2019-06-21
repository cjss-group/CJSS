import getPureProperty from './getPureProperty';
import functionFromString from './functionFromString';
import ruleList from './ruleList';

/**
 * Run one CJSS rule, handling the properties `--html`, `--js` and `--data`.
 *
 * @param {CSSRule} rule The rule to parse.
 * @returns {Boolean} Whether the operation was successful.
 */
function processRule(rule) {
  const selector = rule.style.parentRule.selectorText;
  const elements = document.querySelectorAll(selector);

  const js = getPureProperty(rule, '--js');
  const html = getPureProperty(rule, '--html');
  let data = getPureProperty(rule, '--data');

  try {
    data = JSON.parse(`{${ data }}`);
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error(`CJSS: Invalid JSON found at ${ selector }: {${ data }}`);
      console.error(e.message);
      return false;
    } else throw e;
  }

  if (html) {
    for (const element of elements) {
      const code = `return (\`${ html }\`)`;
      const render = functionFromString(code, ['data', 'yield']);

      try {
        element.innerHTML = render.run([data, element.innerHTML]);
      } catch (e) {
        console.error('CJSS: Error in HTML:', e);
        console.error(`at selector '${ selector }' and element`, element);
        console.error(`of script:\n${ js }`);
        return;
      }
    }
  }

  if (js) {
    const jsRunner = functionFromString(js, ["data"]);

    if (selector === 'script') {
      try {
        jsRunner.run([data]);
      } catch (e) {
        console.error('CJSS: Error in JS:', e);
        console.error(`at selector '${ selector }'`);
        console.error(`of script:\n${ js }`);
      }

      return;
    }

    for (const element of elements) {
      try {
        jsRunner.run([data], element);
      } catch (e) {
        console.error('CJSS: Error in JS:', e);
        console.error(`at selector '${ selector }' and element`, element);
        console.error(`of script:\n${ js }`);
        return;
      }
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

  if (rules) for (const rule of rules) {
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
