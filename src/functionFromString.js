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
export default function functionFromString(code, argumentNames = []) {
  return new EvalFunction(...argumentNames, code);
}