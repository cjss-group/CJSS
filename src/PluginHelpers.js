/* eslint-disable import/prefer-default-export */

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
export function assignBody(element, body) {
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
}
