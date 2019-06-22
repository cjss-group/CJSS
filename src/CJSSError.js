/**
 * Provide a custom error class for any errors caused by the user within CJSS.
 *
 * These are used interally for throwing and catching, and should never reach
 * the end user other than in the console.
 *
 * @property {Error} original The original error thrown while parsing/running
 *   the script.
 */
export default class CJSSError extends Error {
  constructor(message, original) {
    super(message);
    this.name = 'CJSSError';
    /**
     * The original error thrown while parsing/running the script.
     * @type {Error}
     */
    this.original = original;
  }
}
