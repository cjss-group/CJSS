var cjss = (function () {
  'use strict';

  /** @typedef {{ mode?: string, body: string }} CJSSProperty */

  /**
   * Get the value of a rule's CJSS property.
   *
   * @param {CSSStyleRule} rule The CSS rule from which to extract the property.
   * @param {String} propertyName The key to look for, without the leading `--`.
   * @returns {CJSSProperty?} The pair of the mode and the body.
   */
  function getProperty(rule, propertyName) {
    const raw = rule.style.getPropertyValue(`--${propertyName}`).trim();
    if (!raw) return null;
    let match;
    // an optional JavaScript identifier, followed a body in parentheses.
    if ((match = raw.match(/^([-0-9A-Z_$]*)\s*\(([\s\S]*)\)$/i))) {
      return { mode: match[1], body: match[2] };
    }
    // If the parentheses are not found, just return the raw string.
    return { body: raw };
  }

  /**
   * Get the rule list for a given stylesheet
   *
   * @param {CSSStyleSheet} styleSheet The stylesheet to get the rules from.
   * @returns {CSSRuleList | CSSRule[]} The rules of this stylesheet.
   */
  function ruleList(styleSheet) {
    try {
      return styleSheet.rules || styleSheet.cssRules;
    } catch (e) {
      if (e.name !== 'SecurityError') throw e;
      return [];
    }
  }

  /** @typedef {import('./Stage').default} Stage */
  /** @typedef {(element: HTMLElement, data: any) => any} Renderer */
  /** @typedef {(body: String) => Renderer} Compiler */

  /** @typedef {{[stages: Stage]: Compiler} Plugin */

  /** @type {Plugin[]} */
  const plugins = [];

  /**
   * Add a plugin to CJSS, so that a new syntax can be used for processing the
   * CSS.
   *
   * @param {String} mode The identifier for this plugin’s mode.
   * @param {Compiler} method The curried function for compiling and then running
   *   code in this mode. Firstly the compiler receives the string, so it can be
   *   compiled once for each element. Secondly, the compiler receives the
   *   element to apply the code to, as well as the data passed from previous
   *   steps. You should then return the updated data attribute.
   * @param {Stage[]?} includedStages The list of stages that this plugin
   *   supports. Omit this argument to support all stages. You can overload the
   *   plugin for multiple stages, and it does not matter whether you set the
   *   default case first or last.
   */
  function registerPlugin(mode, method, ...includedStages) {
    if (!plugins[mode]) plugins[mode] = {};
    const plugin = plugins[mode];
    const stages = [].concat(...includedStages);
    if (stages.length) for (const stage of stages) plugin[stage] = method;
    else plugin.fallback = method;
  }

  /**
   * Fetch the plugin for the given mode and stage.
   * @param {Stage} stage The rendering stage we are currently in.
   * @param {String} mode The mode to use. If this is omitted, the default for
   *   the stage is used.
   * @returns {Compiler}
   */
  function getPlugin(stage, mode) {
    const plugin = plugins[mode || stage.defaultMode];
    if (!plugin) {
      throw new Error(`CJSS: Unknown Plugin ${mode || `${stage.defaultMode} for mode ${mode}`}`);
    }
    const method = plugin[stage] || plugin.fallback;
    if (!method) throw new Error(`CJSS: Plugin ${mode} does not support stage ${stage}.`);
    return method;
  }

  /** @typedef {{defaultMode?: String, fallback?: String}} StageEntry */

  /**
   * Prepare a stage enum element.
   * @param {string} name The name of the stage, as returned by `.toString()`.
   * @param {string} defaultMode The default mode to fall back to if no mode is given.
   * @param  {string?} fallback Any previous names to go by, for backwards compatibility.
   */
  function makeStage(name, defaultMode, fallback) {
    return Object.freeze({
      toString: () => name,
      defaultMode,
      fallback,
    });
  }

  /**
   * The different stages of rendering.
   * @enum {StageEntry}
   */
  const Stage = {
    DATA: makeStage('data', 'json'),
    PREPARE: makeStage('prepare', 'js'),
    BODY: makeStage('body', 'html', 'html'),
    SCRIPT: makeStage('script', 'js', 'js'),
    /** @type {Stage[]} */
    ordered: [],
  };
  Stage.ordered = Object.freeze([Stage.DATA, Stage.PREPARE, Stage.BODY, Stage.SCRIPT]);
  Object.freeze(Stage);

  /**
   * Provide a custom error class for any errors caused by the user within CJSS.
   *
   * These are used interally for throwing and catching, and should never reach
   * the end user other than in the console.
   *
   * @property {Error} original The original error thrown while parsing/running
   *   the script.
   */
  class CJSSError extends Error {
    constructor(message, original) {
      super(message);
      this.name = 'CJSSError';
      /**
       * The original error thrown while parsing/running the script.
       * @type {Error}
       */
      this.original = original;
    }
  }

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
  function compileRules(styleSheet) {
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
  function compileAllRules() {
    return flatMap(document.styleSheets, compileRules);
  }

  /**
   * Run all the compiled rules, marking each element with the rule number to avoid confusion.
   * @param {CompiledRule[]} rules
   * @param {number?} limit
   * @param {Node} subtree
   */
  function runRules(rules, limit = Infinity, subtree = document) {
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
  function cjss() {
    const compiledRules = compileAllRules();
    runRules(compiledRules);
  }

  /**
   * A `Function` helper class.
   */
  class EvalFunction extends Function {
    /**
     * Evaluate the function and provide arguments and `this`-context.
     * @param {Array} args Variables to pass into the function.
     * @param {any} context The `this` variable inside the code block. Omit for global scope.
     */
    run(args = [], context = null) {
      return this.apply(context, args);
    }
  }

  /**
   * Generates a function from a string containing JavaScript.
   * @param {string} code The JavaScript code block to execute.
   * @param {string[]} argumentNames List of argument-names.
   */
  function functionFromString(code, argumentNames = []) {
    return new EvalFunction(...argumentNames, code);
  }

  /**
   * JSON: only for the data stage. The code given will be wrapped in curly
   * braces and parsed as JSON without interpolation.
   */
  registerPlugin('json', body => () => {
    try {
      return JSON.parse(body);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new CJSSError(`CJSS: ${e.name} in JSON:`, e);
      } throw e;
    }
  }, Stage.DATA);

  /**
   * HTML: only for the body stage. The code given will be treated as a
   * JavaScript template string, so interpolation is possible with ${}.
   *
   * You have access to the variables `data` (as set in previous build steps)
   * and `yield` (the HTML code for the contents). Note that this will destroy
   * any event listeners previously bound to the children.
   */
  registerPlugin('html', (body) => {
    const code = `return \`${body}\``;
    try {
      const render = functionFromString(code, ['data', 'yield']);

      return (element, data) => {
        try {
          element.innerHTML = render.call(element, data, element.innerHTML);
        } catch (e) {
          throw new CJSSError(`CJSS: ${e.name} in HTML evaluation:`, e);
        }
      };
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new CJSSError(`CJSS: ${e.name} in HTML string parsing:`, e);
      } throw e;
    }
  }, Stage.BODY);

  /**
   * Replace the children of an element.
   *
   * - If `body` is undefined, no replacement occurs.
   * - If body is `null` or `[]`, the children are removed, so the element
   *     becomes empty.
   * - If a string is given, it is rendered as HTML code.
   * - If a `Node` is given, it is set as the only child.
   * - If an array is given, each child is added as a child, having been
   *     converted to a text node if necessary.
   *
   * @param {Node} element The element in question.
   * @param {any} body The child or children to add to the element.
   */
  const assignBody = (element, body) => {
    const isIterable = x => x instanceof Object && Symbol.iterator in x;
    if (typeof body === 'string' || body instanceof String) {
      element.innerHTML = body;
      return;
    }
    if (body === undefined) return;
    while (element.firstChild) element.firstChild.remove();
    const addElement = (b) => {
      if (b === null) return;
      if (isIterable(b)) for (const child of b) addElement(child);
      else if (b instanceof Node) element.appendChild(b);
      else element.appendChild(document.createTextNode(b));
    };
    addElement(body);
  };

  const javascriptPlugin = (isBody, jsTransformer = x => x) => (js) => {
    try {
      const f = functionFromString(jsTransformer(js), isBody ? ['data', 'yield'] : ['data']);

      return (element, data) => {
        try {
          if (!isBody) return f.call(element, data);
          return assignBody(element, f.call(element, data, [...element.childNodes]));
        } catch (e) {
          throw new CJSSError(`CJSS: ${e.name} in JS:`, e);
        }
      };
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new CJSSError(`CJSS: ${e.name} in JavaScript parsing:`, e);
      } throw e;
    }
  };

  /**
   * JavaScript: for any stage. There are three modes: `js` and `js-expr`.
   *
   * - `js` evaluates as a block of code, and so return values need the return keyword.
   * - `js-expr` evaluates as a single expression.
   *
   * You always have access to the variable `data` (as set in previous build steps), and during the
   * body stage you also have `yield` (an array of node contents). This means that events and other
   * properties remain bound, unlike in HTML, which goes via innerHTML.
   *
   * In the body stage, the return value is used to replace the contents of the element. If the
   * return value is undefined, no changes are made, otherwise the existing contents are removed. If
   * a string is provided, it is parsed as HTML. If a node is returned, it is added directly as the
   * only child. If an array is returned, its elements are recursively added as nodes or text nodes.
   *
   * In any other stage, the return value is assigned as `data` for the use of the future build
   * phases. If no object is returned, the value of `data` is not updated.
   */
  registerPlugin('js', javascriptPlugin(false));
  registerPlugin('js', javascriptPlugin(true), Stage.BODY);

  registerPlugin('js-expr', javascriptPlugin(false, js => `return (${js});`));
  registerPlugin('js-expr', javascriptPlugin(true, js => `return (${js});`), Stage.BODY);

  const documentReady = new Promise((resolve) => {
    if (['complete', 'interactive', 'loaded'].includes(document.readyState)) resolve();
    else document.addEventListener('DOMContentLoaded', resolve);
  }).then(() => document);

  documentReady.then(() => cjss());

  var index = {
    // This can be globally accessed via cjss.render()
    render: cjss,
    registerPlugin,
  };

  return index;

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2pzcy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2dldFByb3BlcnR5LmpzIiwiLi4vLi4vc3JjL3J1bGVMaXN0LmpzIiwiLi4vLi4vc3JjL3JlZ2lzdGVyUGx1Z2luLmpzIiwiLi4vLi4vc3JjL1N0YWdlLmpzIiwiLi4vLi4vc3JjL0NKU1NFcnJvci5qcyIsIi4uLy4uL3NyYy9janNzLmpzIiwiLi4vLi4vc3JjL2Z1bmN0aW9uRnJvbVN0cmluZy5qcyIsIi4uLy4uL3NyYy9kZWZhdWx0UGx1Z2lucy5qcyIsIi4uLy4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiogQHR5cGVkZWYge3sgbW9kZT86IHN0cmluZywgYm9keTogc3RyaW5nIH19IENKU1NQcm9wZXJ0eSAqL1xuXG4vKipcbiAqIEdldCB0aGUgdmFsdWUgb2YgYSBydWxlJ3MgQ0pTUyBwcm9wZXJ0eS5cbiAqXG4gKiBAcGFyYW0ge0NTU1N0eWxlUnVsZX0gcnVsZSBUaGUgQ1NTIHJ1bGUgZnJvbSB3aGljaCB0byBleHRyYWN0IHRoZSBwcm9wZXJ0eS5cbiAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wZXJ0eU5hbWUgVGhlIGtleSB0byBsb29rIGZvciwgd2l0aG91dCB0aGUgbGVhZGluZyBgLS1gLlxuICogQHJldHVybnMge0NKU1NQcm9wZXJ0eT99IFRoZSBwYWlyIG9mIHRoZSBtb2RlIGFuZCB0aGUgYm9keS5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gZ2V0UHJvcGVydHkocnVsZSwgcHJvcGVydHlOYW1lKSB7XG4gIGNvbnN0IHJhdyA9IHJ1bGUuc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZShgLS0ke3Byb3BlcnR5TmFtZX1gKS50cmltKCk7XG4gIGlmICghcmF3KSByZXR1cm4gbnVsbDtcbiAgbGV0IG1hdGNoO1xuICAvLyBhbiBvcHRpb25hbCBKYXZhU2NyaXB0IGlkZW50aWZpZXIsIGZvbGxvd2VkIGEgYm9keSBpbiBwYXJlbnRoZXNlcy5cbiAgaWYgKChtYXRjaCA9IHJhdy5tYXRjaCgvXihbLTAtOUEtWl8kXSopXFxzKlxcKChbXFxzXFxTXSopXFwpJC9pKSkpIHtcbiAgICByZXR1cm4geyBtb2RlOiBtYXRjaFsxXSwgYm9keTogbWF0Y2hbMl0gfTtcbiAgfVxuICAvLyBJZiB0aGUgcGFyZW50aGVzZXMgYXJlIG5vdCBmb3VuZCwganVzdCByZXR1cm4gdGhlIHJhdyBzdHJpbmcuXG4gIHJldHVybiB7IGJvZHk6IHJhdyB9O1xufVxuIiwiLyoqXG4gKiBHZXQgdGhlIHJ1bGUgbGlzdCBmb3IgYSBnaXZlbiBzdHlsZXNoZWV0XG4gKlxuICogQHBhcmFtIHtDU1NTdHlsZVNoZWV0fSBzdHlsZVNoZWV0IFRoZSBzdHlsZXNoZWV0IHRvIGdldCB0aGUgcnVsZXMgZnJvbS5cbiAqIEByZXR1cm5zIHtDU1NSdWxlTGlzdCB8IENTU1J1bGVbXX0gVGhlIHJ1bGVzIG9mIHRoaXMgc3R5bGVzaGVldC5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gcnVsZUxpc3Qoc3R5bGVTaGVldCkge1xuICB0cnkge1xuICAgIHJldHVybiBzdHlsZVNoZWV0LnJ1bGVzIHx8IHN0eWxlU2hlZXQuY3NzUnVsZXM7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZS5uYW1lICE9PSAnU2VjdXJpdHlFcnJvcicpIHRocm93IGU7XG4gICAgcmV0dXJuIFtdO1xuICB9XG59XG4iLCIvKiogQHR5cGVkZWYge2ltcG9ydCgnLi9TdGFnZScpLmRlZmF1bHR9IFN0YWdlICovXG4vKiogQHR5cGVkZWYgeyhlbGVtZW50OiBIVE1MRWxlbWVudCwgZGF0YTogYW55KSA9PiBhbnl9IFJlbmRlcmVyICovXG4vKiogQHR5cGVkZWYgeyhib2R5OiBTdHJpbmcpID0+IFJlbmRlcmVyfSBDb21waWxlciAqL1xuXG4vKiogQHR5cGVkZWYge3tbc3RhZ2VzOiBTdGFnZV06IENvbXBpbGVyfSBQbHVnaW4gKi9cblxuLyoqIEB0eXBlIHtQbHVnaW5bXX0gKi9cbmNvbnN0IHBsdWdpbnMgPSBbXTtcblxuLyoqXG4gKiBBZGQgYSBwbHVnaW4gdG8gQ0pTUywgc28gdGhhdCBhIG5ldyBzeW50YXggY2FuIGJlIHVzZWQgZm9yIHByb2Nlc3NpbmcgdGhlXG4gKiBDU1MuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG1vZGUgVGhlIGlkZW50aWZpZXIgZm9yIHRoaXMgcGx1Z2lu4oCZcyBtb2RlLlxuICogQHBhcmFtIHtDb21waWxlcn0gbWV0aG9kIFRoZSBjdXJyaWVkIGZ1bmN0aW9uIGZvciBjb21waWxpbmcgYW5kIHRoZW4gcnVubmluZ1xuICogICBjb2RlIGluIHRoaXMgbW9kZS4gRmlyc3RseSB0aGUgY29tcGlsZXIgcmVjZWl2ZXMgdGhlIHN0cmluZywgc28gaXQgY2FuIGJlXG4gKiAgIGNvbXBpbGVkIG9uY2UgZm9yIGVhY2ggZWxlbWVudC4gU2Vjb25kbHksIHRoZSBjb21waWxlciByZWNlaXZlcyB0aGVcbiAqICAgZWxlbWVudCB0byBhcHBseSB0aGUgY29kZSB0bywgYXMgd2VsbCBhcyB0aGUgZGF0YSBwYXNzZWQgZnJvbSBwcmV2aW91c1xuICogICBzdGVwcy4gWW91IHNob3VsZCB0aGVuIHJldHVybiB0aGUgdXBkYXRlZCBkYXRhIGF0dHJpYnV0ZS5cbiAqIEBwYXJhbSB7U3RhZ2VbXT99IGluY2x1ZGVkU3RhZ2VzIFRoZSBsaXN0IG9mIHN0YWdlcyB0aGF0IHRoaXMgcGx1Z2luXG4gKiAgIHN1cHBvcnRzLiBPbWl0IHRoaXMgYXJndW1lbnQgdG8gc3VwcG9ydCBhbGwgc3RhZ2VzLiBZb3UgY2FuIG92ZXJsb2FkIHRoZVxuICogICBwbHVnaW4gZm9yIG11bHRpcGxlIHN0YWdlcywgYW5kIGl0IGRvZXMgbm90IG1hdHRlciB3aGV0aGVyIHlvdSBzZXQgdGhlXG4gKiAgIGRlZmF1bHQgY2FzZSBmaXJzdCBvciBsYXN0LlxuICovXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZWdpc3RlclBsdWdpbihtb2RlLCBtZXRob2QsIC4uLmluY2x1ZGVkU3RhZ2VzKSB7XG4gIGlmICghcGx1Z2luc1ttb2RlXSkgcGx1Z2luc1ttb2RlXSA9IHt9O1xuICBjb25zdCBwbHVnaW4gPSBwbHVnaW5zW21vZGVdO1xuICBjb25zdCBzdGFnZXMgPSBbXS5jb25jYXQoLi4uaW5jbHVkZWRTdGFnZXMpO1xuICBpZiAoc3RhZ2VzLmxlbmd0aCkgZm9yIChjb25zdCBzdGFnZSBvZiBzdGFnZXMpIHBsdWdpbltzdGFnZV0gPSBtZXRob2Q7XG4gIGVsc2UgcGx1Z2luLmZhbGxiYWNrID0gbWV0aG9kO1xufVxuXG4vKipcbiAqIEZldGNoIHRoZSBwbHVnaW4gZm9yIHRoZSBnaXZlbiBtb2RlIGFuZCBzdGFnZS5cbiAqIEBwYXJhbSB7U3RhZ2V9IHN0YWdlIFRoZSByZW5kZXJpbmcgc3RhZ2Ugd2UgYXJlIGN1cnJlbnRseSBpbi5cbiAqIEBwYXJhbSB7U3RyaW5nfSBtb2RlIFRoZSBtb2RlIHRvIHVzZS4gSWYgdGhpcyBpcyBvbWl0dGVkLCB0aGUgZGVmYXVsdCBmb3JcbiAqICAgdGhlIHN0YWdlIGlzIHVzZWQuXG4gKiBAcmV0dXJucyB7Q29tcGlsZXJ9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRQbHVnaW4oc3RhZ2UsIG1vZGUpIHtcbiAgY29uc3QgcGx1Z2luID0gcGx1Z2luc1ttb2RlIHx8IHN0YWdlLmRlZmF1bHRNb2RlXTtcbiAgaWYgKCFwbHVnaW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYENKU1M6IFVua25vd24gUGx1Z2luICR7bW9kZSB8fCBgJHtzdGFnZS5kZWZhdWx0TW9kZX0gZm9yIG1vZGUgJHttb2RlfWB9YCk7XG4gIH1cbiAgY29uc3QgbWV0aG9kID0gcGx1Z2luW3N0YWdlXSB8fCBwbHVnaW4uZmFsbGJhY2s7XG4gIGlmICghbWV0aG9kKSB0aHJvdyBuZXcgRXJyb3IoYENKU1M6IFBsdWdpbiAke21vZGV9IGRvZXMgbm90IHN1cHBvcnQgc3RhZ2UgJHtzdGFnZX0uYCk7XG4gIHJldHVybiBtZXRob2Q7XG59XG4iLCIvKiogQHR5cGVkZWYge3tkZWZhdWx0TW9kZT86IFN0cmluZywgZmFsbGJhY2s/OiBTdHJpbmd9fSBTdGFnZUVudHJ5ICovXG5cbi8qKlxuICogUHJlcGFyZSBhIHN0YWdlIGVudW0gZWxlbWVudC5cbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIFRoZSBuYW1lIG9mIHRoZSBzdGFnZSwgYXMgcmV0dXJuZWQgYnkgYC50b1N0cmluZygpYC5cbiAqIEBwYXJhbSB7c3RyaW5nfSBkZWZhdWx0TW9kZSBUaGUgZGVmYXVsdCBtb2RlIHRvIGZhbGwgYmFjayB0byBpZiBubyBtb2RlIGlzIGdpdmVuLlxuICogQHBhcmFtICB7c3RyaW5nP30gZmFsbGJhY2sgQW55IHByZXZpb3VzIG5hbWVzIHRvIGdvIGJ5LCBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkuXG4gKi9cbmZ1bmN0aW9uIG1ha2VTdGFnZShuYW1lLCBkZWZhdWx0TW9kZSwgZmFsbGJhY2spIHtcbiAgcmV0dXJuIE9iamVjdC5mcmVlemUoe1xuICAgIHRvU3RyaW5nOiAoKSA9PiBuYW1lLFxuICAgIGRlZmF1bHRNb2RlLFxuICAgIGZhbGxiYWNrLFxuICB9KTtcbn1cblxuLyoqXG4gKiBUaGUgZGlmZmVyZW50IHN0YWdlcyBvZiByZW5kZXJpbmcuXG4gKiBAZW51bSB7U3RhZ2VFbnRyeX1cbiAqL1xuY29uc3QgU3RhZ2UgPSB7XG4gIERBVEE6IG1ha2VTdGFnZSgnZGF0YScsICdqc29uJyksXG4gIFBSRVBBUkU6IG1ha2VTdGFnZSgncHJlcGFyZScsICdqcycpLFxuICBCT0RZOiBtYWtlU3RhZ2UoJ2JvZHknLCAnaHRtbCcsICdodG1sJyksXG4gIFNDUklQVDogbWFrZVN0YWdlKCdzY3JpcHQnLCAnanMnLCAnanMnKSxcbiAgLyoqIEB0eXBlIHtTdGFnZVtdfSAqL1xuICBvcmRlcmVkOiBbXSxcbn07XG5TdGFnZS5vcmRlcmVkID0gT2JqZWN0LmZyZWV6ZShbU3RhZ2UuREFUQSwgU3RhZ2UuUFJFUEFSRSwgU3RhZ2UuQk9EWSwgU3RhZ2UuU0NSSVBUXSk7XG5PYmplY3QuZnJlZXplKFN0YWdlKTtcblxuZXhwb3J0IGRlZmF1bHQgU3RhZ2U7XG4iLCIvKipcbiAqIFByb3ZpZGUgYSBjdXN0b20gZXJyb3IgY2xhc3MgZm9yIGFueSBlcnJvcnMgY2F1c2VkIGJ5IHRoZSB1c2VyIHdpdGhpbiBDSlNTLlxuICpcbiAqIFRoZXNlIGFyZSB1c2VkIGludGVyYWxseSBmb3IgdGhyb3dpbmcgYW5kIGNhdGNoaW5nLCBhbmQgc2hvdWxkIG5ldmVyIHJlYWNoXG4gKiB0aGUgZW5kIHVzZXIgb3RoZXIgdGhhbiBpbiB0aGUgY29uc29sZS5cbiAqXG4gKiBAcHJvcGVydHkge0Vycm9yfSBvcmlnaW5hbCBUaGUgb3JpZ2luYWwgZXJyb3IgdGhyb3duIHdoaWxlIHBhcnNpbmcvcnVubmluZ1xuICogICB0aGUgc2NyaXB0LlxuICovXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBDSlNTRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1lc3NhZ2UsIG9yaWdpbmFsKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5uYW1lID0gJ0NKU1NFcnJvcic7XG4gICAgLyoqXG4gICAgICogVGhlIG9yaWdpbmFsIGVycm9yIHRocm93biB3aGlsZSBwYXJzaW5nL3J1bm5pbmcgdGhlIHNjcmlwdC5cbiAgICAgKiBAdHlwZSB7RXJyb3J9XG4gICAgICovXG4gICAgdGhpcy5vcmlnaW5hbCA9IG9yaWdpbmFsO1xuICB9XG59XG4iLCJpbXBvcnQgZ2V0UHJvcGVydHkgZnJvbSAnLi9nZXRQcm9wZXJ0eSc7XG5pbXBvcnQgcnVsZUxpc3QgZnJvbSAnLi9ydWxlTGlzdCc7XG5pbXBvcnQgeyBnZXRQbHVnaW4gfSBmcm9tICcuL3JlZ2lzdGVyUGx1Z2luJztcbmltcG9ydCBTdGFnZSBmcm9tICcuL1N0YWdlJztcbmltcG9ydCBDSlNTRXJyb3IgZnJvbSAnLi9DSlNTRXJyb3InO1xuXG4vKiogQHR5cGVkZWYge2ltcG9ydCgnLi9yZWdpc3RlclBsdWdpbicpLlJlbmRlcmVyfSBSZW5kZXJlciAqL1xuLyoqIEB0eXBlZGVmIHtpbXBvcnQoJy4vU3RhZ2UnKS5kZWZhdWx0fSBTdGFnZSAqL1xuLyoqIEB0eXBlZGVmIHsoZTogQ0pTU0Vycm9yLCBlbGVtZW50PzogSFRNTEVsZW1lbnQpID0+IHZvaWR9IEVycm9yTG9nZ2VyICovXG4vKiogQHR5cGVkZWYge3tsb2dFcnJvcjogKCkgPT4gRXJyb3JMb2dnZXIsIHJ1bjogUmVuZGVyZXIsIHN0YWdlOiBTdGFnZX19IENvbXBpbGVkU3RhZ2UgKi9cbi8qKiBAdHlwZWRlZiB7e3NlbGVjdG9yOiBzdHJpbmcsIHN0YWdlczogQ29tcGlsZWRTdGFnZVtdLCBwcm9jZXNzZWQ6IFNldDxOb2RlPn19IENvbXBpbGVkUnVsZSAqL1xuXG4vKipcbiAqIFByZXBhcmUgb25lIENKU1MgcnVsZSwgaGFuZGxpbmcgdGhlIHByb3BlcnRpZXMgYC0taHRtbGAsIGAtLWpzYCBhbmQgYC0tZGF0YWAuXG4gKlxuICogQHBhcmFtIHtDU1NSdWxlfSBydWxlIFRoZSBydWxlIHRvIHBhcnNlLlxuICogQHJldHVybnMge0NvbXBpbGVkUnVsZVtdfSBaZXJvIG9yIG9uZSBjb21waWxlZCBydWxlLCBkZXBlbmRpbmcgb24gd2hldGhlcmUgYW55IENKU1MgY29kZSBpc1xuICogICBwcmVzZW50LlxuICovXG5mdW5jdGlvbiBjb21waWxlUnVsZShydWxlKSB7XG4gIGNvbnN0IHNlbGVjdG9yID0gcnVsZS5zdHlsZS5wYXJlbnRSdWxlLnNlbGVjdG9yVGV4dDtcblxuICAvKiogQHR5cGUge0NvbXBpbGVkU3RhZ2VbXX0gKi9cbiAgY29uc3Qgc3RhZ2VzID0gW107XG4gIGNvbnN0IGNvbXBpbGVkUnVsZSA9IHsgc2VsZWN0b3IsIHN0YWdlcywgcHJvY2Vzc2VkOiBuZXcgU2V0KCkgfTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgZnVuY3Rpb24gZm9yIGxvZ2dpbmcgYSBwYXJzZSBlcnJvciwgcHJvdmlkaW5nIGNvbnRleHR1YWwgaW5mb3JtYXRpb24gdG9vLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gc3RhZ2UgVGhlIGN1cnJlbnQgYnVpbGQgc3RhZ2UuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBtb2RlIFRoZSBjdXJyZW50IGJ1aWxkIG1vZGUuXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBib2R5IFRoZSBzb3VyY2UgY29kZSBiZWluZyBydW4uXG4gICAqIEByZXR1cm5zIHtFcnJvckxvZ2dlcn0gYW4gZXJyb3IgbG9nZ2VyIHRoYXQgdGFrZXMgYW4gZXJyb3Igb2JqZWN0IGFuZCBvcHRpb25hbGx5IGFuIGVsZW1lbnQuXG4gICAqL1xuICBjb25zdCBidWlsZEVycm9yTG9nZ2VyID0gKHN0YWdlLCBtb2RlLCBib2R5KSA9PiAoZSwgZWxlbWVudCA9IG51bGwpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKGUubWVzc2FnZSwgZS5vcmlnaW5hbCk7XG4gICAgaWYgKGVsZW1lbnQpIGNvbnNvbGUuZXJyb3IoYGF0IHNlbGVjdG9yICcke3NlbGVjdG9yfScgYW5kIGVsZW1lbnRgLCBlbGVtZW50KTtcbiAgICBlbHNlIGNvbnNvbGUuZXJyb3IoYGF0IHNlbGVjdG9yICcke3NlbGVjdG9yfSdgKTtcbiAgICBjb25zb2xlLmVycm9yKGBpbiBzY3JpcHQgJHtzdGFnZX06ICR7bW9kZX0oJHtib2R5fSlgKTtcbiAgfTtcblxuICBmb3IgKGNvbnN0IHN0YWdlIG9mIFN0YWdlLm9yZGVyZWQpIHtcbiAgICBjb25zdCBwcm9wZXJ0eSA9IGdldFByb3BlcnR5KHJ1bGUsIHN0YWdlKVxuICAgICAgfHwgKHN0YWdlLmZhbGxiYWNrICYmIGdldFByb3BlcnR5KHJ1bGUsIHN0YWdlLmZhbGxiYWNrKSk7XG4gICAgaWYgKCFwcm9wZXJ0eSkgY29udGludWU7XG4gICAgY29uc3QgeyBtb2RlLCBib2R5IH0gPSBwcm9wZXJ0eTtcbiAgICBjb25zdCBsb2dFcnJvciA9IGJ1aWxkRXJyb3JMb2dnZXIoc3RhZ2UsIG1vZGUsIGJvZHkpO1xuICAgIHRyeSB7XG4gICAgICBzdGFnZXMucHVzaCh7XG4gICAgICAgIGxvZ0Vycm9yLCBzZWxlY3RvciwgcnVuOiBnZXRQbHVnaW4oc3RhZ2UsIG1vZGUpKGJvZHkpLCBzdGFnZSxcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgQ0pTU0Vycm9yKSB7XG4gICAgICAgIGxvZ0Vycm9yKGUpO1xuICAgICAgICAvLyBUT0RPOiBpbiB0aGUgY2FzZSBvZiBhbiBlcnJvciwgc2hvdWxkIHdlIHNraXAgdGhpcyBlbGVtZW50IG9yIGV2ZXJ5IGVsZW1lbnQ/XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBzdGFnZXMubGVuZ3RoID8gW2NvbXBpbGVkUnVsZV0gOiBbXTtcbn1cblxuLyoqXG4gKiBUcmFuc2Zvcm0gYW4gYXJyYXkgYnkgcmVwbGFjaW5nIGVhY2ggaXRlbSB3aXRoIHplcm8gb3IgbW9yZSBpdGVtcy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5TGlrZTxBPn0gYXJyYXlMaWtlIFRoZSBpdGVyYWJsZSB0byBzdGFydCB3aXRoLlxuICogQHBhcmFtIHsoeDogQSkgPT4gQn0gZiBBIGZ1bmN0aW9uIHRvIHR1cm4gYW4gaXRlbSBpbnRvIGFuIGFycmF5LlxuICogQHRlbXBsYXRlIEEsIEJcbiAqL1xuY29uc3QgZmxhdE1hcCA9IChhcnJheUxpa2UsIGYpID0+IFtdLmNvbmNhdCguLi5BcnJheS5mcm9tKGFycmF5TGlrZSkubWFwKGYpKTtcblxuLyoqXG4gKiBDb21waWxlIGFsbCBydWxlcyBpbiB0aGUgZ2l2ZW4gc3R5bGVzaGVldC5cbiAqXG4gKiBUaGlzIGZ1bmN0aW9uIHJlY3Vyc2VzIHdoZW4gYSBDU1MgYEBpbXBvcnRgIGRlY2xhcmF0aW9uIGlzIGZvdW5kLlxuICpcbiAqIEBwYXJhbSB7Q1NTU3R5bGVTaGVldH0gc3R5bGVTaGVldCBUaGUgc3R5bGVzaGVldCB0byBjb21waWxlIHRoZSBydWxlcyBpbi5cbiAqIEByZXR1cm5zIHtDb21waWxlZFN0YWdlW119IFRoZSBjb21waWxlZCBmb3JtIG9mIGFsbCBydWxlcywgcmVhZHkgdG8gYmUgcnVuLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZVJ1bGVzKHN0eWxlU2hlZXQpIHtcbiAgY29uc3QgcnVsZXMgPSBydWxlTGlzdChzdHlsZVNoZWV0KTtcbiAgcmV0dXJuIGZsYXRNYXAocnVsZXMsIChydWxlKSA9PiB7XG4gICAgaWYgKHJ1bGUgaW5zdGFuY2VvZiBDU1NJbXBvcnRSdWxlKSByZXR1cm4gY29tcGlsZVJ1bGVzKHJ1bGUuc3R5bGVTaGVldCk7XG4gICAgaWYgKHJ1bGUgaW5zdGFuY2VvZiBDU1NTdHlsZVJ1bGUpIHJldHVybiBjb21waWxlUnVsZShydWxlKTtcbiAgICByZXR1cm4gW107XG4gIH0pO1xufVxuXG4vKipcbiAqIENvbXBpbGUgYWxsIHJ1bGVzIGluIGFsbCBsb2FkZWQgc3R5bGVzaGVldHMsLlxuICogQHJldHVybnMge0NvbXBpbGVkU3RhZ2VbXX0gVGhlIGNvbXBpbGVkIGZvcm0gb2YgYWxsIHJ1bGVzLCByZWFkeSB0byBiZSBydW4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb21waWxlQWxsUnVsZXMoKSB7XG4gIHJldHVybiBmbGF0TWFwKGRvY3VtZW50LnN0eWxlU2hlZXRzLCBjb21waWxlUnVsZXMpO1xufVxuXG4vKipcbiAqIFJ1biBhbGwgdGhlIGNvbXBpbGVkIHJ1bGVzLCBtYXJraW5nIGVhY2ggZWxlbWVudCB3aXRoIHRoZSBydWxlIG51bWJlciB0byBhdm9pZCBjb25mdXNpb24uXG4gKiBAcGFyYW0ge0NvbXBpbGVkUnVsZVtdfSBydWxlc1xuICogQHBhcmFtIHtudW1iZXI/fSBsaW1pdFxuICogQHBhcmFtIHtOb2RlfSBzdWJ0cmVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBydW5SdWxlcyhydWxlcywgbGltaXQgPSBJbmZpbml0eSwgc3VidHJlZSA9IGRvY3VtZW50KSB7XG4gIGZvciAoY29uc3QgW2ksIHJ1bGVdIG9mIHJ1bGVzLmVudHJpZXMoKSkge1xuICAgIGlmIChpID4gbGltaXQpIGJyZWFrO1xuICAgIC8qKiBAdHlwZSB7SXRlcmFibGU8Tm9kZT59ICovXG4gICAgY29uc3QgZWxlbWVudHMgPSBydWxlLnNlbGVjdG9yID09PSAnc2NyaXB0JyA/IFtudWxsXSA6IHN1YnRyZWUucXVlcnlTZWxlY3RvckFsbChydWxlLnNlbGVjdG9yKTtcblxuICAgIGZvciAoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cykge1xuICAgICAgcnVsZS5wcm9jZXNzZWQgPSBydWxlLnByb2Nlc3NlZCB8fCBuZXcgU2V0KCk7XG4gICAgICBpZiAocnVsZS5wcm9jZXNzZWQuaGFzKGVsZW1lbnQpKSBjb250aW51ZTtcbiAgICAgIHJ1bGUucHJvY2Vzc2VkLmFkZChlbGVtZW50KTtcblxuICAgICAgY29uc3QgdXBkYXRlc0JvZHkgPSBydWxlLnN0YWdlcy5zb21lKHN0YWdlID0+IHN0YWdlLnN0YWdlID09PSBTdGFnZS5CT0RZKTtcblxuICAgICAgbGV0IGRhdGEgPSB7fTtcbiAgICAgIGZvciAoY29uc3Qgc3RhZ2Ugb2YgcnVsZS5zdGFnZXMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBkYXRhID0gc3RhZ2UucnVuKGVsZW1lbnQsIGRhdGEpIHx8IGRhdGE7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIENKU1NFcnJvcikge1xuICAgICAgICAgICAgc3RhZ2UubG9nRXJyb3IoZSwgZWxlbWVudCk7XG4gICAgICAgICAgICAvLyBUT0RPOiBpbiB0aGUgY2FzZSBvZiBhbiBlcnJvciwgc2hvdWxkIHdlIHNraXAgdGhpcyBlbGVtZW50IG9yIGV2ZXJ5IGVsZW1lbnQ/XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9IHRocm93IGU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh1cGRhdGVzQm9keSkgcnVuUnVsZXMocnVsZXMsIGksIGVsZW1lbnQpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIENvbXBpbGUgYW5kIHJ1biBhbGwgcnVsZXMgaW4gYWxsIGxvYWRlZCBzdHlsZXNoZWV0cy5cbiAqL1xuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gY2pzcygpIHtcbiAgY29uc3QgY29tcGlsZWRSdWxlcyA9IGNvbXBpbGVBbGxSdWxlcygpO1xuICBydW5SdWxlcyhjb21waWxlZFJ1bGVzKTtcbn1cbiIsIi8qKlxuICogQSBgRnVuY3Rpb25gIGhlbHBlciBjbGFzcy5cbiAqL1xuY2xhc3MgRXZhbEZ1bmN0aW9uIGV4dGVuZHMgRnVuY3Rpb24ge1xuICAvKipcbiAgICogRXZhbHVhdGUgdGhlIGZ1bmN0aW9uIGFuZCBwcm92aWRlIGFyZ3VtZW50cyBhbmQgYHRoaXNgLWNvbnRleHQuXG4gICAqIEBwYXJhbSB7QXJyYXl9IGFyZ3MgVmFyaWFibGVzIHRvIHBhc3MgaW50byB0aGUgZnVuY3Rpb24uXG4gICAqIEBwYXJhbSB7YW55fSBjb250ZXh0IFRoZSBgdGhpc2AgdmFyaWFibGUgaW5zaWRlIHRoZSBjb2RlIGJsb2NrLiBPbWl0IGZvciBnbG9iYWwgc2NvcGUuXG4gICAqL1xuICBydW4oYXJncyA9IFtdLCBjb250ZXh0ID0gbnVsbCkge1xuICAgIHJldHVybiB0aGlzLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICB9XG59XG5cbi8qKlxuICogR2VuZXJhdGVzIGEgZnVuY3Rpb24gZnJvbSBhIHN0cmluZyBjb250YWluaW5nIEphdmFTY3JpcHQuXG4gKiBAcGFyYW0ge3N0cmluZ30gY29kZSBUaGUgSmF2YVNjcmlwdCBjb2RlIGJsb2NrIHRvIGV4ZWN1dGUuXG4gKiBAcGFyYW0ge3N0cmluZ1tdfSBhcmd1bWVudE5hbWVzIExpc3Qgb2YgYXJndW1lbnQtbmFtZXMuXG4gKi9cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGZ1bmN0aW9uRnJvbVN0cmluZyhjb2RlLCBhcmd1bWVudE5hbWVzID0gW10pIHtcbiAgcmV0dXJuIG5ldyBFdmFsRnVuY3Rpb24oLi4uYXJndW1lbnROYW1lcywgY29kZSk7XG59XG4iLCJpbXBvcnQgcmVnaXN0ZXJQbHVnaW4gZnJvbSAnLi9yZWdpc3RlclBsdWdpbic7XG5pbXBvcnQgZnVuY3Rpb25Gcm9tU3RyaW5nIGZyb20gJy4vZnVuY3Rpb25Gcm9tU3RyaW5nJztcbmltcG9ydCBTdGFnZSBmcm9tICcuL1N0YWdlJztcbmltcG9ydCBDSlNTRXJyb3IgZnJvbSAnLi9DSlNTRXJyb3InO1xuXG4vKipcbiAqIEpTT046IG9ubHkgZm9yIHRoZSBkYXRhIHN0YWdlLiBUaGUgY29kZSBnaXZlbiB3aWxsIGJlIHdyYXBwZWQgaW4gY3VybHlcbiAqIGJyYWNlcyBhbmQgcGFyc2VkIGFzIEpTT04gd2l0aG91dCBpbnRlcnBvbGF0aW9uLlxuICovXG5yZWdpc3RlclBsdWdpbignanNvbicsIGJvZHkgPT4gKCkgPT4ge1xuICB0cnkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKGJvZHkpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKGUgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikge1xuICAgICAgdGhyb3cgbmV3IENKU1NFcnJvcihgQ0pTUzogJHtlLm5hbWV9IGluIEpTT046YCwgZSk7XG4gICAgfSB0aHJvdyBlO1xuICB9XG59LCBTdGFnZS5EQVRBKTtcblxuLyoqXG4gKiBIVE1MOiBvbmx5IGZvciB0aGUgYm9keSBzdGFnZS4gVGhlIGNvZGUgZ2l2ZW4gd2lsbCBiZSB0cmVhdGVkIGFzIGFcbiAqIEphdmFTY3JpcHQgdGVtcGxhdGUgc3RyaW5nLCBzbyBpbnRlcnBvbGF0aW9uIGlzIHBvc3NpYmxlIHdpdGggJHt9LlxuICpcbiAqIFlvdSBoYXZlIGFjY2VzcyB0byB0aGUgdmFyaWFibGVzIGBkYXRhYCAoYXMgc2V0IGluIHByZXZpb3VzIGJ1aWxkIHN0ZXBzKVxuICogYW5kIGB5aWVsZGAgKHRoZSBIVE1MIGNvZGUgZm9yIHRoZSBjb250ZW50cykuIE5vdGUgdGhhdCB0aGlzIHdpbGwgZGVzdHJveVxuICogYW55IGV2ZW50IGxpc3RlbmVycyBwcmV2aW91c2x5IGJvdW5kIHRvIHRoZSBjaGlsZHJlbi5cbiAqL1xucmVnaXN0ZXJQbHVnaW4oJ2h0bWwnLCAoYm9keSkgPT4ge1xuICBjb25zdCBjb2RlID0gYHJldHVybiBcXGAke2JvZHl9XFxgYDtcbiAgdHJ5IHtcbiAgICBjb25zdCByZW5kZXIgPSBmdW5jdGlvbkZyb21TdHJpbmcoY29kZSwgWydkYXRhJywgJ3lpZWxkJ10pO1xuXG4gICAgcmV0dXJuIChlbGVtZW50LCBkYXRhKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBlbGVtZW50LmlubmVySFRNTCA9IHJlbmRlci5jYWxsKGVsZW1lbnQsIGRhdGEsIGVsZW1lbnQuaW5uZXJIVE1MKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IENKU1NFcnJvcihgQ0pTUzogJHtlLm5hbWV9IGluIEhUTUwgZXZhbHVhdGlvbjpgLCBlKTtcbiAgICAgIH1cbiAgICB9O1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKGUgaW5zdGFuY2VvZiBTeW50YXhFcnJvcikge1xuICAgICAgdGhyb3cgbmV3IENKU1NFcnJvcihgQ0pTUzogJHtlLm5hbWV9IGluIEhUTUwgc3RyaW5nIHBhcnNpbmc6YCwgZSk7XG4gICAgfSB0aHJvdyBlO1xuICB9XG59LCBTdGFnZS5CT0RZKTtcblxuLyoqXG4gKiBSZXBsYWNlIHRoZSBjaGlsZHJlbiBvZiBhbiBlbGVtZW50LlxuICpcbiAqIC0gSWYgYGJvZHlgIGlzIHVuZGVmaW5lZCwgbm8gcmVwbGFjZW1lbnQgb2NjdXJzLlxuICogLSBJZiBib2R5IGlzIGBudWxsYCBvciBgW11gLCB0aGUgY2hpbGRyZW4gYXJlIHJlbW92ZWQsIHNvIHRoZSBlbGVtZW50XG4gKiAgICAgYmVjb21lcyBlbXB0eS5cbiAqIC0gSWYgYSBzdHJpbmcgaXMgZ2l2ZW4sIGl0IGlzIHJlbmRlcmVkIGFzIEhUTUwgY29kZS5cbiAqIC0gSWYgYSBgTm9kZWAgaXMgZ2l2ZW4sIGl0IGlzIHNldCBhcyB0aGUgb25seSBjaGlsZC5cbiAqIC0gSWYgYW4gYXJyYXkgaXMgZ2l2ZW4sIGVhY2ggY2hpbGQgaXMgYWRkZWQgYXMgYSBjaGlsZCwgaGF2aW5nIGJlZW5cbiAqICAgICBjb252ZXJ0ZWQgdG8gYSB0ZXh0IG5vZGUgaWYgbmVjZXNzYXJ5LlxuICpcbiAqIEBwYXJhbSB7Tm9kZX0gZWxlbWVudCBUaGUgZWxlbWVudCBpbiBxdWVzdGlvbi5cbiAqIEBwYXJhbSB7YW55fSBib2R5IFRoZSBjaGlsZCBvciBjaGlsZHJlbiB0byBhZGQgdG8gdGhlIGVsZW1lbnQuXG4gKi9cbmNvbnN0IGFzc2lnbkJvZHkgPSAoZWxlbWVudCwgYm9keSkgPT4ge1xuICBjb25zdCBpc0l0ZXJhYmxlID0geCA9PiB4IGluc3RhbmNlb2YgT2JqZWN0ICYmIFN5bWJvbC5pdGVyYXRvciBpbiB4O1xuICBpZiAodHlwZW9mIGJvZHkgPT09ICdzdHJpbmcnIHx8IGJvZHkgaW5zdGFuY2VvZiBTdHJpbmcpIHtcbiAgICBlbGVtZW50LmlubmVySFRNTCA9IGJvZHk7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChib2R5ID09PSB1bmRlZmluZWQpIHJldHVybjtcbiAgd2hpbGUgKGVsZW1lbnQuZmlyc3RDaGlsZCkgZWxlbWVudC5maXJzdENoaWxkLnJlbW92ZSgpO1xuICBjb25zdCBhZGRFbGVtZW50ID0gKGIpID0+IHtcbiAgICBpZiAoYiA9PT0gbnVsbCkgcmV0dXJuO1xuICAgIGlmIChpc0l0ZXJhYmxlKGIpKSBmb3IgKGNvbnN0IGNoaWxkIG9mIGIpIGFkZEVsZW1lbnQoY2hpbGQpO1xuICAgIGVsc2UgaWYgKGIgaW5zdGFuY2VvZiBOb2RlKSBlbGVtZW50LmFwcGVuZENoaWxkKGIpO1xuICAgIGVsc2UgZWxlbWVudC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShiKSk7XG4gIH07XG4gIGFkZEVsZW1lbnQoYm9keSk7XG59O1xuXG5jb25zdCBqYXZhc2NyaXB0UGx1Z2luID0gKGlzQm9keSwganNUcmFuc2Zvcm1lciA9IHggPT4geCkgPT4gKGpzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgZiA9IGZ1bmN0aW9uRnJvbVN0cmluZyhqc1RyYW5zZm9ybWVyKGpzKSwgaXNCb2R5ID8gWydkYXRhJywgJ3lpZWxkJ10gOiBbJ2RhdGEnXSk7XG5cbiAgICByZXR1cm4gKGVsZW1lbnQsIGRhdGEpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGlmICghaXNCb2R5KSByZXR1cm4gZi5jYWxsKGVsZW1lbnQsIGRhdGEpO1xuICAgICAgICByZXR1cm4gYXNzaWduQm9keShlbGVtZW50LCBmLmNhbGwoZWxlbWVudCwgZGF0YSwgWy4uLmVsZW1lbnQuY2hpbGROb2Rlc10pKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IENKU1NFcnJvcihgQ0pTUzogJHtlLm5hbWV9IGluIEpTOmAsIGUpO1xuICAgICAgfVxuICAgIH07XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAoZSBpbnN0YW5jZW9mIFN5bnRheEVycm9yKSB7XG4gICAgICB0aHJvdyBuZXcgQ0pTU0Vycm9yKGBDSlNTOiAke2UubmFtZX0gaW4gSmF2YVNjcmlwdCBwYXJzaW5nOmAsIGUpO1xuICAgIH0gdGhyb3cgZTtcbiAgfVxufTtcblxuLyoqXG4gKiBKYXZhU2NyaXB0OiBmb3IgYW55IHN0YWdlLiBUaGVyZSBhcmUgdGhyZWUgbW9kZXM6IGBqc2AgYW5kIGBqcy1leHByYC5cbiAqXG4gKiAtIGBqc2AgZXZhbHVhdGVzIGFzIGEgYmxvY2sgb2YgY29kZSwgYW5kIHNvIHJldHVybiB2YWx1ZXMgbmVlZCB0aGUgcmV0dXJuIGtleXdvcmQuXG4gKiAtIGBqcy1leHByYCBldmFsdWF0ZXMgYXMgYSBzaW5nbGUgZXhwcmVzc2lvbi5cbiAqXG4gKiBZb3UgYWx3YXlzIGhhdmUgYWNjZXNzIHRvIHRoZSB2YXJpYWJsZSBgZGF0YWAgKGFzIHNldCBpbiBwcmV2aW91cyBidWlsZCBzdGVwcyksIGFuZCBkdXJpbmcgdGhlXG4gKiBib2R5IHN0YWdlIHlvdSBhbHNvIGhhdmUgYHlpZWxkYCAoYW4gYXJyYXkgb2Ygbm9kZSBjb250ZW50cykuIFRoaXMgbWVhbnMgdGhhdCBldmVudHMgYW5kIG90aGVyXG4gKiBwcm9wZXJ0aWVzIHJlbWFpbiBib3VuZCwgdW5saWtlIGluIEhUTUwsIHdoaWNoIGdvZXMgdmlhIGlubmVySFRNTC5cbiAqXG4gKiBJbiB0aGUgYm9keSBzdGFnZSwgdGhlIHJldHVybiB2YWx1ZSBpcyB1c2VkIHRvIHJlcGxhY2UgdGhlIGNvbnRlbnRzIG9mIHRoZSBlbGVtZW50LiBJZiB0aGVcbiAqIHJldHVybiB2YWx1ZSBpcyB1bmRlZmluZWQsIG5vIGNoYW5nZXMgYXJlIG1hZGUsIG90aGVyd2lzZSB0aGUgZXhpc3RpbmcgY29udGVudHMgYXJlIHJlbW92ZWQuIElmXG4gKiBhIHN0cmluZyBpcyBwcm92aWRlZCwgaXQgaXMgcGFyc2VkIGFzIEhUTUwuIElmIGEgbm9kZSBpcyByZXR1cm5lZCwgaXQgaXMgYWRkZWQgZGlyZWN0bHkgYXMgdGhlXG4gKiBvbmx5IGNoaWxkLiBJZiBhbiBhcnJheSBpcyByZXR1cm5lZCwgaXRzIGVsZW1lbnRzIGFyZSByZWN1cnNpdmVseSBhZGRlZCBhcyBub2RlcyBvciB0ZXh0IG5vZGVzLlxuICpcbiAqIEluIGFueSBvdGhlciBzdGFnZSwgdGhlIHJldHVybiB2YWx1ZSBpcyBhc3NpZ25lZCBhcyBgZGF0YWAgZm9yIHRoZSB1c2Ugb2YgdGhlIGZ1dHVyZSBidWlsZFxuICogcGhhc2VzLiBJZiBubyBvYmplY3QgaXMgcmV0dXJuZWQsIHRoZSB2YWx1ZSBvZiBgZGF0YWAgaXMgbm90IHVwZGF0ZWQuXG4gKi9cbnJlZ2lzdGVyUGx1Z2luKCdqcycsIGphdmFzY3JpcHRQbHVnaW4oZmFsc2UpKTtcbnJlZ2lzdGVyUGx1Z2luKCdqcycsIGphdmFzY3JpcHRQbHVnaW4odHJ1ZSksIFN0YWdlLkJPRFkpO1xuXG5yZWdpc3RlclBsdWdpbignanMtZXhwcicsIGphdmFzY3JpcHRQbHVnaW4oZmFsc2UsIGpzID0+IGByZXR1cm4gKCR7anN9KTtgKSk7XG5yZWdpc3RlclBsdWdpbignanMtZXhwcicsIGphdmFzY3JpcHRQbHVnaW4odHJ1ZSwganMgPT4gYHJldHVybiAoJHtqc30pO2ApLCBTdGFnZS5CT0RZKTtcbiIsImltcG9ydCBjanNzIGZyb20gJy4vY2pzcyc7XG5pbXBvcnQgcmVnaXN0ZXJQbHVnaW4gZnJvbSAnLi9yZWdpc3RlclBsdWdpbic7XG5pbXBvcnQgJy4vZGVmYXVsdFBsdWdpbnMnO1xuXG5jb25zdCBkb2N1bWVudFJlYWR5ID0gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgaWYgKFsnY29tcGxldGUnLCAnaW50ZXJhY3RpdmUnLCAnbG9hZGVkJ10uaW5jbHVkZXMoZG9jdW1lbnQucmVhZHlTdGF0ZSkpIHJlc29sdmUoKTtcbiAgZWxzZSBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgcmVzb2x2ZSk7XG59KS50aGVuKCgpID0+IGRvY3VtZW50KTtcblxuZG9jdW1lbnRSZWFkeS50aGVuKCgpID0+IGNqc3MoKSk7XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgLy8gVGhpcyBjYW4gYmUgZ2xvYmFsbHkgYWNjZXNzZWQgdmlhIGNqc3MucmVuZGVyKClcbiAgcmVuZGVyOiBjanNzLFxuICByZWdpc3RlclBsdWdpbixcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0VBQUE7O0VBRUE7RUFDQTtFQUNBO0VBQ0E7RUFDQTtFQUNBO0VBQ0E7QUFDQSxFQUFlLFNBQVMsV0FBVyxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7RUFDeEQsRUFBRSxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDLENBQUMsRUFBRSxFQUFFLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztFQUN0RSxFQUFFLElBQUksQ0FBQyxHQUFHLEVBQUUsT0FBTyxJQUFJLENBQUM7RUFDeEIsRUFBRSxJQUFJLEtBQUssQ0FBQztFQUNaO0VBQ0EsRUFBRSxLQUFLLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLG1DQUFtQyxDQUFDLEdBQUc7RUFDaEUsSUFBSSxPQUFPLEVBQUUsSUFBSSxFQUFF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
