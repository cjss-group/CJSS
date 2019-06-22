import cjss from './cjss';
import registerPlugin from './registerPlugin';
import './defaultPlugins';

const documentReady = new Promise((resolve) => {
  if (['complete', 'interactive', 'loaded'].includes(document.readyState)) resolve();
  else document.addEventListener('DOMContentLoaded', resolve);
}).then(() => document);

documentReady.then(() => cjss());

export default {
  // This can be globally accessed via cjss.render()
  render: cjss,
  registerPlugin,
};
