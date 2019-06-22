import cjss from './cjss';

/**
 * Run the CJSS script for every stylesheet in the file.
 */
export default function initialize() {
  for (const sheet of document.styleSheets) {
    cjss(sheet);
  }
}
