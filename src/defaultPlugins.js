import registerPlugin from './registerPlugin';
import functionFromString from './functionFromString';
import Stage from './Stage';
import CJSSError from './CJSSError';

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
