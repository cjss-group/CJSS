import cjss from './cjss';

/**
 * Plug every stylesheet in the document into the cjss function.
 */
export default function initialize() {
  for (let sheet of document.styleSheets) {
    const rules = sheet.rules || sheet.cssRules;

    if (!rules || !rules.length) continue;
    cjss(rules);
  }
}