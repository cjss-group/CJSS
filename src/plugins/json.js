import registerPlugin from '../registerPlugin';
import CJSSError from '../CJSSError';
import Stage from '../Stage';

/**
 * JSON: only for the data stage. The code given will be wrapped in curly
 * braces and parsed as JSON without interpolation.
 */
registerPlugin('json', body => () => {
  try {
    return JSON.parse(body);
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new CJSSError(`CJSS: ${e.name} in JSON:`, e);
    } throw e;
  }
}, Stage.DATA);
