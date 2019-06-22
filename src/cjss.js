import getProperty from './getProperty';
import ruleList from './ruleList';
import { getPlugin } from './registerPlugin';
import Stage from './Stage';
import CJSSError from './CJSSError';

/**
 * Run one CJSS rule, handling the properties `--html`, `--js` and `--data`.
 *
 * @param {CSSRule} rule The rule to parse.
 * @returns {CompiledRule[]} Zero or one compiled rule, depending on whethere any CJSS code is
 *   present.
 */
function processRule(rule) {
  const selector = rule.style.parentRule.selectorText;
  const elements = selector === 'script' ? [null] : document.querySelectorAll(selector);

  const compiledStages = [];

  for (const stage of Stage.ordered) {
    const property = getProperty(rule, stage)
      || (stage.fallback && getProperty(rule, stage.fallback));
    if (property) {
      const { mode, body } = property;
      try {
        compiledStages.push({
          body, mode, stage, run: getPlugin(stage, mode)(body),
        });
      } catch (e) {
        if (e instanceof CJSSError) {
          console.error(e.message, e.original);
          console.error(`in script ${stage}: ${mode}(${body})`);
          // TODO: in the case of an error, should we skip this element or every element?
          break;
        } throw e;
      }
    }
  }

  for (const element of elements) {
    let data = {};
    for (const compiledStage of compiledStages) {
      try {
        data = compiledStage.run(element, data) || data;
      } catch (e) {
        if (e instanceof CJSSError) {
          console.error(e.message, e.original);
          if (element) console.error(`at selector '${selector}' and element`, element);
          else console.error(`at selector '${selector}'`);
          console.error(`in script ${compiledStage.stage}: ${
            compiledStage.mode}(${compiledStage.body})`);
          // TODO: in the case of an error, should we skip this element or every element?
          break;
        } throw e;
      }
    }
  }
}

/**
 * Runs CJSS rules - CSS rules with the special properties `--html`, `--js` and `--data`.
 *
 * @param {CSSStyleSheet} styleSheet The stylesheet from which to run the rules.
 */
export default function cjss(styleSheet) {
  const rules = ruleList(styleSheet);

  for (const rule of rules) {
    if (rule instanceof CSSImportRule) {
      // Handle imports recursively
      cjss(rule.styleSheet);
    } else if (rule instanceof CSSStyleRule) {
      processRule(rule);
    }
  }
}
