import initialize from './initialize';
import cjss from './cjss';
import './defaultPlugins';

if (['complete', 'interactive', 'loaded'].includes(document.readyState)) {
  initialize();
} else document.addEventListener('DOMContentLoaded', initialize);

export default {
  // This can be globally accessed via cjss.render()
  render: cjss,
  // This is also where cjss.registerPlugin() will likely go.
};
