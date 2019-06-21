/**
 * Prepare a JavaScript string for execution.
 * 
 * @param {string} code The JavaScript code block to execute.
 * @param {string[]} variables The names of the variables to be passed to the
 *   block.
 * @returns {(values: { [name: string]: any; }, context?: any) => any}
 *   A function to execute `code`, with the values passed in and `this` set to
 *   the context argument. This function will return
 */
export default function prepareFunction(code, variables = []) {
  const fn = new Function(...variables, code);
  return (values, context = null) => 
    fn.apply(context, variables.map(k => values[k]));
}

/**
 * Evaluate a string containing JavaScript.
 * @param {string} code The JavaScript code block to execute.
 * @param {Object} variables Variables to pass through to the code block.
 * @param {any} context The `this` variable inside the code block. Omit for
 *   global scope.
 */
export function safeEval(code, variables = {}, context = null) {
  return prepareFunction(code, Object.keys(variables))(variables, context);
}