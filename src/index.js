import initialize from './initialize';
import cjss from './cjss';

document.addEventListener('DOMContentLoaded', initialize);

export default {
  render: cjss  // This can be globally accessed via cjss.render()
                // This is also where cjss.registerPlugin() will likely go.
};