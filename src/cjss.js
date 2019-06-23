import getProperty from './getProperty';
import ruleList from './ruleList';
import { getPlugin } from './registerPlugin';
import Stage from './Stage';
import CJSSError from './CJSSError';

/** @typedef {import('./registerPlugin').Renderer} Renderer */
/** @typedef {import('./Stage').default} Stage */
/** @typedef {(e: CJSSError, element?: HTMLElement) => void} ErrorLogger */
/** @typedef {{logError: () => ErrorLogger, run: Renderer, stage: Stage}} CompiledStage */
/** @typedef {{selector: string, stages: CompiledStage[], processed: Set<Node>}} CompiledRule */

/**
 * Prepare one CJSS rule, handling the properties `--html`, `--js` and `--data`.
 *
 * @param {CSSRule} rule The rule to parse.
 * @returns {CompiledRule[]} Zero or one compiled rule, depending on whethere any CJSS code is
 *   present.
 */
function compileRule(rule) {
  const selector = rule.style.parentRule.selectorText;

  /** @type {CompiledStage[]} */
  const stages = [];
  const compiledRule = { selector, stages, processed: new Set() };

  /**
   * Create a function for logging a parse error, providing contextual information too.
   * @param {string} stage The current build stage.
   * @param {string} mode The current build mode.
   * @param {string} body The source code being run.
   * @returns {ErrorLogger} an error logger that takes an error object and optionally an element.
   */
  const buildErrorLogger = (stage, mode, body) => (e, element = null) => {
    console.error(e.message, e.original);
    if (element) console.error(`at selector '${selector}' and element`, element);
    else console.error(`at selector '${selector}'`);
    console.error(`in script ${stage}: ${mode}(${body})`);
  };

  for (const stage of Stage.ordered) {
    const property = getProperty(rule, stage)
      || (stage.fallback && getProperty(rule, stage.fallback));
    if (!property) continue;
    const { mode, body } = property;
    const logError = buildErrorLogger(stage, mode, body);
    try {
      stages.push({
        logError, selector, run: getPlugin(stage, mode)(body), stage,
      });
    } catch (e) {
      if (e instanceof CJSSError) {
        logError(e);
        // TODO: in the case of an error, should we skip this element or every element?
        break;
      } throw e;
    }
  }

  return stages.length ? [compiledRule] : [];
}

/**
 * Transform an array by replacing each item with zero or more items.
 *
 * @param {ArrayLike<A>} arrayLike The iterable to start with.
 * @param {(x: A) => B} f A function to turn an item into an array.
 * @template A, B
 */
const flatMap = (arrayLike, f) => [].concat(...Array.from(arrayLike).map(f));

/**
 * Compile all rules in the given stylesheet.
 *
 * This function recurses when a CSS `@import` declaration is found.
 *
 * @param {CSSStyleSheet} styleSheet The stylesheet to compile the rules in.
 * @returns {CompiledStage[]} The compiled form of all rules, ready to be run.
 */
export function compileRules(styleSheet) {
  const rules = ruleList(styleSheet);
  return flatMap(rules, (rule) => {
    if (rule instanceof CSSImportRule) return compileRules(rule.styleSheet);
    if (rule instanceof CSSStyleRule) return compileRule(rule);
    return [];
  });
}

/**
 * Compile all rules in all loaded stylesheets,.
 * @returns {CompiledStage[]} The compiled form of all rules, ready to be run.
 */
export function compileAllRules() {
  return flatMap(document.styleSheets, compileRules);
}

/**
 * Run all the compiled rules, marking each element with the rule number to avoid confusion.
 * @param {CompiledRule[]} rules
 * @param {number?} limit
 * @param {Node} subtree
 */
export function runRules(rules, limit = Infinity, subtree = document) {
  for (const [i, rule] of rules.entries()) {
    if (i > limit) break;
    /** @type {Iterable<Node>} */
    const elements = rule.selector === 'script' ? [null] : subtree.querySelectorAll(rule.selector);

    for (const element of elements) {
      rule.processed = rule.processed || new Set();
      if (rule.processed.has(element)) continue;
      rule.processed.add(element);

      const updatesBody = rule.stages.some(stage => stage.stage === Stage.BODY);

      let data = {};
      for (const stage of rule.stages) {
        try {
          data = stage.run(element, data) || data;
        } catch (e) {
          if (e instanceof CJSSError) {
            stage.logError(e, element);
            // TODO: in the case of an error, should we skip this element or every element?
            break;
          } throw e;
        }
      }
      if (updatesBody) runRules(rules, i, element);
    }
  }
}

/**
 * Compile and run all rules in all loaded stylesheets.
 */
export default function cjss() {
  const compiledRules = compileAllRules();
  runRules(compiledRules);
}
