import initialize from './initialize';
import cjss from './cjss';

if (['complete','interactive','loaded'].includes(document.readyState)) {
  initialize();
} else document.addEventListener('DOMContentLoaded', initialize);

export default {
  render: cjss  // This can be globally accessed via cjss.render()
                // This is also where cjss.registerPlugin() will likely go.
};