import Stage from '../Stage';
import CJSSError from '../CJSSError';
import registerPlugin from '../registerPlugin';

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
    const render = new Function('data', 'yield', code);

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
