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
export default function registerPlugin(mode, method, ...includedStages) {
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
export function getPlugin(stage, mode) {
  const plugin = plugins[mode || stage.defaultMode];
  if (!plugin) {
    throw new Error(`CJSS: Unknown Plugin ${mode || `${stage.defaultMode} for mode ${mode}`}`);
  }
  const method = plugin[stage] || plugin.fallback;
  if (!method) throw new Error(`CJSS: Plugin ${mode} does not support stage ${stage}.`);
  return method;
}
