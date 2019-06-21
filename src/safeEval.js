/**
 * Evaluate a string containing JavaScript.
 * @param code The JavaScript code.
 * @param variables Local variables. Type [Object]. Keys and values correspond to the variable names and values.
 * @param _this The "this" variable inside the script. null indicates global scope.
 */
export default function safeEval(code, variables = {}, _this = null) {
  const argumentNames = Object.keys(variables);
  const argumentValues = Object.values(variables);

  const fn = new Function(...argumentNames, code);
  return fn.apply(_this, argumentValues);
}