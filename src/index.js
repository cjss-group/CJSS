import cjss from './cjss';
import Stage from './Stage';
import CJSSError from './CJSSError';
import registerPlugin from './registerPlugin';
import * as PluginHelpers from './PluginHelpers';
import './defaultPlugins';

const documentReady = new Promise((resolve) => {
  if (['complete', 'interactive', 'loaded'].includes(document.readyState)) resolve();
  else document.addEventListener('DOMContentLoaded', resolve);
}).then(() => document);

documentReady.then(() => cjss());

export {
  /** `CJSS.render()` runs all the CJSS rewrite rules. */
  cjss as render,

  /** Use `CJSS.Stage.{DATA, PREPARE, BODY, SCRIPT}` to specify the scope of the stage. */
  Stage,

  /**
   * Throw `CJSS.Error(message, originalError)` when you encounter an exception while parsing or
   * running the user’s code. The message, original error and the source location will be logged.
   */
  CJSSError as Error,

  /**
   * `CJSS.registerPlugin(modeName, plugin, ...stages)` can be used to register a new mode.
   * The mode name is any valid css identifier.
   * The plugin is a function of type body => (htmlElement, data) => data, so it takes the code
   *   given to it, and returns a function taking an htmlElement target and the previous data,
   *   returning the updated data. If nothing (undefined) is returned, data is not changed.
   * The stages (e.g. CJSS.Stage.DATA) are used to specify which stages the plugin applies to.
   *   If this argument is omitted, this definition of a plugin will be the fallback: it will
   *   only be used when no definition specific to the current stage exists.
   *
   * Note that it is the responsibility of the plugin to edit the element, especially in the body
   *   stage.
   *
   * See ./plugins/{html.js, json.js, js.js} for some examples of how to use this function.
  */
  registerPlugin,

  /**
   * E.g. `CJSS.PluginHelpers.assignBody(element, contents)`
   *   assigns a node, text or an array thereof to an element, useful as a return value for the
   *   body stage.
   */
  PluginHelpers,
};
