/** @typedef {defaultMode?: String, fallback?: String} StageEntry */

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

export default Stage;
