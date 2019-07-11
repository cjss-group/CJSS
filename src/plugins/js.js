import CJSSError from '../CJSSError';
import { assignBody } from '../PluginHelpers';
import registerPlugin from '../registerPlugin';
import Stage from '../Stage';

/**
 * Prepare a JavaScript plugin, with custom preprocessing and optional input/output of the body.
 *
 * @param {Boolean} isBody Whether this function is being used to generate the body, and so has
 *   access to `yield`, and gives the new children as a return value.
 * @param {*} jsTransformer How to prepare the given JavaScript snippet for execution
 */
const javascriptPlugin = (isBody, jsTransformer = x => x) => (js) => {
  try {
    const f = new Function('data', isBody ? 'yield' : undefined, jsTransformer(js));

    return (element, data) => {
      try {
        if (!isBody) return f.call(element, data);
        return assignBody(element,
          f.call(element, data, [...element.childNodes]));
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
