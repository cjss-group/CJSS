/**
 * Evaluate a string containing JavaScript.
 * @param {string} code The JavaScript code block to execute.
 * @param {Object} variables Variables to pass through to the code block.
 * @param {any} context The `this` variable inside the code block. Omit for global scope.
 */
export default function safeEval(code, variables = {}, context = null) {
  const argumentNames = Object.keys(variables);
  const argumentValues = Object.values(variables);

  const fn = new Function(...argumentNames, code);
  return fn.apply(context, argumentValues);
}